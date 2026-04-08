# Changelog

All notable changes to FlexMatches™ are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

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
