# FlexMatches Mobile — CLAUDE.md

This is the **single source of truth** for the iOS/Android app.

> 📊 **Full project workbook:** `docs/FlexMatches_JIRA_Backlog_v3.xlsx` (14 tabs: epics, RICE scoring, backlog, sprint plan, DoD, retrospective, UAT, defect log, dependencies, release readiness, incidents, decision log, metrics, compliance)

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
matches         → sender_id, receiver_id, status (pending/accepted/declined/unmatched)
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

### Supabase RPC Functions
- `log_checkin(p_user_id uuid)` → returns `{ streak: number, already_checked_in: boolean }` — atomic streak update with consecutive day check. Already deployed.
- `confirm_session(p_session_id, p_user_id, p_other_id)` — mutual confirmation with FOR UPDATE row lock. Sets proposer_confirmed/receiver_confirmed flags. Status → "confirmed" when both done.
- `no_show_session(p_session_id, p_reporter_id, p_partner_id)` — marks session as "no_show".

### Edge Functions (deployed)
- `delete-account` — JWT verify → push_tokens delete → users delete → auth.admin.deleteUser()
- `verify-iap` — JWT verify → Apple verifyReceipt → active subscription check → is_pro = true (inactive — app is free)
- `admin-action` — JWT verify → service-role is_admin DB check → server-side user updates (ban/unban/promote/demote/make_pro/remove_pro/delete/edit). Returns 403 if not admin. Self-ban/demote/delete blocked.

### Search Sanitization
All user input used in `.or()` PostgREST filters must go through `sanitizeILike()`:
```typescript
function sanitizeILike(q: string): string {
  return q
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/[,()']/g, "");
}
```
`%` and `_` are ILIKE wildcards. `,` splits PostgREST OR conditions (injection vector).

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

---

## ⚠️ DEPENDENCIES & BLOCKERS (from v3 workbook)

**Must respect these when picking up stories:**

| Story | Depends On | Why |
|-------|-----------|-----|
| FM-402 | FM-401 must be Done first | FM-402 uses `lib/streak.ts` helper created by FM-401 |
| FM-101 | FM-103 must be Done first | FM-101 uses `ErrorState` component created by FM-103 |
| All push stories | EAS Build required | Push notifications do NOT work in Expo Go — need physical device + EAS build |

**External blockers (future sprints):**
- FM-701 (Eagle 3): IAP skipped — app is free for now; revisit when monetization begins
- FM-202 (Eagle 1): Account deletion Edge Function may need Supabase Pro plan

---

## 🧭 KEY PRODUCT DECISIONS (from v3 Decision Log)

**These decisions are final. Do not revisit without PO approval.**

| Decision | Rule | Rationale |
|----------|------|-----------|
| DEC-001 | Fix 102 QA issues BEFORE adding any new features | App scored 3.5/10 on readiness. Growth on broken foundation wastes users. |
| DEC-003 | Streak updates via Supabase RPC (`log_checkin`) — never client-side read-modify-write | Client-side is exploitable and has race conditions. Server-side is atomic and tamper-proof. |
| DEC-004 | "unmatched" is a DISTINCT match status from "declined" | Analytics needs to distinguish "never accepted" from "was connected, then unmatched". |
| DEC-005 | Pull-to-refresh failure keeps existing data + shows toast (NOT ErrorState) | Replacing visible data with ErrorState on refresh is jarring. User already has content — preserve it. |
| DEC-006 | Build shared components before screen-level stories | Foundation first avoids rework. ErrorState before error handling. lib/streak.ts before check-in. |

---

## 🚫 COMPLIANCE RULES (affect coding decisions)

**These rules constrain how features are built. Violating them blocks App Store approval.**

1. **NEVER use web Stripe on iOS for digital purchases** — Apple requires In-App Purchase (react-native-iap). Stripe web checkout is only acceptable on Android. (Eagle 3: FM-701)
2. **Account deletion must delete the Auth user** — `supabase.from("users").delete()` alone is NOT sufficient. Must use Edge Function with `auth.admin.deleteUser()`. (Eagle 1: FM-202)
3. **No admin actions via client-side Supabase** — All admin operations (ban, delete user) must go through Edge Functions with service-role key. Client-side `is_admin` check is NOT security. (Eagle 3: FM-702)
4. **Search input must be sanitized** — User input is interpolated into `.or()` filter. Crafted input can manipulate query logic. Use RPC or escape special characters. (Eagle 3: FM-703)
5. **Push tokens must be cleaned on logout** — Call `unregisterPushToken()` BEFORE `signOut()`. Otherwise old user keeps getting pushes on the device. (Eagle 2: FM-505)
6. **Realtime subscription must filter by user** — Current subscription listens to ALL message inserts. Must add `match_id=eq.${matchId}` filter. Privacy violation without it. (Eagle 2: FM-504)
7. **Location must not be saved without consent** — GPS coordinates are currently silently written to profile. Must add explicit consent. (Eagle 4+)
8. **Legal docs must be real and accessible** — "Terms & Privacy Policy" text must be tappable links to real hosted documents, not plain text. (Eagle 3: FM-704)

