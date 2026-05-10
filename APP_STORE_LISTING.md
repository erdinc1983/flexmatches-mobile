# FlexMatches — App Store Listing

Submission packet for App Store Connect. Each section maps 1:1 to a field in App Store Connect → Distribution → App Information / Pricing & Availability / Version Information.

Last reviewed: 2026-05-09

---

## App Name (max 30 chars)
FlexMatches

## Subtitle (max 30 chars)
Find Your Training Partner

## Promotional Text (max 170 chars)
Find gym partners nearby — matched by sport, level, and schedule. Chat, plan sessions, log workouts, and stay consistent together. Free to use during early access.

## Description (max 4000 chars)

Stop training alone. FlexMatches connects you with gym partners nearby who match your sport, fitness level, schedule, and location — so you stay consistent and motivated.

Whether you lift weights, do yoga, run, swim, or play tennis, FlexMatches finds people near you who train the same way, at the same time.

HOW IT WORKS
- Create your profile — pick your sports, fitness level, gym, and preferred schedule
- Discover partners — swipe through smart recommendations matched by compatibility
- Connect and chat — message your matches, plan sessions, and meet up
- Train together — log workouts, build streaks, and hold each other accountable

SMART MATCHING
FlexMatches pairs you based on what actually matters: the sports you do, your experience level, when you're free, and how close you are. Every match comes with a compatibility score so you know why it works.

WORKOUT TRACKING
Log workouts across 16 exercise types. Track your streaks, set goals with progress bars, and watch your consistency grow.

CIRCLES — YOUR FITNESS COMMUNITY
Create or join Circles: local groups built around a sport, gym, or neighborhood. Find running crews, climbing groups, basketball regulars, and more.

LEADERBOARD & CHALLENGES
Climb the ranks from Bronze to Diamond based on your workout consistency. Create challenges, invite friends, and compete on the leaderboard.

CHAT & SESSION PLANNING
Real-time messaging with your matches. Propose workout sessions directly from the chat — pick the time, place, and activity.

PRIVACY & SAFETY
- Your exact location is never shared. Other users see only your general area.
- Choose who can see you: everyone, women only, or men only — symmetric controls for everyone.
- Block, report, and unblock available from every profile.
- Trust tier badges (New / Active / Trusted / Vouched) help you spot established members.
- Account deletion removes all your data immediately.

No dating. No influencers. Just real people who want to train together.

## Keywords (max 100 chars total, comma-separated)
gym partner,workout buddy,fitness match,training,accountability,running,lifting,yoga,community

> ASO note: 92 chars. No repeated root words (Apple tokenizes — "gym partner" + "gym buddy" wastes chars). Sport-specific terms (running/lifting/yoga) are higher-volume than generic "exercise" repeats.

## Category
- Primary: Health & Fitness
- Secondary: Social Networking

## Age Rating
17+ (selected because user-to-user messaging exists; Apple downgrades dating apps that claim 12+).

Specifically declare in the App Store Connect age rating questionnaire:
- Infrequent/Mild Mature/Suggestive Themes: **Yes** (user-generated profile photos)
- Unrestricted Web Access: No
- User-Generated Content (chat, profiles): **Yes** with moderation

## Privacy Policy URL
https://www.flexmatches.com/privacy-policy

## Support URL
https://www.flexmatches.com/support

## Marketing URL
https://www.flexmatches.com

## Copyright
2026 FlexMatches LLC

---

## What's New (v1.0.0 — first release)

Welcome to FlexMatches!

- Smart matching — find fitness partners by sport, level, schedule, and location
- Real-time chat with session planning
- Workout logging across 16 exercise types
- Streaks, goals, and progress tracking
- Circles — join or create local fitness communities
- Leaderboard with Bronze to Diamond tiers
- Challenges — create, join, and compete
- Social feed with kudos
- Privacy controls: hide-from-male/female, show-me filter, blocking, reporting
- Trust tier badges based on community standing

---

## App Review — Demo Account

**Reviewer email:** `apple-review@flexmatches.com`
**Password:** *Set by Erdinç before each submission round; share with reviewer in the App Review Notes field below.*

> Setup steps before submission:
> 1. Sign up for `apple-review@flexmatches.com` in the app, complete onboarding with any profile.
> 2. Run `supabase/sql/seed_apple_review.sql` against prod with the reviewer's UUID pasted in. This creates 8 visible test profiles in San Francisco + 1 pre-accepted match with chat history.
> 3. Confirm Discover shows the 8 `apple_test_*` profiles, Home → Best Matches has photos, Messages tab has the seeded conversation.
> 4. Paste the chosen password into the App Review Notes field below.
> 5. After approval, the seed is idempotent — re-running deletes and recreates. Or run only the DELETE block to clean up.

---

## App Review Notes

Hi Apple Review team — thanks for reviewing FlexMatches.

DEMO CREDENTIALS
- Email: apple-review@flexmatches.com
- Password: [PASTE BEFORE SUBMITTING]
- The account is pre-seeded with 8 visible profiles in San Francisco, one pre-accepted match with chat history, and varied trust tiers / fitness levels.

