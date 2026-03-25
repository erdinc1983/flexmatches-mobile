/**
 * FlexMatches Icon Abstraction Layer
 *
 * Maps semantic icon names → Ionicons (Phase 1 interim).
 * When custom FM icons are ready, swap the mapping here — zero screen changes needed.
 *
 * Usage:
 *   <Icon name="home" size={24} color={theme.colors.brand} />
 *   <Icon name="fire" size={20} color="#FF4500" />
 */

import React from "react";
import { Ionicons } from "@expo/vector-icons";

// ─── Semantic icon map ────────────────────────────────────────────────────────
// Key  = FlexMatches semantic name
// Value = Ionicons name (outline variants preferred — filled used for "active" states)

export const ICON_MAP = {
  // Navigation — tab bar
  home:          "home-outline",
  homeActive:    "home",
  discover:      "compass-outline",
  discoverActive:"compass",
  chat:          "chatbubble-outline",
  chatActive:    "chatbubble",
  circles:       "people-outline",
  circlesActive: "people",
  profile:       "person-outline",
  profileActive: "person",

  // Actions
  search:        "search-outline",
  filter:        "options-outline",
  add:           "add",
  addCircle:     "add-circle-outline",
  edit:          "pencil-outline",
  save:          "checkmark",
  close:         "close",
  back:          "chevron-back",
  forward:       "chevron-forward",
  more:          "ellipsis-horizontal",
  send:          "send",
  share:         "share-outline",
  camera:        "camera-outline",
  image:         "image-outline",
  notification:  "notifications-outline",
  settings:      "settings-outline",
  logout:        "log-out-outline",

  // Fitness / domain
  workout:       "barbell-outline",
  streak:        "flame-outline",
  streakActive:  "flame",
  trophy:        "trophy-outline",
  trophyActive:  "trophy",
  goal:          "flag-outline",
  goalActive:    "flag",
  calendar:      "calendar-outline",
  clock:         "time-outline",
  location:      "location-outline",
  heart:         "heart-outline",
  heartActive:   "heart",
  star:          "star-outline",
  starActive:    "star",

  // Social
  match:         "handshake-outline",
  matchActive:   "handshake",
  message:       "mail-outline",
  check:         "checkmark-circle-outline",
  checkActive:   "checkmark-circle",
  decline:       "close-circle-outline",
  gym:           "fitness-outline",
  gymActive:     "fitness",
  leaderboard:   "podium-outline",
  leaderboardActive: "podium",

  // Status
  verified:      "shield-checkmark-outline",
  lock:          "lock-closed-outline",
  info:          "information-circle-outline",
  warning:       "warning-outline",
  error:         "alert-circle-outline",
  success:       "checkmark-circle-outline",

  // View modes
  cards:         "albums-outline",
  list:          "list-outline",
  map:           "map-outline",

  // Misc
  chevronDown:   "chevron-down",
  chevronUp:     "chevron-up",
  chevronRight:  "chevron-forward",
  link:          "link-outline",
  copy:          "copy-outline",
  trash:         "trash-outline",
  refresh:       "refresh-outline",
} as const;

export type IconName = keyof typeof ICON_MAP;

// ─── Component ────────────────────────────────────────────────────────────────
type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  style?: object;
};

export function Icon({ name, size = 24, color = "#FFFFFF", style }: IconProps) {
  const ioniconName = ICON_MAP[name] as React.ComponentProps<typeof Ionicons>["name"];
  return <Ionicons name={ioniconName} size={size} color={color} style={style} />;
}