---

## 🦅 SPRINT HISTORY

### Eagle 0 — Survival Patch (✅ Complete)
| Key | Title | Status |
|-----|-------|--------|
| FM-103 | React Error Boundary + ErrorState Component | ✅ Done |
| FM-101 | Global Error Handling (10 screens) | ✅ Done |
| FM-102 | Chat Message Send Error Recovery | ✅ Done |
| FM-104 | Session Action Error Handling | ✅ Done |
| FM-201 | Separate Delete Messages from Unmatch | ✅ Done |
| FM-302 | Fix Onboarding Race Condition (AppState enum) | ✅ Done |
| FM-301 | Forgot Password + Reset Password Flow | ✅ Done |
| FM-401 | Streak Consecutive Day Enforcement (RPC) | ✅ Done |
| FM-402 | Quick Check-in Spam Prevention | ✅ Done |

### Eagle 1 — Auth & Account Hardening (✅ Complete)
| Key | Title | Status |
|-----|-------|--------|
| FM-202 | Account Deletion (Edge Function + auth cascade) | ✅ Done |
| FM-203 | Duplicate Match Request Prevention | ✅ Done |
| FM-303 | Onboarding Skip Guardrails (name required) | ✅ Done |
| FM-304 | Password Strength Meter + Confirm + Eye Toggle | ✅ Done |
| FM-305 | Email Format Validation + No Auth Screen Stacking | ✅ Done |

### Eagle 2 — Push Notifications (✅ Complete)
| Key | Title | Status |
|-----|-------|--------|
| FM-501 | Push Notification Deep Linking (cold start + background) | ✅ Done |
| FM-502 | Swipe-right Like → Push to Receiver | ✅ Done |
| FM-503 | Session Proposal/Response Notifications | ✅ Done |
| FM-504 | Realtime Subscription User Filter | ✅ Done |
| FM-505 | Push Token Cleanup on Logout | ✅ Done |

### Eagle 3 — Security, Compliance & Polish (🔄 In Progress)
| Key | Title | Status |
|-----|-------|--------|
| FM-601 | Leaderboard Unified Tier System | ✅ Done |
| FM-602 | Mutual Session Confirmation (atomic RPC, FOR UPDATE lock) | ✅ Done |
| FM-603 | CalendarPicker Shared Component (no free-text dates) | ✅ Done |
| FM-701 | iOS In-App Purchase | ⏭️ Skipped (app free for now) |
| FM-702 | Admin Actions → Edge Function (server-side is_admin check) | ✅ Done |
| FM-703 | Search Input Sanitization (ILIKE wildcard + PostgREST injection) | ✅ Done |
| FM-704 | Terms & Privacy Policy Tappable Links | ✅ Done |

---

## 🦅 CURRENT SPRINT: Eagle 3 — Security, Compliance & Polish (continuing)

### Coding Standards

#### Error Handling Pattern (use everywhere)
```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState(false);

const load = useCallback(async () => {
  try {
    setError(false);
    setLoading(true);
    const [{ data: d1 }, { data: d2 }] = await Promise.all([...]);
  } catch (err) {
    console.error("[ScreenName] load failed:", err);
    setError(true);
  } finally {
    setLoading(false);
  }
}, []);

if (loading) return <Skeleton />;
if (error) return <ErrorState onRetry={load} />;
```

#### Async Button Pattern (use everywhere)
```typescript
const [submitting, setSubmitting] = useState(false);

async function handleAction() {
  if (submitting) return;
  setSubmitting(true);
  try {
    const { error } = await supabase.from("table").update(...);
    if (error) throw error;
  } catch (err) {
    Alert.alert("Error", "Could not complete action. Please try again.");
  } finally {
    setSubmitting(false);
  }
}

<TouchableOpacity disabled={submitting} onPress={handleAction}>
  {submitting ? <ActivityIndicator /> : <Text>Action</Text>}
</TouchableOpacity>
```

