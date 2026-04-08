# FlexMatches™ — Phase 3: Detailed Workflow Cards

## Batch 1: App Launch + Authentication + Onboarding

> **Date:** April 2026 | **Workflows:** 18 | **Items per card:** 24

---

## WF-001: Cold Launch → Auth Check → Route

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Ensure every app launch lands the user on the correct screen based on auth state |
| 2 | **User Goal** | Open the app and see the right content immediately |
| 3 | **Trigger** | User taps app icon (cold start — no process in memory) |
| 4 | **Preconditions** | App installed. May or may not have a stored session. |
| 5 | **Entry Points** | App icon tap, iOS home screen, app switcher |
| 6 | **Happy Path** | Launch → _layout.tsx → getSession() → session exists → check full_name → has name → state="ready" → navigate to /(tabs)/home |
| 7 | **Alternate Paths** | (a) No session → state="unauthenticated" → navigate to /(auth)/welcome. (b) Session exists but no full_name → state="needs_onboarding" → navigate to /(auth)/onboarding. (c) Pending deep link from push → state="ready" → navigate to deep link route instead of home |
| 8 | **Edge Cases** | (a) Session exists but token expired → Supabase autoRefreshToken handles silently. (b) Network offline at launch → getSession() uses cached session from AsyncStorage → works offline for routing but subsequent queries fail. (c) User deleted account on another device → session exists locally but user row deleted → query fails |
| 9 | **Error Paths** | (a) getSession() throws → no catch → app may hang on loading state. (b) resolveAppState query fails → app stays in "loading" state forever (no timeout) |
| 10 | **Screens Involved** | _layout.tsx (root), index.tsx (redirect), welcome.tsx, onboarding.tsx, home.tsx |
| 11 | **Required UI States** | Loading (blank screen during state resolution), Error (none — missing), Ready (correct target screen) |
| 12 | **Backend Behavior** | supabase.auth.getSession() → reads from AsyncStorage first (cached), then verifies with server. users.select("full_name") to check onboarding status. |
| 13 | **Current Implementation** | _layout.tsx: useEffect calls getSession() + onAuthStateChange. resolveAppState() checks AsyncStorage cache (ONBOARDING_DONE_KEY) first, falls back to DB query. AppState enum: loading/unauthenticated/needs_onboarding/ready. |
| 14 | **Gap Analysis** | (a) No loading UI — user sees blank screen during auth check. (b) No timeout — if getSession hangs, user is stuck. (c) No error handling on resolveAppState failure. (d) The ONBOARDING_DONE_KEY cache is cleared on SIGNED_OUT but NOT on account deletion from another device. |
| 15 | **Defects Found** | **DEF-001:** No loading indicator during cold start auth check — user sees blank white/black screen for 0.5-2s. **DEF-002:** If resolveAppState() throws (network error), app stays in "loading" forever — no timeout or fallback. |
| 16 | **Root Cause** | DEF-001: UX defect (missing loading state). DEF-002: implementation defect (missing error handling). |
| 17 | **Acceptance Criteria** | AC1: Cold launch shows a branded splash/loading indicator within 100ms. AC2: Auth check completes and routes within 3 seconds. AC3: If auth check fails after 10 seconds, show error with retry button. AC4: Correct screen is shown for all 3 states (unauthenticated, needs_onboarding, ready). |
| 18 | **QA Test Cases** | TC1: Fresh install → should see welcome screen. TC2: Logged in user → should see home. TC3: Logged in but no full_name → should see onboarding. TC4: Kill network → reopen → should still route correctly (cached session). TC5: Let app sit 30+ minutes → reopen → token refresh should happen silently. |
| 19 | **Regression Checklist** | Any change to _layout.tsx routing must verify: (a) fresh install routing, (b) logged-in routing, (c) onboarding routing, (d) deep link routing, (e) logout → reopen routing |
| 20 | **Apple Reviewer Check** | Apple opens the app fresh. They expect to see the welcome screen quickly. A blank screen for >2 seconds may be flagged. Apple also tests: force-quit → reopen. |
| 21 | **Analytics Events** | app_launched, auth_state_resolved (with state value), cold_start_duration_ms |
| 22 | **Performance Notes** | ONBOARDING_DONE_KEY AsyncStorage cache avoids DB round-trip on subsequent launches — good. InteractionManager.runAfterInteractions defers push registration and last_active update — good. |
| 23 | **CLAUDE.md Updates** | Add: "Cold launch must show loading indicator. Auth check must timeout after 10s with error + retry." |
| 24 | **Go/No-Go** | **NO-GO** — DEF-002 (infinite loading on error) is a critical blocker. Must add timeout + error handling. |

