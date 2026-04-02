/**
 * CityAutocomplete
 *
 * Debounced city search backed by Google Places Autocomplete API (types=cities).
 * Displays a floating dropdown of suggestions below the input.
 * On selection, stores only the city's main_text (e.g. "Istanbul", not "Istanbul, Turkey").
 */

import { useCallback, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { useTheme, SPACE, FONT, RADIUS } from "../lib/theme";
import { GOOGLE_PLACES_API_KEY } from "../lib/config";

type Suggestion = {
  placeId:     string;
  mainText:    string;
  secondaryText: string;
};

type Props = {
  value:               string;
  onChangeText:        (city: string) => void;
  placeholder?:        string;
  placeholderTextColor?: string;
  inputStyle?:         any;
  containerStyle?:     any;
  accessibilityLabel?: string;
  autoFocus?:          boolean;
};

export function CityAutocomplete({
  value,
  onChangeText,
  placeholder          = "e.g. Istanbul, New York, London",
  placeholderTextColor,
  inputStyle,
  containerStyle,
  accessibilityLabel   = "City",
  autoFocus,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(input)}&types=(cities)&key=${GOOGLE_PLACES_API_KEY}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.status === "OK") {
        const items: Suggestion[] = (json.predictions ?? []).map((p: any) => ({
          placeId:       p.place_id,
          mainText:      p.structured_formatting?.main_text      ?? p.description,
          secondaryText: p.structured_formatting?.secondary_text ?? "",
        }));
        setSuggestions(items);
        setOpen(items.length > 0);
      } else {
        setSuggestions([]); setOpen(false);
      }
    } catch {
      setSuggestions([]); setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(text: string) {
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 350);
  }

  function handleSelect(s: Suggestion) {
    onChangeText(s.mainText);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <View style={[{ zIndex: 20 }, containerStyle]}>
      <View>
        <TextInput
          style={[
            drop.input,
            { backgroundColor: c.bgInput, borderColor: c.border, color: c.text },
            inputStyle,
          ]}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor ?? c.textFaint}
          accessibilityLabel={accessibilityLabel}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={c.brand}
            style={{ position: "absolute", right: 12, alignSelf: "center", top: 14 }}
          />
        )}
      </View>

      {open && suggestions.length > 0 && (
        <View style={[drop.list, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={s.placeId}
              style={[
                drop.item,
                { borderBottomColor: c.border },
                i === suggestions.length - 1 && { borderBottomWidth: 0 },
              ]}
              onPress={() => handleSelect(s)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${s.mainText}, ${s.secondaryText}`}
            >
              <Text style={[drop.mainText, { color: c.text }]}>{s.mainText}</Text>
              {!!s.secondaryText && (
                <Text style={[drop.subText, { color: c.textMuted }]} numberOfLines={1}>
                  {s.secondaryText}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const drop = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE[14],
    paddingVertical: SPACE[12],
    fontSize: FONT.size.base,
  },
  list: {
    position: "absolute",
    top: "100%",
    left: 0, right: 0,
    zIndex: 100,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginTop: 4,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  item:     { paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], borderBottomWidth: StyleSheet.hairlineWidth },
  mainText: { fontSize: FONT.size.base, fontWeight: "600" },
  subText:  { fontSize: FONT.size.xs, marginTop: 2 },
});