#### Confirmation Dialog Pattern (destructive actions)
```typescript
Alert.alert(
  "Unmatch [Name]?",
  "This will permanently remove this connection and all messages. This cannot be undone.",
  [
    { text: "Cancel", style: "cancel" },
    { text: "Unmatch", style: "destructive", onPress: () => executeUnmatch() },
  ]
);
```

### Commit Convention
```
[FM-XXX] short description

- what changed
- why it changed
```

---

## 📋 REMAINING STORY SPECS — Full Details for Claude Code

> **IMPORTANT:** Each story below includes ALL team responsibilities.
> Before coding, check: Does this story need UI design first?
> After coding, check: Have all QA tasks and DoD items been addressed?

---

### FM-104: Session Action Error Handling
**Points:** 5 | **Assignee:** Senior Dev | **Priority:** P0 Must Have

**User Story:**
As a user, I want session actions to confirm success before updating the UI, so that I always know the real status of my sessions.

**Acceptance Criteria:**
- AC1: Given I tap Accept/Decline/Cancel/Confirm on a session, When the Supabase update returns an error, Then a toast shows "Could not update session. Please try again." and the UI state remains unchanged
- AC2: Given I tap any session action button, When the async call is in progress, Then the button shows a loading spinner and is disabled
- AC3: Given I rapidly tap an action button twice, When the first request is in-flight, Then only one server request is made
- AC4: Given the proposeSession function in chat, When the insert returns an error, Then the wizard stays open, a toast shows the error, and no session row is created
- AC5: Given any session mutation (propose/accept/decline/cancel/confirm/noShow), When it executes, Then the Supabase return value is checked for errors before any state update

**Files to Touch:**
- `app/chat/[matchId].tsx` — proposeSession, respondToSession, cancelSession, confirmSession, noShowSession functions

**UI/Design:** 🎨 MINIMAL — use Async Button Pattern. No new components.

**QA Tasks:**
- [ ] All 6 session actions handle errors with toast
- [ ] UI does NOT change until server confirms
- [ ] Double-tap prevention on all buttons
- [ ] Propose wizard stays open on failure
- [ ] Each action tested with airplane mode
- [ ] No console errors during failures

**Story DoD:**
- [ ] All 6 functions check Supabase error return
- [ ] User-friendly toast (no jargon)
- [ ] Spinner on every session button
- [ ] Double-tap guard pattern
- [ ] Wizard stays open on failure
- [ ] Both themes verified
- [ ] No hardcoded colors

---

### FM-201: Separate Delete Messages from Unmatch
**Points:** 5 | **Assignee:** Senior Dev | **Priority:** P0 Must Have

**User Story:**
As a user, I want "Delete messages" and "Unmatch" to be completely separate actions with confirmation, so that I never accidentally lose a connection.

**Acceptance Criteria:**
- AC1: Given I swipe left and tap "Delete messages", When the dialog appears, Then it says "Delete all messages with [Name]? The match will be preserved." and only deletes messages
- AC2: Given I swipe left and tap "Unmatch", When the dialog appears, Then it says "Unmatch [Name]? This will permanently remove this connection and all messages. This cannot be undone."
- AC3: Given I tap "Cancel" on either dialog, When it closes, Then no data changes
- AC4: Given I confirm "Unmatch", When it completes, Then match status = "unmatched" (NOT "declined" — per DEC-004)
- AC5: Given I confirm "Delete messages", When it completes, Then `messages.delete().eq("match_id", matchId)` is called and match row remains status="accepted"
- AC6: Given both swipe actions, When visible, Then "Unmatch" is red/destructive, "Delete messages" is neutral

**Files to Touch:**
- `app/(tabs)/messages.tsx` — separate handleDeleteMessages() and handleUnmatch()

**UI/Design:** 🎨 NEEDED — PO must approve dialog copy. Unmatch = red, Delete = neutral.

**QA Tasks:**
- [ ] "Delete messages" only removes messages — match preserved (check DB)
- [ ] "Unmatch" sets status="unmatched" not "declined" (check DB)
- [ ] Both show confirmation dialog
- [ ] Cancel makes zero data changes
- [ ] Swipe actions visually distinct
- [ ] Conversation disappears after unmatch
- [ ] Conversation stays (empty) after message delete
- [ ] Network failure: error toast, no partial changes

**Story DoD:**
- [ ] handleDeleteMessages() calls messages.delete() NOT matches.delete()
- [ ] handleUnmatch() uses status "unmatched"
- [ ] Both have Alert.alert with Cancel
- [ ] Dialog copy approved by PO
- [ ] Unmatch uses red/warning color
- [ ] Error handling with toast
- [ ] DB verified after each action
- [ ] Both themes verified

