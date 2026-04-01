/**
 * FlexMatches Design System — Theme Tokens
 *
 * Two themes: dark (default) and light.
 * Both are intentional and premium — light is NOT a simple inversion.
 *
 * Dark:  near-black + orange + dark cards
 * Light: warm cream + orange + white cards
 *
 * Usage:
 *   const { theme, isDark, toggleTheme } = useTheme();
 *   style={{ backgroundColor: theme.colors.bg }}
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Appearance, ColorSchemeName } from "react-native";

// ─── Brand ───────────────────────────────────────────────────────────────────
export const BRAND = {
  primary:       "#FF4500",
  primaryLight:  "#FF6B35",
  primaryDark:   "#CC3700",
  primarySubtle: "#FF450015",
  primaryBorder: "#FF450040",
} as const;

// ─── Semantic palette ─────────────────────────────────────────────────────────
export const PALETTE = {
  success:       "#22C55E",
  successSubtle: "#0D2D1A",
  warning:       "#F59E0B",
  warningSubtle: "#2A1F00",
  error:         "#EF4444",
  errorSubtle:   "#2A0000",
  info:          "#3B82F6",
  infoSubtle:    "#0D1A2D",
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const SPACE = {
  2:  2,
  4:  4,
  6:  6,
  8:  8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  20: 20,
  24: 24,
  28: 28,
  32: 32,
  40: 40,
  48: 48,
  60: 60,
} as const;

// ─── Border radius ───────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  pill: 999,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────
//
// Two-tier font system:
//   DISPLAY tier — headings, titles, section names   → heavy weight, large size
//   TEXT tier    — body, meta, captions              → regular weight, comfortable size
//
// Minimum sizes: body 15px, caption 13px — readable for ages 10–70.

export const FONT = {
  size: {
    xs:      13,   // captions — min readable
    sm:      15,   // meta, badges, helper text
    base:    17,   // body text — comfortable reading
    md:      18,   // card titles, prominent body
    lg:      20,   // section headings
    xl:      24,   // screen subtitles
    xxl:     28,   // screen titles
    xxxl:    32,   // hero text
    display: 38,   // splash / large numbers
  },
  weight: {
    regular:   "400" as const,
    medium:    "500" as const,
    semibold:  "600" as const,
    bold:      "700" as const,
    extrabold: "800" as const,
    black:     "900" as const,
  },
  lineHeight: {
    tight:  1.2,
    normal: 1.5,   // was 1.4 — slightly more open for readability
    loose:  1.7,
  },
} as const;

/**
 * Semantic typography roles.
 *
 * DISPLAY tier (headings — heavy, large):
 *   screenTitle  — page title        28px / 900
 *   sectionTitle — section header    18px / 800
 *   cardTitle    — card heading      16px / 700
 *
 * TEXT tier (content — regular, comfortable):
 *   body         — main readable text  15px / 400
 *   bodyMedium   — emphasized body     15px / 600
 *   caption      — meta / timestamps   13px / 400
 *   label        — uppercase badge     11px / 700
 *   button       — CTA label           16px / 700
 */
