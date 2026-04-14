/**
 * DiscoverMap
 *
 * Interactive map for the Discover tab:
 *   - Fetches sports venues from Overpass API (gym, soccer, basketball, tennis, pool)
 *   - Shows nearby FlexMatches users who have shared their location
 *   - Category filter chips to show/hide venue types
 *   - Tap user marker → opens ProfileSheet via onUserPress callback
 *   - Tap venue marker → shows venue name callout
 *
 * Requires: latitude / longitude columns on public.users (see migration below)
 *
 * Migration SQL (run once in Supabase SQL editor):
 *   ALTER TABLE public.users
 *     ADD COLUMN IF NOT EXISTS latitude  double precision,
 *     ADD COLUMN IF NOT EXISTS longitude double precision;
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Platform, Linking,
} from "react-native";
import MapView, { Marker, Callout, Region, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { Avatar } from "../Avatar";
import { toDiscoverUser, DISCOVER_USER_COLUMNS, type DiscoverUser, type RequestStatus } from "./PersonCard";

// ─── Venue cache ──────────────────────────────────────────────────────────────
// In-memory: survives view-mode switches within the session (instant re-open)
const MEM_CACHE = new Map<string, Venue[]>();
const DISK_TTL  = 24 * 60 * 60 * 1000; // 24 h on-disk

function cacheKey(lat: number, lon: number) {
  // ~5 km grid — same venues within that radius
  return `fm_venues_${(lat * 20) | 0}_${(lon * 20) | 0}`;
}

async function readDisk(key: string): Promise<Venue[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { ts, venues } = JSON.parse(raw);
    return Date.now() - ts < DISK_TTL ? (venues as Venue[]) : null;
  } catch { return null; }
}

function writeDisk(key: string, venues: Venue[]) {
  AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), venues })).catch(() => {});
}

// Two Overpass mirrors — fire both, use whichever replies first
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function queryOverpass(body: string): Promise<any> {
  const reqs = OVERPASS_MIRRORS.map((url) =>
    fetch(url, { method: "POST", body, headers: { "Content-Type": "text/plain" } })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
  );
  // Promise.any: resolve on first success, reject only if ALL fail
  if (typeof (Promise as any).any === "function") {
    return (Promise as any).any(reqs);
  }
  // Hermes fallback: race (first settle wins — errors handled in fetchVenues try/catch)
  return Promise.race(reqs);
}

// ─── Venue types ──────────────────────────────────────────────────────────────
type VenueCategory = "gym" | "soccer" | "basketball" | "tennis" | "pool" | "sports";

const CATEGORY_CONFIG: Record<VenueCategory, { label: string; emoji: string; color: string; overpass: string }> = {
  gym:        { label: "Gyms",       emoji: "🏋️", color: "#FF4500", overpass: 'node["leisure"="fitness_centre"](BBOX);node["amenity"="gym"](BBOX);' },
  soccer:     { label: "Football",   emoji: "⚽", color: "#22C55E", overpass: 'node["leisure"="pitch"]["sport"="soccer"](BBOX);node["leisure"="pitch"]["sport"="football"](BBOX);way["leisure"="pitch"]["sport"="soccer"](BBOX);way["leisure"="pitch"]["sport"="football"](BBOX);' },
  basketball: { label: "Basketball", emoji: "🏀", color: "#F59E0B", overpass: 'node["leisure"="pitch"]["sport"="basketball"](BBOX);way["leisure"="pitch"]["sport"="basketball"](BBOX);' },
  tennis:     { label: "Tennis",     emoji: "🎾", color: "#3B82F6", overpass: 'node["leisure"="pitch"]["sport"="tennis"](BBOX);way["leisure"="pitch"]["sport"="tennis"](BBOX);' },
  pool:       { label: "Swimming",   emoji: "🏊", color: "#8B5CF6", overpass: 'node["leisure"="swimming_pool"]["access"!="private"](BBOX);node["amenity"="swimming_pool"](BBOX);' },
  sports:     { label: "Sports",     emoji: "🏟️", color: "#EC4899", overpass: 'node["leisure"="sports_centre"](BBOX);way["leisure"="sports_centre"](BBOX);' },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG) as VenueCategory[];

type Venue = {
  id:       number;
  name:     string;
  category: VenueCategory;
  lat:      number;
  lon:      number;
};

type NearbyUser = DiscoverUser & { latitude: number; longitude: number };

/**
 * Fuzz a partner's coordinate before rendering on the map.
 * Rounds to ~1.1km precision (2 decimal places) so we never reveal exact
 * home/gym location. Deterministic: same input → same output (no per-query
 * jitter that could be averaged away). Self markers are NOT fuzzed.
 */
function fuzzCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

type Props = {
  users:       DiscoverUser[];
  statuses:    Record<string, RequestStatus>;
  onUserPress: (user: DiscoverUser) => void;
};

const DELTA = 0.04; // ~4 km viewport

export function DiscoverMap({ users, statuses, onUserPress }: Props) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;
  const mapRef = useRef<MapView>(null);

  const [region,         setRegion]         = useState<Region | null>(null);
  const [venues,         setVenues]         = useState<Venue[]>([]);
  const [nearbyUsers,    setNearbyUsers]    = useState<NearbyUser[]>([]);
  const [activeCategories, setActiveCategories] = useState<Set<VenueCategory>>(new Set(ALL_CATEGORIES));
  const [locationError,  setLocationError]  = useState<string | null>(null);
  const [loadingVenues,  setLoadingVenues]  = useState(false);

  // ── Location + initial data ────────────────────────────────────────────────
  useEffect(() => {
    initLocation();
  }, []);

  async function initLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationError("Location permission needed to show nearby venues and partners.");
      return;
    }

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = loc.coords;

    const r: Region = { latitude, longitude, latitudeDelta: DELTA, longitudeDelta: DELTA };
    setRegion(r);

    // Save location to profile (best-effort). DB columns are lat/lng (not latitude/longitude).
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      supabase.from("users").update({ lat: latitude, lng: longitude }).eq("id", user.id).then(() => {});
    }

    await Promise.all([
      fetchVenues(latitude, longitude),
      fetchNearbyUsers(latitude, longitude),
    ]);
  }

  async function fetchVenues(lat: number, lon: number) {
    const key = cacheKey(lat, lon);

    // 1 — In-memory hit: instant, no spinner
    if (MEM_CACHE.has(key)) {
      setVenues(MEM_CACHE.get(key)!);
      return;
    }

    // 2 — Disk hit: fast (~50 ms), no spinner
    const disk = await readDisk(key);
    if (disk) {
      MEM_CACHE.set(key, disk);
      setVenues(disk);
      return;
    }

    // 3 — Network fetch (first time or stale cache)
    setLoadingVenues(true);
    try {
      const d = 0.04; // ~4 km bbox — matches visible viewport
      const bbox = `${lat - d},${lon - d},${lat + d},${lon + d}`;
      const parts = ALL_CATEGORIES
        .map((cat) => CATEGORY_CONFIG[cat].overpass.replace(/BBOX/g, bbox))
        .join("");
      const json = await queryOverpass(`[out:json][timeout:10];(${parts});out center;`);

      const FALLBACK: Record<VenueCategory, string> = {
        gym: "Gym", soccer: "Football Field", basketball: "Basketball Court",
        tennis: "Tennis Court", pool: "Swimming Pool", sports: "Sports Centre",
      };

      const parsed: Venue[] = (json.elements ?? [])
        .map((el: any): Venue | null => {
          const elLat = el.lat ?? el.center?.lat;
          const elLon = el.lon ?? el.center?.lon;
          if (!elLat || !elLon) return null;
          const tags = el.tags ?? {};
          let category: VenueCategory = "sports";
          if (tags.amenity === "gym" || tags.leisure === "fitness_centre")               category = "gym";
          else if (tags.sport === "soccer" || tags.sport === "football")                 category = "soccer";
          else if (tags.sport === "basketball")                                           category = "basketball";
          else if (tags.sport === "tennis")                                               category = "tennis";
          else if (tags.leisure === "swimming_pool" || tags.amenity === "swimming_pool") category = "pool";
          return { id: el.id, name: tags.name || FALLBACK[category], category, lat: elLat, lon: elLon };
        })
        .filter(Boolean) as Venue[];

      MEM_CACHE.set(key, parsed);
      writeDisk(key, parsed); // fire-and-forget
      setVenues(parsed);
    } catch {
      // Overpass failed — graceful empty state
    }
    setLoadingVenues(false);
  }

  async function fetchNearbyUsers(lat: number, lon: number) {
    // DB columns are lat/lng (not latitude/longitude). Fetch exact coords for
    // distance calculation, then fuzz before storing for render.
    const { data } = await supabase
      .from("users")
      .select(DISCOVER_USER_COLUMNS)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .limit(50);

    const KM = 15;
    const nearby = (data ?? []).filter((u: any) => {
      const dist = haversine(lat, lon, u.lat, u.lng);
      return dist <= KM;
    }).map((u: any): NearbyUser => ({
      ...toDiscoverUser(u),
      // Fuzz to ~1.1km precision for map render. Real lat/lng stay in
      // toDiscoverUser() → user.lat/lng for profile sheet distance text.
      latitude:  fuzzCoord(u.lat),
      longitude: fuzzCoord(u.lng),
    }));

    setNearbyUsers(nearby);
  }

  function openNavigation(v: Venue) {
    const label = encodeURIComponent(v.name);
    const url = Platform.OS === "ios"
      ? `maps://?q=${label}&ll=${v.lat},${v.lon}`
      : `geo:${v.lat},${v.lon}?q=${v.lat},${v.lon}(${label})`;

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Universal fallback — Google Maps in browser
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lon}`);
      }
    });
  }

  function toggleCategory(cat: VenueCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  const visibleVenues = venues.filter((v) => activeCategories.has(v.category));

  // ── Error state ────────────────────────────────────────────────────────────
  if (locationError) {
    return (
      <View style={[e.wrap, { backgroundColor: c.bg }]}>
        <Text style={e.emoji}>📍</Text>
        <Text style={[e.title, { color: c.text }]}>Location needed</Text>
        <Text style={[e.sub, { color: c.textMuted }]}>{locationError}</Text>
      </View>
    );
  }

  if (!region) {
    return (
      <View style={[e.wrap, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} size="large" />
        <Text style={[e.sub, { color: c.textMuted, marginTop: SPACE[12] }]}>Finding your location…</Text>
      </View>
    );
  }

  // ── Map ────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      {/* Category chips */}
      <View style={[ch.bar, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ch.row}>
          {ALL_CATEGORIES.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const active = activeCategories.has(cat);
            return (
              <TouchableOpacity
                key={cat}
                style={[ch.chip, { borderColor: active ? cfg.color : c.border, backgroundColor: active ? cfg.color + "18" : c.bgCard }]}
                onPress={() => toggleCategory(cat)}
                activeOpacity={0.75}
              >
                <Text style={ch.emoji}>{cfg.emoji}</Text>
                <Text style={[ch.label, { color: active ? cfg.color : c.textMuted }]}>{cfg.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {loadingVenues && <ActivityIndicator size="small" color={c.brand} style={{ marginRight: SPACE[12] }} />}
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
        userInterfaceStyle={isDark ? "dark" : "light"}
      >
        {/* Venue markers */}
        {visibleVenues.map((v) => {
          const cfg = CATEGORY_CONFIG[v.category];
          return (
            <Marker
              key={`v-${v.id}`}
              coordinate={{ latitude: v.lat, longitude: v.lon }}
              tracksViewChanges={false}
            >
              <View style={[mk.venuePill, { backgroundColor: cfg.color + "EE", borderColor: cfg.color }]}>
                <Text style={mk.venueEmoji}>{cfg.emoji}</Text>
              </View>
              <Callout tooltip onPress={() => openNavigation(v)}>
                <View style={mk.callout}>
                  <View style={[mk.calloutCatBadge, { backgroundColor: cfg.color + "22" }]}>
                    <Text style={mk.calloutEmoji}>{cfg.emoji}</Text>
                    <Text style={[mk.calloutCat, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Text style={mk.calloutTitle}>{v.name}</Text>
                  <View style={[mk.navBtn, { backgroundColor: cfg.color }]}>
                    <Text style={mk.navBtnText}>📍 Navigate</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* Nearby user markers */}
        {nearbyUsers.map((u) => {
          const status = statuses[u.id] ?? "none";
          const borderColor = status === "accepted" ? PALETTE.success : status === "pending" ? "#F59E0B" : "#fff";
          return (
            <Marker
              key={`u-${u.id}`}
              coordinate={{ latitude: u.latitude, longitude: u.longitude }}
              onPress={() => onUserPress(u)}
              tracksViewChanges={false}
            >
              <View style={[mk.userMarker, { borderColor }]}>
                <Avatar url={u.avatar_url} name={u.full_name ?? u.username} size={36} />
                {u.is_at_gym && (
                  <View style={[mk.gymBadge, { backgroundColor: PALETTE.success }]}>
                    <Text style={mk.gymBadgeText}>🏋️</Text>
                  </View>
                )}
              </View>
              <View style={[mk.userArrow, { borderTopColor: borderColor }]} />
            </Marker>
          );
        })}
      </MapView>

      {/* Nearby users count badge */}
      {nearbyUsers.length > 0 && (
        <View style={[bd.badge, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={bd.dot} />
          <Text style={[bd.text, { color: c.text }]}>
            {nearbyUsers.length} partner{nearbyUsers.length !== 1 ? "s" : ""} nearby
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Haversine distance (km) ──────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dO = ((lon2 - lon1) * Math.PI) / 180;
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ch = StyleSheet.create({
  bar:   { borderBottomWidth: 1, flexDirection: "row", alignItems: "center" },
  row:   { gap: SPACE[8], paddingHorizontal: SPACE[16], paddingVertical: SPACE[10] },
  chip:  { flexDirection: "row", alignItems: "center", gap: SPACE[4], paddingHorizontal: SPACE[12], paddingVertical: SPACE[6], borderRadius: RADIUS.pill, borderWidth: 1.5 },
  emoji: { fontSize: 13 },
  label: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
});

const mk = StyleSheet.create({
  venuePill:   { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12, borderWidth: 1.5, alignItems: "center" },
  venueEmoji:  { fontSize: 16 },
  callout:        { backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACE[12], minWidth: 160, gap: SPACE[8], elevation: 6, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  calloutCatBadge:{ flexDirection: "row", alignItems: "center", gap: SPACE[4], borderRadius: RADIUS.pill, paddingHorizontal: SPACE[8], paddingVertical: 3, alignSelf: "flex-start" },
  calloutEmoji:   { fontSize: 12 },
  calloutCat:     { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold },
  calloutTitle:   { fontSize: FONT.size.base, fontWeight: FONT.weight.black, color: "#111" },
  navBtn:         { borderRadius: RADIUS.md, paddingVertical: SPACE[8], alignItems: "center" },
  navBtnText:     { color: "#fff", fontSize: FONT.size.sm, fontWeight: FONT.weight.extrabold },
  userMarker:  { width: 44, height: 44, borderRadius: 22, borderWidth: 3, overflow: "hidden", backgroundColor: "#fff" },
  userArrow:   { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6, borderLeftColor: "transparent", borderRightColor: "transparent", alignSelf: "center", marginTop: -1 },
  gymBadge:    { position: "absolute", bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  gymBadgeText:{ fontSize: 9 },
});

const e = StyleSheet.create({
  wrap:  { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE[32], gap: SPACE[12] },
  emoji: { fontSize: 48 },
  title: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, textAlign: "center" },
  sub:   { fontSize: FONT.size.base, textAlign: "center" },
});

const bd = StyleSheet.create({
  badge: { position: "absolute", bottom: SPACE[20], alignSelf: "center", flexDirection: "row", alignItems: "center", gap: SPACE[6], borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: SPACE[14], paddingVertical: SPACE[8] },
  dot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: PALETTE.success },
  text:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
});