---

### FM-302: Fix Onboarding Race Condition
**Points:** 5 | **Assignee:** Senior Dev | **Priority:** P0 Must Have

**User Story:**
As a new user, I want to always land on onboarding after registration, so that my profile gets set up before I enter the app.

**Acceptance Criteria:**
- AC1: Given I register, When auth state changes, Then _layout.tsx uses a needsOnboarding check to route
- AC2: Given needsOnboarding=true, When auth listener fires, Then I go to onboarding NOT home
- AC3: Given existing user with complete profile, When I log in, Then I bypass onboarding
- AC4: Given onboarding "Let's go" tap, When update() SUCCEEDS, Then needsOnboarding=false and navigate to home
- AC5: Given onboarding "Let's go" tap, When update() FAILS, Then Alert shows, I stay on step, data preserved
- AC6: Given register screen, When registration completes, Then register does NOT call router.replace — _layout.tsx handles routing

**Files to Touch:**
- `app/_layout.tsx` — centralize routing with needsOnboarding
- `app/(auth)/register.tsx` — remove router.replace to onboarding
- `app/(auth)/onboarding.tsx` — check update() return, Alert on failure

**UI/Design:** 🎨 NONE — routing/logic fix. Standard Alert on failure.

**QA Tasks:**
- [ ] Register 10 times — EVERY time lands on onboarding
- [ ] Existing user goes to home
- [ ] Incomplete profile user goes to onboarding
- [ ] Network off during save → Alert, data preserved
- [ ] Network on retry → save succeeds, navigates to home
- [ ] Profile data exists in Supabase after success
- [ ] Register screen does NOT navigate (only _layout.tsx)

**Story DoD:**
- [ ] New signup ALWAYS lands on onboarding (10/10 test)
- [ ] Routing centralized in _layout.tsx
- [ ] Register.tsx removed router.replace for onboarding
- [ ] Onboarding checks update() return
- [ ] Failure shows Alert + preserves data
- [ ] Success sets needsOnboarding=false
- [ ] Profile data verified in Supabase

---

### FM-301: Forgot Password Flow
**Points:** 5 | **Assignee:** Mid Dev | **Priority:** P0 Must Have

**User Story:**
As a returning user who forgot my password, I want to reset it via email, so that I can regain access to my account.

**Acceptance Criteria:**
- AC1: Given login screen, When I look below password field, Then "Forgot password?" link in brand color
- AC2: Given I tap it, When new screen opens, Then email input + "Send Reset Link" button + back button
- AC3: Given valid email + tap send, When resetPasswordForEmail() succeeds, Then "Check your email for a reset link"
- AC4: Given invalid email format, When I tap send, Then inline error, NO API call
- AC5: Given unknown email, When I tap send, Then neutral message: "If an account exists..." (no enumeration)
- AC6: Given send button pressed, When async in progress, Then spinner + disabled

**Files to Touch:**
- `app/(auth)/login.tsx` — add "Forgot password?" link
- `app/(auth)/forgot-password.tsx` — NEW screen

**UI/Design:** 🎨 NEEDED — match existing auth screen style. Success state with checkmark. Error state with red inline text.

**QA Tasks:**
- [ ] Link visible and tappable on login
- [ ] Navigates to forgot-password screen
- [ ] Valid email sends reset
- [ ] Success message appears
- [ ] Invalid format shows inline error without API call
- [ ] Unknown email shows safe neutral message
- [ ] Loading spinner during async
- [ ] "Back to Login" works
- [ ] Both themes look correct
- [ ] Keyboard doesn't cover button

**Story DoD:**
- [ ] Link on login screen
- [ ] New screen at app/(auth)/forgot-password.tsx
- [ ] Email format validation before API
- [ ] Success + error states
- [ ] No account enumeration
- [ ] Loading state on button
- [ ] Matches auth design system
- [ ] Both themes verified
- [ ] No hardcoded colors
- [ ] Keyboard handling

---

### FM-401: Streak Consecutive Day Enforcement
**Points:** 5 | **Assignee:** Senior Dev | **Priority:** P0 Must Have

**User Story:**
As a user, I want my streak to accurately reflect consecutive workout days, so that I can trust the number I see.

