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
export const FONT = {
  size: {
    xs:      10,
    sm:      12,
    base:    14,
    md:      15,
    lg:      17,
    xl:      20,
    xxl:     24,
    xxxl:    28,
    display: 34,
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
    normal: 1.4,
    loose:  1.6,
  },
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

  // Text
  text:          "#FFFFFF",
  textSecondary: "#CCCCCC",
  textMuted:     "#666666",
  textFaint:     "#3A3A3A",
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

  // Text
  text:          "#1A1A1A",
  textSecondary: "#3A3A3A",
  textMuted:     "#777777",
  textFaint:     "#ABABAB",
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
