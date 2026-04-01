/**
 * MapLocationPicker
 * Reusable map-based location picker.
 * Renders as a View (no Modal wrapper — parent decides the overlay).
 */

import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { useTheme, SPACE, FONT, RADIUS } from "../lib/theme";
import { Icon } from "./Icon";

// ─── Venue catalogue ─────────────────────────────────────────────────────────
export const MAP_VENUES = [
  { key: "gym",        emoji: "🏋️", label: "Gym",        color: "#FF4500", q: 'node["leisure"="fitness_centre"](BBOX);node["amenity"="gym"](BBOX);way["leisure"="fitness_centre"](BBOX);way["amenity"="gym"](BBOX);' },
  { key: "running",    emoji: "🏃", label: "Running",    color: "#22C55E", q: 'node["leisure"="track"](BBOX);way["leisure"="track"](BBOX);' },
  { key: "soccer",     emoji: "⚽", label: "Soccer",     color: "#16A34A", q: 'node["leisure"="pitch"]["sport"="soccer"](BBOX);way["leisure"="pitch"]["sport"="soccer"](BBOX);node["leisure"="pitch"]["sport"="association_football"](BBOX);way["leisure"="pitch"]["sport"="association_football"](BBOX);' },
  { key: "football",   emoji: "🏈", label: "Football",   color: "#92400E", q: 'node["leisure"="pitch"]["sport"="american_football"](BBOX);way["leisure"="pitch"]["sport"="american_football"](BBOX);' },
  { key: "baseball",   emoji: "⚾", label: "Baseball",   color: "#B45309", q: 'node["leisure"="pitch"]["sport"="baseball"](BBOX);way["leisure"="pitch"]["sport"="baseball"](BBOX);' },
  { key: "basketball", emoji: "🏀", label: "Basketball", color: "#F59E0B", q: 'node["leisure"="pitch"]["sport"="basketball"](BBOX);way["leisure"="pitch"]["sport"="basketball"](BBOX);' },
  { key: "tennis",     emoji: "🎾", label: "Tennis",     color: "#3B82F6", q: 'node["leisure"="pitch"]["sport"="tennis"](BBOX);way["leisure"="pitch"]["sport"="tennis"](BBOX);' },
  { key: "pool",       emoji: "🏊", label: "Pool",       color: "#8B5CF6", q: 'node["leisure"="swimming_pool"]["access"!="private"](BBOX);way["leisure"="swimming_pool"]["access"!="private"](BBOX);' },
  { key: "sports",     emoji: "🏟️", label: "Sports",     color: "#EC4899", q: 'node["leisure"="sports_centre"](BBOX);way["leisure"="sports_centre"](BBOX);' },
] as const;

export type MapVenueKey = typeof MAP_VENUES[number]["key"];
type MapVenue = { id: number; name: string; key: MapVenueKey; lat: number; lon: number };

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const DEFAULT_REGION = { latitude: 41.0082, longitude: 28.9784, latitudeDelta: 0.04, longitudeDelta: 0.04 };

// ─── Component ───────────────────────────────────────────────────────────────
type Props = {
  onSelect: (loc: string) => void;
  onClose:  () => void;
  colors:   any;
};