**Acceptance Criteria:**
- AC1: Given yesterday check-in, When I log today, Then streak +1
- AC2: Given 2+ day gap, When I log today, Then streak resets to 1
- AC3: Given already logged today, When I try again, Then returns `{ already_checked_in: true }` — no increment
- AC4: Given any streak update, When it runs, Then uses `supabase.rpc("log_checkin")` — NOT client-side (per DEC-003)
- AC5: Given 11pm local time log, When date compared, Then uses local calendar date (not UTC)
- AC6: Given logWorkout/Quick Check-in, When called, Then uses RPC and updates UI from returned values

**Files to Touch:**
- `app/(tabs)/home.tsx` — logWorkout() → supabase.rpc("log_checkin")
- `app/(tabs)/activity.tsx` — workout logging → same RPC
- `lib/streak.ts` — NEW helper wrapping RPC call

**UI/Design:** 🎨 NONE — backend logic. No visual changes.

**QA Tasks:**
- [ ] Day 1 → streak=1, Day 2 → streak=2, Day 3 → streak=3
- [ ] Skip day → streak resets to 1
- [ ] Same-day duplicate → no increment
- [ ] 10 rapid taps → only +1
- [ ] 11pm local → counts as today
- [ ] Uses supabase.rpc (not manual)
- [ ] DB values correct after each test

**Story DoD:**
- [ ] Uses supabase.rpc("log_checkin")
- [ ] Consecutive: increments
- [ ] Gap: resets to 1
- [ ] Duplicate: no change
- [ ] Local dates (not UTC)
- [ ] lib/streak.ts created
- [ ] UI updates from RPC return
- [ ] Old manual code removed
- [ ] Error: toast, no UI update

---

### FM-402: Quick Check-in Spam Prevention
**Points:** 3 | **Assignee:** Mid Dev | **Priority:** P0 Must Have
**⚠️ BLOCKED: FM-401 must be Done first (creates lib/streak.ts)**

**User Story:**
As a user, I want check-in to count once per day, so that streaks can't be gamed.

**Acceptance Criteria:**
- AC1: Given already checked in today, When I see button, Then "Checked in ✓" disabled
- AC2: Given RPC returns already_checked_in=true, When received, Then no partner notifications
- AC3: Given first check-in today, When partners notified, Then max 1 per partner per day
- AC4: Given button tap, When async in progress, Then spinner + disabled
- AC5: Given Home loads, When last_checkin_date=today, Then button starts as "Checked in ✓" disabled

**Files to Touch:**
- `app/(tabs)/home.tsx` — check-in button logic
- `lib/streak.ts` — use helper from FM-401

**UI/Design:** 🎨 MINIMAL — "Checked in ✓" uses PALETTE.success with reduced opacity.

**QA Tasks:**
- [ ] Check-in → button changes to "Checked in ✓"
- [ ] Second tap → disabled, no increment
- [ ] Reload Home → button starts disabled
- [ ] 1 notification per partner max
- [ ] Spinner during RPC
- [ ] RPC failure → toast, button re-enables

**Story DoD:**
- [ ] "Checked in ✓" disabled after first
- [ ] Initializes disabled if already checked in
- [ ] Uses lib/streak.ts
- [ ] Partner notifications 1/day max
- [ ] Spinner during async
- [ ] Error toast + re-enable
- [ ] Both themes verified

---

## Definition of Done — Eagle 0 (applies to EVERY story)

1. ☐ All Given/When/Then acceptance criteria verified
2. ☐ Happy path + failure path tested
3. ☐ Loading, success, and error states exist
4. ☐ Destructive actions require confirmation dialog
5. ☐ No console errors or warnings
6. ☐ Theme works in both dark + light mode
7. ☐ No hardcoded hex colors (all from useTheme)
8. ☐ Tested on iOS + Android
9. ☐ Code reviewed
10. ☐ Story-Specific DoD items all checked
11. ☐ QA verification tasks all passed

---

## Files That Will Be Touched in Eagle 0 (remaining)
- `app/chat/[matchId].tsx` — FM-104: session action error handling
- `app/(tabs)/messages.tsx` — FM-201: delete/unmatch separation
- `app/_layout.tsx` — FM-302: centralized onboarding routing
- `app/(auth)/register.tsx` — FM-302: remove direct navigation
- `app/(auth)/onboarding.tsx` — FM-302: save result checking
- `app/(auth)/login.tsx` — FM-301: forgot password link
- `app/(auth)/forgot-password.tsx` — FM-301: NEW screen
- `app/(tabs)/home.tsx` — FM-401/402: streak RPC + check-in spam prevention
- `app/(tabs)/activity.tsx` — FM-401: streak RPC in workout logging
- `lib/streak.ts` — FM-401: NEW helper for RPC call