WHAT TO TEST
1. Sign in with the demo account.
2. Discover tab — swipe right to like, swipe left to pass. Tap "Connect" to send a match request.
3. Matches tab — accept/decline incoming requests; the seeded test users will not respond (they're demo profiles, not real accounts).
4. Messages tab — open the seeded conversation to see real-time chat. Type a message and send.
5. Profile tab — view, edit, change avatar.
6. Settings — privacy toggles (hide-from-male, hide-from-female, show-me filter), blocked users list, account deletion under Settings → Account.

SIGN IN WITH APPLE
Sign in with Apple is supported alongside email auth. Both flows lead to the same onboarding sequence (Step 1: name → Step 2: gender → Step 3: age → Step 4: city → Step 5: sports). Apple sign-in auto-fills name on first auth.

LOCATION
The app requests location only when in use, and only to show nearby training partners. Exact coordinates are never shared with other users — they see your city and a coarse marker (rounded to ~1 km).

CONTENT MODERATION
- Block from any profile (Profile sheet → "..." menu → Block) hides the user from Discover and disables future matches.
- Report from the same menu sends to our moderation queue.
- Trust tier badges (New / Active / Trusted / Vouched) are calculated from cumulative reports vs. activity, gating high-trust visibility.
- Account deletion removes all user data within 30 seconds via our delete-account Edge Function.

PHONE VERIFICATION
Phone verification is currently **disabled in the v1.0 build** while we complete A2P 10DLC registration with our SMS provider. Email auth and Sign in with Apple are the only supported sign-in methods at launch.

IN-APP PURCHASES
v1.0 has **no active in-app purchases**. The app is free during early access. A "FlexMatches Pro" tier is referenced in code but the checkout flow is intentionally hidden until we cross our first 1,000-member milestone (founding members receive Pro permanently). No StoreKit products are listed for this submission.

CONTACT
If anything is broken, please reach erdinc@flexmatches.com — we will respond within a few hours during US/EU business days.

Thanks for your time.
— Erdinç Emur, Founder

---

## Pricing & Availability

- **Price tier:** Free
- **Availability:** All territories *(opt out of countries where the app would need additional regulatory paperwork on day one — pick after consulting App Store Connect's per-country requirements)*
- **In-app purchases:** None (Pro tier dormant until 1,000-user milestone — see CLAUDE.md `pro_tier_strategy.md`)

---

## Privacy Questions (App Store Connect → App Privacy)

This section maps to the App Privacy questionnaire. Each "Yes" answer prompts follow-up sub-questions; the answers below match `app.config.ts` `NSPrivacyCollectedDataTypes` exactly.

| Data type | Collected? | Linked to user? | Used for tracking? | Purposes |
|---|---|---|---|---|
| Email Address | Yes | Yes | No | App Functionality (sign-in, password recovery) |
| Photos | Yes | Yes | No | App Functionality (profile avatar) |
| Precise Location | Yes | Yes | No | App Functionality (find nearby partners) |
| Fitness data (workout logs) | Yes | Yes | No | App Functionality (streaks, leaderboard) |
| Name | Yes | Yes | No | App Functionality (profile display) |
| User ID (auth.uid) | Yes | Yes | No | App Functionality (session) |
| Sensitive Info | No | — | — | — |
| Health & Fitness (HealthKit) | No | — | — | — |
| Financial Info | No | — | — | — |
| Contacts | No | — | — | — |
| Browsing/Search History | No | — | — | — |
| Device ID / Advertising ID | No | — | — | — |
| Usage Data (analytics) | No | — | — | — |

**Tracking:** No (matches `NSPrivacyTracking: false`). ATT prompt is not required.

---

## Screenshot Plan

Required sizes (App Store Connect minimum to publish):
- 6.9" iPhone (iPhone 16 Pro Max display): 1290×2796 portrait, **3 minimum**
- 6.5" iPhone (legacy required): 1242×2688 portrait, **3 minimum** *(Apple still requires for now even though no current device matches; one-pixel-different sizes are accepted)*

Recommended shotlist (5–6 frames):

| # | Screen | Caption (Olcay-style, max ~30 chars) |
|---|---|---|
| 1 | Home with active streak + Best Matches | Show up. Train. Repeat. |
| 2 | Discover swipe deck mid-swipe | Match by sport. Not bio. |
| 3 | Profile sheet expanded | See compatibility, not vibes. |
| 4 | Chat with session proposal modal | Plan sessions. Skip the ghost. |
| 5 | Activity tab with streak + workout log | Streaks that survive Saturday. |
| 6 | Circles list with sport photo cards | Find your crew. |

Captions are **overlay** text on the screenshot, not the App Store description. Keep them under 30 chars so they read on the smallest device thumbnail.

---

## Open items before first submission

- [ ] Replace `[PASTE BEFORE SUBMITTING]` in App Review Notes with the actual demo password.
- [ ] Run `supabase/sql/seed_apple_review.sql` against prod after creating the reviewer account.
- [ ] Generate the 5–6 screenshots from a TestFlight build (cannot pre-generate; needs real iPhone screen capture).
- [ ] Decide territories list (or default to "All territories — Apple-supported" if no specific exclusions needed).
- [ ] Confirm AASA Team ID is replaced from placeholder (`apps/web/public/.well-known/apple-app-site-association` in the web repo).
- [ ] Verify privacy manifest codes (see `docs/apple-readiness-audit.md` in the web repo).