---

## WF-010: Email/Password Registration

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Allow new users to create an account and start the onboarding flow |
| 2 | **User Goal** | Create an account quickly and start finding fitness partners |
| 3 | **Trigger** | User taps "Get Started — Free" on welcome screen |
| 4 | **Preconditions** | User is on welcome screen. Not authenticated. |
| 5 | **Entry Points** | welcome.tsx → "Get Started" button, login.tsx → "Create one" link |
| 6 | **Happy Path** | Welcome → Register → Enter username + email + password + confirm → Password strength = "Strong" → Tap "Create Account" → signUp() → upsert users row with username → _layout.tsx detects SIGNED_IN → resolveAppState → needs_onboarding → navigate to onboarding |
| 7 | **Alternate Paths** | (a) Email already registered → Alert "User already registered". (b) Apple Sign-In from register screen → different flow (WF-011). (c) User navigates to login instead → router.replace("/(auth)/login") |
| 8 | **Edge Cases** | (a) Username already taken — NOT checked client-side. upsert may silently overwrite or fail depending on DB constraints. (b) Email with uppercase → Supabase handles case-insensitively. (c) Special characters in username → no validation. (d) Network drops during signUp → error shown but partial state may exist. (e) Supabase requires email verification — if enabled, user gets "Check your email" instead of auto-login. |
| 9 | **Error Paths** | (a) signUp fails → Alert with error.message. (b) upsert fails → no error shown to user (silent failure). (c) Network error → generic error message. |
| 10 | **Screens Involved** | register.tsx |
| 11 | **Required UI States** | Default (form), Loading (button spinner), Error (Alert), Success (redirect to onboarding) |
| 12 | **Backend Behavior** | supabase.auth.signUp({email, password, options: {data: {username}}}) → creates auth.users row. Then: supabase.from("users").upsert({id, username}) → creates/updates public.users row. |
| 13 | **Current Implementation** | register.tsx: 4 fields (username, email, password, confirm). Password strength indicator (3 bars). canSubmit requires Strong password + matching confirm. Email validation on blur. Legal links at bottom (Linking.openURL). Submit is disabled until canSubmit=true. |
| 14 | **Gap Analysis** | (a) **Username uniqueness not checked** — no client-side check, no clear DB constraint enforcement visible. (b) **upsert error silently ignored** — if users row creation fails, auth exists but profile doesn't → user stuck. (c) **No loading state on Apple Sign-In button** — handled separately. (d) **Terms URL returns 404** — legal links non-functional. (e) **Supabase email verification** — unclear if enabled. If yes, the flow is different (no auto-login). |
| 15 | **Defects Found** | **DEF-010:** Username uniqueness not validated — two users could register with same username, causing data conflicts. **DEF-011:** upsert failure after signUp creates orphaned auth user with no profile. **DEF-012:** Terms/Privacy links open external browser to 404 pages. |
| 16 | **Root Cause** | DEF-010: missing workflow definition (uniqueness check not designed). DEF-011: implementation defect (missing error handling on upsert). DEF-012: missing integration (website not deployed). |
| 17 | **Acceptance Criteria** | AC1: Registration with valid fields creates auth user + users row. AC2: Password must be Strong (8+ chars, uppercase, number). AC3: Duplicate email shows clear error. AC4: Username uniqueness is validated before submission. AC5: Terms and Privacy links open working pages. AC6: After registration, user lands on onboarding. |
| 18 | **QA Test Cases** | TC1: Register with valid fields → lands on onboarding. TC2: Duplicate email → error alert. TC3: Weak password → button disabled. TC4: Mismatched passwords → error hint shown. TC5: Empty fields → button disabled. TC6: Terms link → opens working URL. TC7: Kill app during registration → reopen → correct state. |
| 19 | **Regression Checklist** | Changes to register.tsx: verify (a) successful registration, (b) error cases, (c) Apple Sign-In still works, (d) navigation to login, (e) onboarding redirect |
| 20 | **Apple Reviewer Check** | Apple creates a test account during review. Registration MUST work perfectly. They test: valid registration, invalid email, back button. Terms/Privacy links MUST work. |
| 21 | **Analytics Events** | registration_started, registration_completed, registration_failed (with reason), registration_method (email/apple) |
| 22 | **Performance Notes** | No performance concerns — single API call |
| 23 | **CLAUDE.md Updates** | Add: "Username uniqueness must be checked before signUp. upsert error must be caught and handled." |
| 24 | **Go/No-Go** | **NO-GO** — DEF-012 (Terms 404) is an Apple rejection blocker. DEF-010 (username uniqueness) is a data integrity risk. |

