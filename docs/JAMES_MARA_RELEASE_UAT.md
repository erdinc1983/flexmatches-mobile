# James + Mara Release UAT

This file is the shared release standard for FlexMatches mobile. Use it when asking James for CTO review, Mara for QA/UAT review, or another coding agent to continue release hardening.

## Current Release Status

Status: Ready for device UAT, not ready for App Store submission until UAT passes.

Code health gates expected before every release-candidate pass:

- `npx tsc --noEmit` passes with 0 errors.
- `npm run lint` passes with 0 errors and 0 warnings.
- `npx expo export --platform ios` completes cleanly.
- Production SQL/Edge Function changes are deployed and smoke-tested.

Latest architecture expectation:

- Phone verification is server-trusted through the `verify-phone` Edge Function.
- `phone_verified` is not client-writable.
- Referral rewards are applied through `apply_my_referral_rewards()` only.
- Private reward helpers are not callable by `anon`, `authenticated`, or `public`.
- Referral grants are idempotent through the `referral_grants` ledger.
- Referral Pro expires through `pro_expires_at`, `expire_referral_pro()`, pg_cron, and client `isProActive()`.
- Founding Pro remains open-ended for `pro_source = 'founding_member'`.

## James CTO Review Standard

James reviews for release risk, not just whether the code compiles.

James must check:

- Trust boundaries: no client-owned writes for rewards, verification, Pro, admin, or privacy-sensitive data.
- Entitlements: Pro, Founding Pro, referral rewards, badges, and expiry are server-enforced.
- Privacy: exact peer location is never transmitted to other clients.
- Data consistency: onboarding, profile, Home, Discover, Activity, Settings, and referrals agree after refresh/relaunch.
- Error handling: user actions do not silently fail or lose input.
- App Store risk: privacy claims, notification behavior, account deletion, sign-in, and permissions match the product.

James severity:

- P0: Security, privacy, account access, entitlement abuse, crash-on-launch, or App Store rejection blocker.
- P1: Core flow broken, silent data loss, payment/reward mismatch, onboarding/profile inconsistency, or major trust issue.
- P2: Product polish, confusing copy, edge-state UX, layout issues, non-critical inconsistency.
- P3: Nice-to-have cleanup or deferred improvement.

## Mara QA Definition Of Done

Mara signs off only after real behavior is proven. Static review can approve code shape, but device UAT approves the release.

Definition of Done:

- Fresh users can register, onboard, verify phone, discover people, match, chat, create/join circles, check in, and manage settings without hitting dead ends.
- Existing users keep their data after app restart, sign-out/sign-in, and pull-to-refresh.
- Empty, loading, error, offline, and permission-denied states are understandable.
- Rewards and Pro status are truthful in both UI and database.
- No flow depends on Expo Go-only behavior that will differ in TestFlight/App Store builds.

## Device UAT Checklist

Run on a physical iPhone before App Store submission.

### Auth And Onboarding

- Fresh install opens the correct logged-out welcome flow.
- Register with email/password.
- Username uniqueness check works.
- Weak password and mismatched password errors are clear.
- Onboarding name is prefilled from email when possible.
- Onboarding data appears in Profile, Home, and Discover after finish.
- Kill and reopen app; onboarding/profile data persists.
- Sign out returns to welcome.
- Sign back in restores the correct user state.

### Phone Verification

- Request phone verification with a valid phone number.
- Enter valid OTP; profile becomes verified.
- Enter wrong OTP; UI shows a clean incorrect-code error.
- Try duplicate phone; UI shows "already in use."
- Kill app during OTP step and resume.
- Turn off network during verification; UI shows recoverable network error.
- Confirm direct client writes to `phone_verified` are blocked by DB trigger.
- Confirm verified phone cannot be changed without re-verification.

### Referral Rewards

- Register a new user using a referral code.
- Referral appears as Pending for the referrer.
- Complete onboarding for the referred user.
- Verify phone for the referred user.
- Referral changes from Pending to Counted.
- 1 counted referral grants the first referral badge exactly once.
- 3 counted referrals grants 3 months Pro exactly once.
- 6 counted referrals extends Pro by 6 months exactly once.
- Re-run reward RPC; no duplicate `referral_grants` rows appear.
- Duplicate phone does not count toward referral rewards.
- Expired referral Pro disappears after cron or forced expiry test.
- Founding Pro remains active and does not expire.

### Home, Activity, And Streak

- Home primary CTA reads as Check In.
- Check In updates streak immediately.
- Activity workout log updates streak and feed.
- Kill and reopen app; streak remains correct.
- At-gym toggle updates UI and expires as expected.
- Network-off during check-in shows an error instead of fake success.

### Discover And Privacy

- Discover list loads with real users.
- Swipe like/pass works.
- Undo works.
- Filters work, including max distance.
- Miles setting shows miles in Discover reasons and filter labels.
- Map shows own marker precisely and peer markers fuzzed.
- Peer exact lat/lng never appears in client-selected profile data.
- Male/female fallback avatars match selected gender across Home, Discover, grid, swipe, and profile sheet.
- Long profiles scroll inside the profile sheet.

### Matches, Chat, And Sessions

- Send match request.
- Accept and decline incoming request.
- Accepted match opens chat.
- Send message.
- Network-off during message send does not silently lose draft.
- Propose session.
- Accept session.
- Mark done shows "waiting for partner" when only one side confirmed.
- Both sides confirming completes the session.
- Past session dates are rejected.

### Notifications

- Notification badge appears only when unread notifications exist.
- Notification screen is not empty when badge is visible.
- Tapping message notification opens existing chat.
- Tapping orphan message notification cleans it and routes safely.
- Notification preferences persist after app restart.
- Disabled notification types are not sent.

### Circles And Events

- Browse circles.
- Join and leave circle.
- Creator can edit/delete their own circle.
- Circle events with upcoming dates surface on Home.
- Create event with map location search.
- Recurrence copy clearly says label-only/manual repeat.
- Recurrence does not imply automatic event creation.

### Settings And Account

- Units setting persists.
- Theme setting persists.
- Privacy settings persist.
- Phone verification status persists.
- Delete account succeeds or shows a clear recoverable error.
- After delete account, app returns to welcome and old notifications/chats do not strand the user.

## App Store Go / No-Go

Go only when:

- All P0 and P1 items are closed.
- Device UAT passes on a physical iPhone.
- Privacy policy matches actual behavior.
- Account deletion works.
- Permission-denied states are clear.
- No reward, Pro, or verification path depends on client trust.
- TestFlight build behaves the same as Expo Go for tested flows.

No-go if:

- A user can grant themselves Pro, badges, phone verification, or referral credit.
- A user can see another user's exact peer location.
- Onboarding data does not sync to Profile/Home/Discover.
- Any core action silently fails while showing success.
- Notifications route to dead screens without recovery.
- Pro/referral copy promises rewards that the database does not enforce.

## Known Deferred Items

These are allowed to wait unless they block UAT:

- Founding Pro boundary race near the 1000-user cap. Before approaching the cap, replace count-based trigger logic with an atomic counter row using `SELECT ... FOR UPDATE`.
- Fully automatic recurring event expansion. Current recurrence is label-only/manual date advancement.
- Broader abuse signals beyond phone verification, such as device/IP heuristics, if referral abuse appears after launch.

## Bug Report Template

Use this format for every UAT bug:

```text
Screen:
User/account:
Steps:
Expected:
Actual:
Severity:
Network state:
Device/build:
Screenshot/video:
Database proof, if relevant:
```

