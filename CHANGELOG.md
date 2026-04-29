# Changelog

All notable changes to FlexMatches™ are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — 2026-04-29 — Codex review pass

### Privacy boundary lockdown (server-side, P0)
- Migration 17: `reports_received` moved out of `public.users` into `private.user_report_counters` (separate schema, anon/authenticated have no SELECT). Trust tier label is the only public surface; raw counts never cross the wire.
- Migration 18: `get_home_data` candidates section now applies the same gate as Discover (banned, hide_profile, hide_from_male, blocks both directions). Closed the bypass where users hidden from males still surfaced on Home Best Matches.
- Migration 18: `get_nearby_users` gender check uses `COALESCE(caller, 'male') <> 'male'` so callers with NULL gender no longer bypass `hide_from_male`. Restrictive default applied to every existing account at once.
- 16_trust_tier.sql rewritten so a fresh-install replay does NOT recreate the leak. trust_tier becomes a regular text column updated by triggers in 17.

### Mobile hardening (P1)
- `app/_layout.tsx`: synchronous `banned_at` check on every launch; cache only saves the onboarding-state lookup. Banned users now get kicked on next launch instead of "eventually after the background fetch."
- `app/(tabs)/home.tsx` respondToMatch / sendRequestFromSheet / cancelSession / rescheduleSession: check Supabase `error` before mutating local state. Failed writes show Alert with retry guidance instead of silently desyncing UI from DB.
- `components/discover/ProfileSheet.tsx` handleBlock / handleReport: same pattern. Menu no longer says "reported" if the row was rejected.
- `app/(auth)/reset-password.tsx`: upgraded to require Strong (8+ chars, one uppercase, one number) with the same live strength meter as register.tsx. The 6-char escape hatch is gone.

### Dependency hygiene
- `@sentry/react-native` 6.22.0 → 7.2.0 (Expo SDK 54 alignment).
- `expo install --fix` aligned the patch versions of expo, expo-file-system, expo-image-picker, expo-linking, expo-notifications, expo-updates, expo-web-browser, react-native-worklets.
- `expo-doctor` now passes 17/17 checks.

---

## [1.0.0] — 2026-04-XX — Initial Release

### Eagle Hardening Program Complete (6 sprints, 153 points, 28 stories)

### New Features
- Smart partner matching with swipe, list, and map discovery modes
- Real-time 1:1 chat between matched partners
- Session scheduling with 3-step wizard (sport, date, time/location)
- Session lifecycle: propose → accept/decline → confirm/no-show
- Workout logging with 16 exercise types
- Streak tracking via atomic server-side RPC
- Quick check-in with 1/day limit and partner notifications
- Circles: browse, join, and create local fitness communities
- Circle events with calendar picker and map location
- Leaderboard with Bronze → Silver → Gold → Diamond tiers
- Challenges with progress tracking and mini-leaderboard
- Referral program with milestone rewards
- Pro subscription paywall (iOS IAP + Android Stripe)
- Admin panel with 8 server-side actions
- Full profile with career section, badges, tier card, consistency score
- 5-step onboarding with skip guardrails
- Google Places city autocomplete
- Push notifications for all event types with deep linking
- Dark mode support across the app
- Forgot password and reset password flows
- Apple Sign-In support

### Security
- 3 Edge Functions: delete-account, admin-action, verify-iap
- Search input sanitization (sanitizeILike)
- Push token cleanup on logout
- Realtime subscription filtered by match_id
- Server-side admin authorization (never client-side)
- Account deletion removes auth user (not just profile)

### Technical Foundation
- React Native (Expo SDK 54) + Supabase backend
- expo-router v6 file-based routing
- EAS Build with 4 profiles (dev, simulator, preview, production)
- OTA updates via expo-updates
- ErrorState component used on 10+ screens
- Async button pattern with double-tap prevention
- Confirmation dialogs on all destructive actions

### Known Issues
- ConversationRow.tsx uses hardcoded iOS system colors (design intent)
- lib/iap.ts is stubbed — RevenueCat integration pending
- NotificationContext messages listener not filtered by match_id (badge counting only)
- No analytics instrumentation yet