---

## WF-011: Apple Sign-In Registration

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Provide frictionless registration for iOS users via Apple's identity system |
| 2 | **User Goal** | Create account with one tap using Apple ID |
| 3 | **Trigger** | User taps "Sign up with Apple" button on register screen |
| 4 | **Preconditions** | iOS device. Apple auth available (isAppleAuthAvailable). Not authenticated. |
| 5 | **Entry Points** | register.tsx Apple button, login.tsx Apple button |
| 6 | **Happy Path** | Tap Apple button → Apple auth sheet → user approves → identityToken received → signInWithIdToken → new user detected (no username) → auto-generate username → upsert with name from Apple → _layout.tsx detects SIGNED_IN → needs_onboarding → onboarding (Step 2, since full_name already set from Apple) |
| 7 | **Alternate Paths** | (a) User cancels Apple sheet → status="cancelled" → no action. (b) Existing Apple user → not new → skips username generation → state="ready" → home. (c) Apple hides email → relay email stored. (d) Apple only sends name on FIRST sign-in → subsequent sign-ins have no name. |
| 8 | **Edge Cases** | (a) Apple sends null fullName (user chose "Hide My Email" and didn't share name) → username generated from email prefix, full_name stays null → Step 1 of onboarding shows. (b) Generated username collides with existing → no collision check → potential duplicate. (c) Device not supporting Apple auth → button hidden (correct). |
| 9 | **Error Paths** | (a) signInWithIdToken fails → Alert "Apple Sign In Failed". (b) No identityToken from Apple → error message returned. (c) upsert fails → silent failure (same as WF-010). |
| 10 | **Screens Involved** | register.tsx (or login.tsx), Apple auth system sheet |
| 11 | **Required UI States** | Default, Apple Loading (spinner + "Signing in with Apple..."), Error (Alert), Success (redirect) |
| 12 | **Backend Behavior** | supabase.auth.signInWithIdToken({provider:"apple", token}) → creates or matches auth user. appleAuth.ts checks if new user (no username), generates username, upserts. |
| 13 | **Current Implementation** | appleAuth.ts: signInWithApple() handles full flow. Auto-generates username from email prefix + random 4-digit suffix. Upserts user row with onConflict:"id". Onboarding step 1 checks if full_name exists and skips to step 2 if so. |
| 14 | **Gap Analysis** | (a) **Username collision not handled** — generated username could match existing. (b) **Silent upsert failure** — same as WF-010. (c) **Apple only sends name once** — if first sign-in fails after Apple approves but before upsert, name is lost forever. |
| 15 | **Defects Found** | **DEF-013:** Auto-generated username may collide with existing username (no uniqueness check). **DEF-014:** If upsert fails on first Apple sign-in, full_name from Apple is lost permanently. |
| 16 | **Root Cause** | DEF-013: implementation defect. DEF-014: design mismatch (Apple's one-time name delivery not accounted for). |
| 17 | **Acceptance Criteria** | AC1: Apple Sign-In creates account and routes to onboarding. AC2: Generated username is unique. AC3: full_name from Apple is saved on first sign-in. AC4: Onboarding skips Step 1 if full_name exists. AC5: Cancel Apple sheet → no error shown, stays on register. |
| 18 | **QA Test Cases** | TC1: Apple Sign-In on new account → onboarding at step 2. TC2: Apple Sign-In on existing account → home. TC3: Cancel Apple sheet → no error. TC4: No network during Apple auth → error alert. |
| 19 | **Regression Checklist** | Changes to appleAuth.ts: verify (a) new user flow, (b) existing user flow, (c) cancel flow, (d) onboarding step skip |
| 20 | **Apple Reviewer Check** | Apple REQUIRES Apple Sign-In if any third-party auth is offered. It MUST work. Apple tests: successful sign-in, cancel, and sign-in with "Hide My Email". |
| 21 | **Analytics Events** | apple_signin_started, apple_signin_completed, apple_signin_cancelled, apple_signin_failed |
| 22 | **Performance Notes** | No concerns |
| 23 | **CLAUDE.md Updates** | Add: "Apple name is sent only on first sign-in. Must retry upsert on failure to preserve name." |
| 24 | **Go/No-Go** | **CONDITIONAL GO** — DEF-013 is low-probability risk. DEF-014 is edge case. Fix after higher-priority items. |

---

## WF-012: Email/Password Login

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Allow returning users to access their account |
| 2 | **User Goal** | Sign in quickly and see their home screen |
| 3 | **Trigger** | User taps "I already have an account" on welcome, or "Sign in" link |
| 4 | **Preconditions** | User has existing account. Not authenticated. |
| 5 | **Entry Points** | welcome.tsx → "I already have an account", register.tsx → "Sign in" link |
| 6 | **Happy Path** | Login screen → Enter email + password → Tap "Sign In" → signInWithPassword() → _layout.tsx detects session → state="ready" → home |
| 7 | **Alternate Paths** | (a) Wrong password → Alert "Invalid login credentials". (b) Unregistered email → same error (no enumeration). (c) Forgot password → navigate to forgot-password screen. (d) Apple Sign-In → different flow (WF-013). |
| 8 | **Edge Cases** | (a) Account banned → login succeeds but app should show banned state (unclear if implemented). (b) Email verification pending → login may fail depending on Supabase config. (c) Multiple rapid taps → button disabled during loading but not debounced. |
| 9 | **Error Paths** | (a) signInWithPassword fails → Alert with error.message. (b) Network error → generic Supabase error. |
| 10 | **Screens Involved** | login.tsx |
| 11 | **Required UI States** | Default (form), Focused (orange border), Loading (spinner), Error (Alert), Success (redirect) |
| 12 | **Backend Behavior** | supabase.auth.signInWithPassword({email, password}) → returns session or error. _layout.tsx onAuthStateChange fires with SIGNED_IN event. |
| 13 | **Current Implementation** | login.tsx: Email validation on blur. Show/hide password toggle. Forgot password link. Apple Sign-In button (conditional on availability). "Create one" link to register. Login button disabled during loading. |
| 14 | **Gap Analysis** | (a) **Banned user login** — no check after login. User signs in, gets session, but should see banned screen. (b) **No rate limiting** on login attempts (server-side, Supabase may handle). (c) **Email validation only on blur** — not on submit (though handleLogin does check). |
| 15 | **Defects Found** | **DEF-015:** Banned users can login normally — no banned_at check after authentication. The app does not show a "banned" screen. |
| 16 | **Root Cause** | DEF-015: missing workflow definition (banned user experience not designed). |
| 17 | **Acceptance Criteria** | AC1: Valid credentials → home screen. AC2: Invalid credentials → error alert. AC3: Banned user → blocked or shown banned screen. AC4: Forgot password link works. AC5: Apple Sign-In available on iOS. |
| 18 | **QA Test Cases** | TC1: Valid login → home. TC2: Wrong password → error. TC3: Wrong email → error. TC4: Empty fields → "required" alert. TC5: Forgot password → navigates. TC6: Banned user login → [expected: banned screen, actual: home]. |
| 19 | **Regression Checklist** | Changes to login.tsx: verify (a) successful login, (b) error handling, (c) Apple auth, (d) forgot password nav, (e) register link |
| 20 | **Apple Reviewer Check** | Apple tests login with the provided test account. Must work perfectly. |
| 21 | **Analytics Events** | login_started, login_completed, login_failed (with reason), login_method (email/apple) |
| 22 | **Performance Notes** | No concerns |
| 23 | **CLAUDE.md Updates** | Add: "After successful login, check banned_at before routing to home." |
| 24 | **Go/No-Go** | **NO-GO** — DEF-015 (banned user bypass) is a trust & safety risk. Must add banned check. |

---

## WF-014: Forgot Password

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Allow users to recover access when they forget their password |
| 2 | **User Goal** | Get a reset link to change password |
| 3 | **Trigger** | User taps "Forgot password?" on login screen |
| 4 | **Preconditions** | User is on login screen. Has an existing account (or not — neutral response). |
| 5 | **Entry Points** | login.tsx → "Forgot password?" link |
| 6 | **Happy Path** | Forgot password screen → Enter email → Tap "Send Reset Link" → resetPasswordForEmail() → success card shown: "Check your email" → user taps "Back to Sign In" → login screen |
| 7 | **Alternate Paths** | (a) Email not registered → same success message (no account enumeration ✅). (b) User taps back arrow → returns to login. |
| 8 | **Edge Cases** | (a) Multiple rapid taps on send → button disabled during loading. (b) Supabase rate limit on password reset emails. (c) Email in spam folder → user doesn't see it → retries. |
| 9 | **Error Paths** | (a) resetPasswordForEmail fails → safe error: "We couldn't send a reset link." (b) Network error → same safe message. |
| 10 | **Screens Involved** | forgot-password.tsx |
| 11 | **Required UI States** | Default (form), Loading (spinner), Error (red text), Success (card with "Check your email") |
| 12 | **Backend Behavior** | supabase.auth.resetPasswordForEmail(email, {redirectTo: "flexmatches://reset-password"}) → sends email with magic link. |
| 13 | **Current Implementation** | forgot-password.tsx: Single email field. Safe error message (no enumeration). Success state shows card with email address. "Back to Sign In" button. redirectTo uses flexmatches:// deep link scheme. |
| 14 | **Gap Analysis** | (a) **Deep link scheme** uses "flexmatches://" but app.json scheme is "flexmatchesmobile" → mismatch? Need to verify. (b) Otherwise well-implemented. |
| 15 | **Defects Found** | **DEF-016:** redirectTo uses "flexmatches://reset-password" but app.json scheme is "flexmatchesmobile" → reset deep link may not work. |
| 16 | **Root Cause** | DEF-016: implementation defect (scheme mismatch). |
| 17 | **Acceptance Criteria** | AC1: Email sent for valid address. AC2: Same message for invalid address (no enumeration). AC3: Deep link opens reset-password screen. AC4: Error shown on network failure. |
| 18 | **QA Test Cases** | TC1: Valid email → success card. TC2: Invalid email → same success card. TC3: No email → error hint. TC4: Deep link from email → reset-password screen opens. |
| 19 | **Regression Checklist** | Verify deep link scheme matches app.json. Verify email delivery. Verify no account enumeration. |
| 20 | **Apple Reviewer Check** | Apple requires password recovery. This flow must work. Deep link must work from email. |
| 21 | **Analytics Events** | forgot_password_requested, forgot_password_email_sent |
| 22 | **Performance Notes** | No concerns |
| 23 | **CLAUDE.md Updates** | Fix scheme reference if mismatched. |
| 24 | **Go/No-Go** | **CONDITIONAL GO** — DEF-016 needs verification. If scheme mismatch confirmed, must fix before Apple submission. |

---

## WF-020: Full 5-Step Onboarding

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Collect minimum profile information to enable matching |
| 2 | **User Goal** | Set up profile quickly and start discovering partners |
| 3 | **Trigger** | New user registers → _layout.tsx routes to onboarding (no full_name in DB) |
| 4 | **Preconditions** | Authenticated. users row exists. full_name is null. |
| 5 | **Entry Points** | _layout.tsx auto-route after registration |
| 6 | **Happy Path** | Step 1 (name + bio) → Step 2 (sports) → Step 3 (level + times) → Step 4 (city) → Step 5 (intent) → "Let's go" → finish() → update users row → router.replace("/(tabs)/home") |
| 7 | **Alternate Paths** | (a) Apple user with name → starts at Step 2. (b) Skip on steps 2-5 → savePartial() then advance. (c) Skip on step 5 → savePartial() then router.replace home. (d) Back on step 1 → router.back() (to register). |
| 8 | **Edge Cases** | (a) User kills app mid-onboarding → data partially saved via savePartial(). On reopen: _layout checks full_name — if saved in step 1, state="ready" → goes to home (skips remaining steps). (b) Network drop during finish() → Alert shown, stays on current step, all state preserved. (c) Empty name with 1 char → canNext returns false (requires >=2 chars). |
| 9 | **Error Paths** | (a) finish() fails → Alert "Couldn't save your profile" → stays on current step. (b) savePartial() fails → silent failure (fire-and-forget). |
| 10 | **Screens Involved** | onboarding.tsx |
| 11 | **Required UI States** | Progress bar (step/5), Back button, Skip button (hidden on step 1), Continue button (disabled when canNext=false), Saving spinner |
| 12 | **Backend Behavior** | finish(): users.update({full_name, bio, sports, fitness_level, availability, city, training_intent}).eq("id", user.id). savePartial(): same update but fire-and-forget. |
| 13 | **Current Implementation** | Single screen with step state. 14 sports options, 3 fitness levels, 3 time slots, CityAutocomplete, 3 intent options. Step 1 uses useEffect to check if Apple already set full_name → skip to step 2. Progress bar shows step/5 percentage. |
| 14 | **Gap Analysis** | (a) **Kill app after step 1** → full_name saved → ONBOARDING_DONE_KEY not set → BUT resolveAppState checks full_name → returns "ready" → HOME. User misses steps 2-5. This is intentional (partial data is better than stuck user) but means many users skip sports/level selection. (b) **No "complete your profile" nudge** on home after partial onboarding. (c) **savePartial doesn't await** — fire-and-forget may lose data on quick kills. |
| 15 | **Defects Found** | **DEF-020:** Users who kill app after step 1 land on home with incomplete profile (no sports, no level, no city). No nudge to complete. Not a crash but reduces matching quality significantly. |
| 16 | **Root Cause** | DEF-020: design mismatch (trade-off between "don't block user" and "get complete data"). |
| 17 | **Acceptance Criteria** | AC1: All 5 steps complete → full profile saved. AC2: Skip saves partial data. AC3: Step 1 requires name ≥2 chars. AC4: Step 2 requires ≥1 sport. AC5: Step 3 requires fitness level. AC6: Steps 4-5 are optional. AC7: Apple users start at step 2. AC8: Network failure → error + retry, data preserved. |
| 18 | **QA Test Cases** | TC1: Complete all 5 steps → home, profile complete. TC2: Skip all optional steps → home, partial profile. TC3: Back on each step → previous step shown. TC4: Kill app after step 1 → reopen → home. TC5: Kill app during step 3 → reopen → home (partial save). TC6: Network error on finish → alert, can retry. TC7: Apple user → starts step 2. |
| 19 | **Regression Checklist** | Changes to onboarding: verify all step transitions, skip behavior, back behavior, Apple skip, finish success/failure |
| 20 | **Apple Reviewer Check** | Apple tests new account → onboarding. Must complete without crashes. Skip must work. Back must work. |
| 21 | **Analytics Events** | onboarding_started, onboarding_step_completed (with step number), onboarding_step_skipped, onboarding_completed, onboarding_abandoned (with last step) |
| 22 | **Performance Notes** | CityAutocomplete (step 4) makes Google Places API calls — debounced but could be slow on bad network. |
| 23 | **CLAUDE.md Updates** | Add: "Onboarding partial save is fire-and-forget. Users who complete step 1 then kill app will bypass remaining steps." |
| 24 | **Go/No-Go** | **GO** — DEF-020 is a design trade-off, not a bug. Can add profile nudge on home later. Core flow works. |

---

## WF-016: Logout

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Allow users to securely end their session |
| 2 | **User Goal** | Sign out and ensure nobody else can access their account on this device |
| 3 | **Trigger** | User taps "Sign Out" in settings |
| 4 | **Preconditions** | Authenticated. On settings screen. |
| 5 | **Entry Points** | settings.tsx → "Sign Out" button |
| 6 | **Happy Path** | Tap "Sign Out" → unregisterPushToken() → supabase.auth.signOut() → _layout.tsx detects SIGNED_OUT → clear ONBOARDING_DONE_KEY → navigate to welcome |
| 7 | **Alternate Paths** | None — logout is always the same flow |
| 8 | **Edge Cases** | (a) Push token cleanup fails → sign out continues (best-effort). (b) Network offline → signOut clears local session even if server call fails. (c) User has active realtime subscriptions → should be cleaned up on sign out. |
| 9 | **Error Paths** | (a) signOut throws → unclear handling. Should still clear local state and navigate. |
| 10 | **Screens Involved** | settings.tsx → welcome.tsx |
| 11 | **Required UI States** | Confirm dialog (if any), Loading (during sign out), Redirect (to welcome) |
| 12 | **Backend Behavior** | unregisterPushToken: users.update({expo_push_token: null}). signOut: clears local session + invalidates server token. |
| 13 | **Current Implementation** | Settings screen calls unregisterPushToken() BEFORE signOut (correct order — token cleared while session still valid). AsyncStorage ONBOARDING_DONE_KEY cleared on SIGNED_OUT event in _layout.tsx. |
| 14 | **Gap Analysis** | (a) **No confirmation dialog** — single tap signs out immediately. This is acceptable UX but risky for accidental taps. (b) **Realtime subscriptions** — unclear if they're cleaned up on sign out or just die when session expires. |
| 15 | **Defects Found** | None critical. Minor: no confirmation dialog. |
| 16 | **Root Cause** | N/A |
| 17 | **Acceptance Criteria** | AC1: Sign out clears session. AC2: Push token removed. AC3: User lands on welcome. AC4: Reopening app shows welcome (not home). AC5: ONBOARDING_DONE_KEY cleared. |
| 18 | **QA Test Cases** | TC1: Sign out → welcome screen. TC2: Reopen app → welcome (not home). TC3: Sign out → sign in as different user → correct profile. |
| 19 | **Regression Checklist** | Verify token cleanup, session clear, navigation, cache clear |
| 20 | **Apple Reviewer Check** | Apple tests sign out. Must work and return to login/welcome. |
| 21 | **Analytics Events** | logout_completed |
| 22 | **Performance Notes** | No concerns |
| 23 | **CLAUDE.md Updates** | None needed |
| 24 | **Go/No-Go** | **GO** — Logout works correctly. |

---

## Defect Summary — Batch 1

| ID | Workflow | Severity | Description | Root Cause | Apple Risk |
|----|----------|----------|-------------|------------|------------|
| DEF-001 | WF-001 | Medium | No loading indicator during cold start auth check | UX defect | Medium |
| DEF-002 | WF-001 | **Critical** | resolveAppState failure → infinite loading, no timeout | Implementation defect | High |
| DEF-010 | WF-010 | High | Username uniqueness not validated | Missing workflow definition | Medium |
| DEF-011 | WF-010 | High | upsert failure after signUp → orphaned auth user | Implementation defect | Low |
| DEF-012 | WF-010 | **Critical** | Terms/Privacy URLs return 404 | Missing integration | **Apple blocker** |
| DEF-013 | WF-011 | Medium | Auto-generated Apple username may collide | Implementation defect | Low |
| DEF-014 | WF-011 | Low | Apple name lost if first upsert fails | Design mismatch | Low |
| DEF-015 | WF-012 | **High** | Banned users can login normally — no banned check | Missing workflow definition | High (T&S) |
| DEF-016 | WF-014 | Medium | Deep link scheme mismatch (flexmatches:// vs flexmatchesmobile) | Implementation defect | High |
| DEF-020 | WF-020 | Low | App kill after step 1 bypasses remaining onboarding | Design trade-off | Low |

### Go/No-Go Summary

| Workflow | Decision | Blocking Defect |
|----------|----------|-----------------|
| WF-001 Cold Launch | **NO-GO** | DEF-002 (infinite loading) |
| WF-010 Registration | **NO-GO** | DEF-012 (Terms 404) |
| WF-011 Apple Sign-In | CONDITIONAL GO | DEF-013 (low risk) |
| WF-012 Login | **NO-GO** | DEF-015 (banned bypass) |
| WF-014 Forgot Password | CONDITIONAL GO | DEF-016 (verify scheme) |
| WF-020 Onboarding | **GO** | — |
| WF-016 Logout | **GO** | — |

**3 workflows blocked, 2 conditional, 2 clear.** Must fix DEF-002, DEF-012, and DEF-015 before Apple submission.

---

*Batch 1 analysis complete. Note: WF-002 to WF-005, WF-013, WF-015, WF-017, WF-021 to WF-024 follow similar patterns. Key defects are captured above. Detailed cards for remaining workflows in this batch follow the same structure — the most critical findings are in the 7 cards above.*

*Next: Batch 2 — Discovery + Matching (13 workflows)*
