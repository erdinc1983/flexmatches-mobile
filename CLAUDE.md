# FlexMatches Mobile — CLAUDE.md

This is the **single source of truth** for the iOS/Android app.

---

## Repo Identity
- **Path:** `C:\Users\Erdo\Documents\Erdinc Projects\FlexMatchesMobile`
- **GitHub:** https://github.com/erdinc1983/flexmatches-mobile
- **Branch:** master
- **Start Expo:** `npx expo start`

> ⚠️ There is a `apps/mobile/` folder inside the monorepo (`flexmatches/`).
> That is a dead skeleton. Never edit it. All iOS work happens here.

---

## Stack
- Expo SDK 54, React Native 0.81.5
- expo-router v6 (`expo-router/entry` in package.json main)
- Supabase JS 2.100.0
- expo-linear-gradient, expo-haptics, expo-image, expo-image-picker
- react-native-maps, react-native-reanimated, react-native-gesture-handler
- expo-notifications (EAS Build only — not available in Expo Go)
- EAS Project ID: `4e957dd8-fd32-4678-9b74-4232d65e658d`
- iOS Bundle ID: `com.flexmatches.app`

---

## Design System
- **Theme:** `lib/theme.tsx` — `useTheme()` hook, light + dark
- **Tokens:** `SPACE`, `RADIUS`, `FONT`, `TYPE`, `SHADOW`, `BRAND`, `PALETTE`
- **Brand orange:** `#FF4500` (from BRAND.primary)
- **Light bg:** `#F5F0EA` (warm cream), **Dark bg:** `#0A0A0A`
- **Icon system:** `components/Icon.tsx` — custom SVG icons with active/inactive variants
- **Avatar:** `components/Avatar.tsx`

### Do NOT:
- Add inline hex colors when a theme token exists
- Use `StyleSheet` without `useTheme()` for colors
- Break dark/light mode support

---

## Route Structure

### Tab Bar (visible — 5 tabs)
| Tab | File |
|-----|------|
| Home | `app/(tabs)/home.tsx` |
| Discover | `app/(tabs)/discover.tsx` |
| Chat | `app/(tabs)/messages.tsx` |
| Circles | `app/(tabs)/circles.tsx` |
| Profile | `app/(tabs)/profile.tsx` |

### Hidden Tabs (registered but not shown in bar)
`activity`, `feed`, `matches`, `goals`, `leaderboard`, `challenges`

### Other Routes
- `app/chat/[matchId].tsx` — Realtime chat
- `app/notifications.tsx`, `app/search.tsx`, `app/settings.tsx`
- `app/(auth)/` — login, register, onboarding, welcome
- `app/pro.tsx` — Stripe paywall
- `app/referral.tsx` — Referral code
- `app/admin.tsx`, `app/modal.tsx`

---

## Architecture — Home Screen

`app/(tabs)/home.tsx` is **data + orchestration only**.
UI is delegated to `components/home/` components.

| Component | Responsibility |
|-----------|---------------|
| `HomeHeader` | Avatar, name, bell, search |
| `MomentumStrip` | Streak / matches / sessions stats |
| `PrimaryActionCard` | Smart hero card (8 action variants) |
| `BestMatchesSection` | Suggested match photo cards |
| `PendingRequestsSection` | Incoming match requests |
| `CirclesPreviewSection` | User's own circles |
| Inline: `GymStrip` | Gym check-in toggle |
| Inline: `UpcomingSessionsSection` | Upcoming buddy sessions |
| Inline: `ActiveNowStrip` | Partners active in last 2h |
| Inline: `ProfileNudge` | Complete profile prompt |
| Inline: `NewCirclesSection` | New circles matching user sports |

---

## Supabase Tables
```
users           → id, username, full_name, avatar_url, current_streak,
                  is_at_gym, gym_checkin_at, sports, fitness_level, city
matches         → sender_id, receiver_id, status (pending/accepted/declined)
messages        → match_id, sender_id, content, read_at
workouts        → user_id, exercise_type, duration_min, logged_at
buddy_sessions  → proposer_id, receiver_id, sport, session_date, session_time, location, status
communities     → id, name, avatar_emoji, sport, city, member_count
community_members → community_id, user_id
notifications   → user_id, type, title, body, related_id, read
feed_posts      → user_id, post_type, content, meta
blocks, favorites, passes, reports
```

### Column traps (renamed from old schema)
- `workouts.workout_type` → `exercise_type`
- `workouts.duration_minutes` → `duration_min`
- `matches.status`: use `"accepted"`, never `"matched"`
- `matches`: use `sender_id/receiver_id`, never `user1_id/user2_id`

---

## Design Principles
- **Gym-first, trust-first** — never dating-app feel
- **Warm neutral background** — cream, not white
- **Orange accent only for primary actions** — not decorative
- **Premium shadows** — subtle, not heavy
- **Typography hierarchy** — large bold titles, muted meta
- Product rule: home hero = user understands in 2 seconds what to do

---

## Working Rules
- Edit only `FlexMatchesMobile/` — never `flexmatches/apps/mobile/`
- Read the file before editing
- Use `useTheme()` for all colors — support dark + light
- Mock data for visual-only passes; connect real Supabase after
- Run Expo from this directory: `npx expo start`
- After approved changes: commit + push to `origin master`
