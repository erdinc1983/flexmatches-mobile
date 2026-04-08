# FlexMatches™

**Find your fitness partner. Stay accountable. Grow together.**

FlexMatches is a mobile app that connects gym-goers and athletes with compatible training partners based on sport, fitness level, schedule, and location.

[![iOS](https://img.shields.io/badge/iOS-App%20Store-blue)](https://apps.apple.com/app/flexmatches/id6761497083)
[![Android](https://img.shields.io/badge/Android-Google%20Play-green)](#)
[![Expo SDK](https://img.shields.io/badge/Expo%20SDK-54-000020)](https://expo.dev)

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS Simulator
npx expo start --ios

# Run on Android Emulator
npx expo start --android
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in your Supabase project URL and anon key
3. See [docs/](#documentation) for full setup details

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native (Expo SDK 54) |
| Router | expo-router v6 (file-based) |
| Backend | Supabase (Auth, DB, Realtime, Edge Functions) |
| Database | PostgreSQL with Row Level Security |
| Push | Expo Notifications |
| Maps | react-native-maps |
| Build | EAS Build (cloud) |
| Updates | expo-updates (OTA) |

---

## Project Structure

```
FlexMatchesMobile/
├── app/                    # Screens (file-based routing)
│   ├── (auth)/             # Auth screens (welcome, login, register, onboarding)
│   ├── (tabs)/             # Tab screens (home, discover, messages, circles, profile + hidden tabs)
│   ├── chat/[matchId].tsx  # 1:1 chat with session wizard
│   ├── settings.tsx        # Account settings
│   ├── pro.tsx             # Pro subscription
│   ├── referral.tsx        # Referral program
│   ├── admin.tsx           # Admin panel
│   └── _layout.tsx         # Root layout (auth routing, error boundary, deep linking)
├── components/             # Reusable UI components
│   ├── ui/                 # ErrorState, Button, Skeleton, EmptyState, etc.
│   ├── chat/               # ConversationRow, SessionBanner
│   ├── discover/           # SwipeDeck, PersonCard, ProfileSheet
│   └── home/               # HomeHeader, PrimaryActionCard, MomentumStrip
├── lib/                    # Utilities and services
│   ├── supabase.ts         # Supabase client
│   ├── theme.tsx           # Design system (useTheme hook)
│   ├── push.ts             # Push notification system
│   ├── badges.ts           # Tier system (calcTier) + badge definitions
│   ├── iap.ts              # In-App Purchase helpers (stubbed)
│   └── config.ts           # API keys
├── supabase/functions/     # Edge Functions (Deno)
│   ├── delete-account/     # Full user cleanup
│   ├── admin-action/       # 8 admin operations
│   └── verify-iap/         # Apple receipt validation
├── docs/                   # Project documentation
└── assets/                 # Images, icons, fonts
```

---

## Key Features

- **Smart Matching** — Swipe, list, and map discovery modes with pagination
- **Real-time Chat** — 1:1 messaging with session scheduling wizard
- **Session Tracking** — Propose, accept, confirm, no-show lifecycle
- **Streaks** — Atomic server-side streak tracking (log_checkin RPC)
- **Circles** — Local fitness communities with events and capacity limits
- **Leaderboard** — Bronze → Silver → Gold → Diamond tiers
- **Challenges** — Community fitness challenges with progress tracking
- **Pro Subscription** — 10 premium features via Apple IAP
- **Admin Panel** — 8 server-side actions via Edge Function
- **Push Notifications** — All event types with deep linking

---

## Documentation

| Document | Description |
|----------|------------|
| [CLAUDE.md](CLAUDE.md) | Source of truth for Claude Code (stack, schema, patterns) |
| [RELEASE_GUIDE.md](RELEASE_GUIDE.md) | Release process, versioning, rollback, access control |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [APP_STORE_LISTING.md](APP_STORE_LISTING.md) | App Store listing copy |
| [docs/BA Documentation v2](docs/) | Complete product documentation (Word) |
| [docs/CPO Report](docs/) | Strategic analysis, roadmap, marketing strategy (Word) |
| [docs/JIRA Backlog v3](docs/) | 14-tab project workbook (Excel) |
| [docs/Terms of Service](docs/TERMS_OF_SERVICE.md) | Legal — Terms of Service |
| [docs/Privacy Policy](docs/PRIVACY_POLICY.md) | Legal — Privacy Policy |

---

## Build & Deploy

```bash
# Development build
eas build --platform ios --profile development

# Preview (TestFlight)
eas build --platform ios --profile preview

# Production (App Store)
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --latest

# OTA update (JS-only changes)
eas update --branch production --message "Fix: description"
```

See [RELEASE_GUIDE.md](RELEASE_GUIDE.md) for the complete release process.

---

## Edge Function Deployment

```bash
supabase functions deploy delete-account
supabase functions deploy admin-action
supabase functions deploy verify-iap
```

---

## Legal

FlexMatches™ is a trademark of FlexMatches LLC (Delaware).
© 2026 FlexMatches LLC. All rights reserved.