export const TYPE = {
  // ── Display tier ─────────────────────────────────────────
  screenTitle:  { fontSize: 30, fontWeight: "900" as const, letterSpacing: -0.5, lineHeight: 37 },
  sectionTitle: { fontSize: 20, fontWeight: "800" as const, letterSpacing: -0.2, lineHeight: 26 },
  cardTitle:    { fontSize: 18, fontWeight: "700" as const, letterSpacing: -0.1, lineHeight: 24 },

  // ── Text tier ─────────────────────────────────────────────
  body:         { fontSize: 16, fontWeight: "400" as const, lineHeight: 24 },
  bodyMedium:   { fontSize: 16, fontWeight: "600" as const, lineHeight: 24 },
  caption:      { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  label:        { fontSize: 12, fontWeight: "700" as const, textTransform: "uppercase" as const, letterSpacing: 0.9 },
  button:       { fontSize: 17, fontWeight: "700" as const, letterSpacing: -0.2 },
  buttonSm:     { fontSize: 15, fontWeight: "600" as const },
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const SHADOW = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

// ─── Color tokens per theme ───────────────────────────────────────────────────
type ColorTokens = {
  // Backgrounds
  bg:         string;
  bgCard:     string;
  bgCardAlt:  string;
  bgInput:    string;
  bgOverlay:  string;

  // Borders
  border:       string;
  borderMedium: string;
  borderStrong: string;

  // Text
  text:          string;
  textSecondary: string;
  textMuted:     string;
  textFaint:     string;
  textInverted:  string;

  // Tab bar
  tabBar:         string;
  tabBarBorder:   string;

  // Brand (same in both themes)
  brand:         string;
  brandLight:    string;
  brandDark:     string;
  brandSubtle:   string;
  brandBorder:   string;
};

const darkColors: ColorTokens = {
  // Backgrounds — near-black with warm undertone
  bg:         "#0A0A0A",
  bgCard:     "#141414",
  bgCardAlt:  "#1A1A1A",
  bgInput:    "#111111",
  bgOverlay:  "rgba(0,0,0,0.85)",

  // Borders
  border:       "#1E1E1E",
  borderMedium: "#2A2A2A",
  borderStrong: "#3A3A3A",

  // Text — dark mode 3-tier hierarchy
  text:          "#F5F5F5",   // Tier 1 — neredeyse beyaz
  textSecondary: "#C8C8C8",   // Tier 2 — açık gri
  textMuted:     "#888888",   // Tier 3 — orta gri
  textFaint:     "#555555",   // Tier 4 — koyu gri
  textInverted:  "#0A0A0A",

  // Tab bar
  tabBar:       "#0F0F0F",
  tabBarBorder: "#1A1A1A",

  // Brand
  brand:       BRAND.primary,
  brandLight:  BRAND.primaryLight,
  brandDark:   BRAND.primaryDark,
  brandSubtle: BRAND.primarySubtle,
  brandBorder: BRAND.primaryBorder,
};

// Light mode: warm cream — intentionally NOT a white inversion.
// The warmth reduces the "tech app" feel and makes it feel more human/athletic.
const lightColors: ColorTokens = {
  // Backgrounds — warm cream/off-white
  bg:         "#F5F0EA",
  bgCard:     "#FFFFFF",
  bgCardAlt:  "#EDE8E1",
  bgInput:    "#F0EBE4",
  bgOverlay:  "rgba(0,0,0,0.50)",

  // Borders
  border:       "#E4DDD5",
  borderMedium: "#CFC8BF",
  borderStrong: "#B8B0A7",

  // Text — 3-tier contrast hierarchy
  // Tier 1: Koyu siyah  — başlıklar, önemli içerik     ~20:1 kontrast
  // Tier 2: Siyah       — body metin, kart içerikleri   ~12:1 kontrast
  // Tier 3: Açık siyah  — yardımcı bilgi, meta          ~5.5:1 kontrast (WCAG AA ✓)
  // Tier 4: Daha açık   — placeholder, disabled         ~3.5:1 kontrast
  text:          "#0D0D0D",   // Tier 1 — koyu siyah
  textSecondary: "#2D2D2D",   // Tier 2 — siyah
  textMuted:     "#666666",   // Tier 3 — açık siyah
  textFaint:     "#999999",   // Tier 4 — daha açık siyah
  textInverted:  "#FFFFFF",

  // Tab bar — slightly darker cream for definition
  tabBar:       "#EDE8E1",
  tabBarBorder: "#D8D1C8",

  // Brand
  brand:       BRAND.primary,
  brandLight:  BRAND.primaryLight,
  brandDark:   BRAND.primaryDark,
  brandSubtle: "rgba(255,69,0,0.08)",
  brandBorder: "rgba(255,69,0,0.25)",
};

// ─── Theme object ─────────────────────────────────────────────────────────────
export type AppTheme = {
  colors:    ColorTokens;
  space:     typeof SPACE;
  radius:    typeof RADIUS;
  font:      typeof FONT;
  shadow:    typeof SHADOW;
  palette:   typeof PALETTE;
  isDark:    boolean;
};

export const darkTheme: AppTheme = {
  colors:  darkColors,
  space:   SPACE,
  radius:  RADIUS,
  font:    FONT,
  shadow:  SHADOW,
  palette: PALETTE,
  isDark:  true,
};

export const lightTheme: AppTheme = {
  colors:  lightColors,
  space:   SPACE,
  radius:  RADIUS,
  font:    FONT,
  shadow:  SHADOW,
  palette: PALETTE,
  isDark:  false,
};

// ─── Context ──────────────────────────────────────────────────────────────────
type ThemeContextValue = {
  theme:       AppTheme;
  isDark:      boolean;
  toggleTheme: () => void;
  setTheme:    (scheme: "light" | "dark" | "system") => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme:       darkTheme,
  isDark:      true,
  toggleTheme: () => {},
  setTheme:    () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = Appearance.getColorScheme();
  const [scheme, setSchemeState] = useState<"light" | "dark">(
    systemScheme === "light" ? "light" : "dark"
  );

  // Listen to system changes
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      // Only auto-follow system if user hasn't manually overridden
      // For now, always follow system on first load
      if (colorScheme) {
        setSchemeState(colorScheme === "light" ? "light" : "dark");
      }
    });
    return () => sub.remove();
  }, []);

  const theme = scheme === "light" ? lightTheme : darkTheme;

  const toggleTheme = () =>
    setSchemeState((prev) => (prev === "dark" ? "light" : "dark"));

  const setTheme = (s: "light" | "dark" | "system") => {
    if (s === "system") {
      const sys = Appearance.getColorScheme();
      setSchemeState(sys === "light" ? "light" : "dark");
    } else {
      setSchemeState(s);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark: scheme === "dark", toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