export function MapLocationPicker({ onSelect, onClose, colors }: Props) {
  const { isDark } = useTheme();
  const mapRef = useRef<MapView>(null);

  const [pin,        setPin]        = useState<{ latitude: number; longitude: number } | null>(null);
  const [address,    setAddress]    = useState("");
  const [venues,     setVenues]     = useState<MapVenue[]>([]);
  const [activeKeys, setActiveKeys] = useState<Set<MapVenueKey>>(new Set(["gym"]));
  const [loadingV,   setLoadingV]   = useState(false);
  const userLocRef = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    // Immediately fetch with default region so categories appear right away
    fetchVenues(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude, new Set(["gym"]));

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          const { latitude: lat, longitude: lon } = last.coords;
          userLocRef.current = { lat, lon };
          mapRef.current?.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
          fetchVenues(lat, lon, new Set(["gym"]));
        }

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude: lat, longitude: lon } = pos.coords;
        const prev = userLocRef.current;
        const moved = !prev || Math.abs(prev.lat - lat) > 0.001 || Math.abs(prev.lon - lon) > 0.001;
        userLocRef.current = { lat, lon };
        if (moved) {
          mapRef.current?.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
          fetchVenues(lat, lon, new Set(["gym"]));
        }
      } catch {}
    })();
  }, []);

  async function fetchVenues(lat: number, lon: number, keys: Set<MapVenueKey>) {
    setLoadingV(true);
    try {
      const d = 0.025;
      const bbox = `${lat - d},${lon - d},${lat + d},${lon + d}`;
      const parts = MAP_VENUES.filter((v) => keys.has(v.key)).map((v) => v.q.replace(/BBOX/g, bbox)).join("");
      const body = `[out:json][timeout:20];(${parts});out center;`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 18000);
      const res = await Promise.any(
        OVERPASS_MIRRORS.map((url) => fetch(url, { method: "POST", body, signal: ctrl.signal }))
      );
      clearTimeout(timer);
      const json = await res.json();
      const parsed: MapVenue[] = (json.elements ?? []).map((el: any): MapVenue | null => {
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        if (!elLat || !elLon) return null;
        const tags = el.tags ?? {};
        let key: MapVenueKey = "sports";
        if (tags.amenity === "gym" || tags.leisure === "fitness_centre") key = "gym";
        else if (tags.leisure === "track") key = "running";
        else if (tags.sport === "soccer" || tags.sport === "association_football") key = "soccer";
        else if (tags.sport === "american_football") key = "football";
        else if (tags.sport === "baseball") key = "baseball";
        else if (tags.sport === "basketball") key = "basketball";
        else if (tags.sport === "tennis") key = "tennis";
        else if (tags.leisure === "swimming_pool" || tags.amenity === "swimming_pool") key = "pool";
        if (!keys.has(key)) key = [...keys][0] as MapVenueKey;
        const cfg = MAP_VENUES.find((v) => v.key === key)!;
        return { id: el.id, name: tags.name || cfg.label, key, lat: elLat, lon: elLon };
      }).filter(Boolean) as MapVenue[];
      setVenues(parsed);
    } catch {}
    setLoadingV(false);
  }

  function toggleKey(key: MapVenueKey) {
    const next = new Set(activeKeys);
    next.has(key) ? next.delete(key) : next.add(key);
    setActiveKeys(next);
    const loc = userLocRef.current;
    if (loc && next.size > 0) fetchVenues(loc.lat, loc.lon, next);
    else setVenues([]);
  }

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPin({ latitude, longitude });
    setAddress("Looking up…");
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results[0]) {
        const r = results[0];
        setAddress([r.name, r.street, r.city].filter(Boolean).join(", "));
      } else {
        setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch {
      setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    }
  };

  const visibleVenues = venues.filter((v) => activeKeys.has(v.key));

  return (
    <View style={mp.root}>
      {/* Header */}
      <View style={[mp.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Icon name="back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[mp.title, { color: colors.text }]}>Pick location</Text>
        {loadingV && <ActivityIndicator size="small" color={colors.brand} />}
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[mp.chipBar, { backgroundColor: colors.bg }]} contentContainerStyle={mp.chipRow}>
        {MAP_VENUES.map((v) => {
          const active = activeKeys.has(v.key);
          return (
            <TouchableOpacity
              key={v.key}
              style={[mp.chip, { borderColor: active ? v.color : colors.border, backgroundColor: active ? v.color + "18" : colors.bgCard }]}
              onPress={() => toggleKey(v.key)}
              activeOpacity={0.75}
            >
              <Text style={mp.chipEmoji}>{v.emoji}</Text>
              <Text style={[mp.chipLabel, { color: active ? v.color : colors.textMuted }]}>{v.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={mp.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton
        userInterfaceStyle={isDark ? "dark" : "light"}
        onPress={handleMapPress}
      >
        {visibleVenues.map((v) => {
          const cfg = MAP_VENUES.find((c) => c.key === v.key)!;
          return (
            <Marker
              key={v.id}
              coordinate={{ latitude: v.lat, longitude: v.lon }}
              tracksViewChanges={false}
              onPress={() => { setPin({ latitude: v.lat, longitude: v.lon }); setAddress(v.name); }}
            >
              <View style={[mp.venueDot, { backgroundColor: cfg.color + "EE", borderColor: cfg.color }]}>
                <Text style={{ fontSize: 12 }}>{cfg.emoji}</Text>
              </View>
            </Marker>
          );
        })}
        {pin && <Marker coordinate={pin} pinColor="#FF4500" tracksViewChanges={false} />}
      </MapView>

      {/* Footer */}
      <View style={[mp.footer, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
        <Text style={[mp.hint, { color: address ? colors.text : colors.textMuted }]} numberOfLines={2}>
          {address || "Tap a venue or anywhere on the map"}
        </Text>
        {address && address !== "Looking up…" && (
          <TouchableOpacity
            style={[mp.confirmBtn, { backgroundColor: "#FF4500" }]}
            onPress={() => { onSelect(address); onClose(); }}
          >
            <Text style={mp.confirmText}>Use This Location</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const mp = StyleSheet.create({
  root:        { flex: 1, flexDirection: "column" },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE[16], paddingVertical: SPACE[12], gap: SPACE[10], borderBottomWidth: 1, flexShrink: 0 },
  title:       { fontSize: FONT.size.lg, fontWeight: FONT.weight.extrabold, flex: 1 },
  chipBar:     { flexShrink: 0, height: 48 },
  chipRow:     { gap: SPACE[8], paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], alignItems: "center" },
  chip:        { flexDirection: "row", alignItems: "center", gap: SPACE[4], paddingHorizontal: SPACE[10], paddingVertical: SPACE[5], borderRadius: RADIUS.pill, borderWidth: 1.5 },
  chipEmoji:   { fontSize: 12 },
  chipLabel:   { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  venueDot:    { paddingHorizontal: 5, paddingVertical: 3, borderRadius: 10, borderWidth: 1.5 },
  map:         { flex: 1 },
  footer:      { padding: SPACE[16], gap: SPACE[10], borderTopWidth: 1 },
  hint:        { fontSize: FONT.size.sm, lineHeight: FONT.size.sm * 1.5, minHeight: 40 },
  confirmBtn:  { borderRadius: RADIUS.lg, paddingVertical: SPACE[14], alignItems: "center" },
  confirmText: { color: "#fff", fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
});
