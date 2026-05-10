# FlexMatches Mobile — CODE_QUALITY.md

Always-on quality bar for the iOS/Android app. Loaded via `CLAUDE.md` (`@CODE_QUALITY.md`).

This file defines **how we work**, not what we're building. Story-specific rules live in CLAUDE.md and JIRA. This file applies to **every** change, every PR, every commit.

---

## 1. Quality Gates (must pass before "done")

Every change must pass all of the following locally before commit:

| Gate | Command | Pass criteria |
|------|---------|---------------|
| Type check | `npx tsc --noEmit` | 0 errors |
| Lint | `npx expo lint` | 0 errors, 0 warnings on touched files |
| Expo doctor | `npx expo-doctor` | 17/17 green |
| Manual smoke | `npx expo start` → load on iOS + Android | App opens, touched screen renders in light + dark |
| Git status | `git status` | No accidental binaries, no `.env`, no `node_modules` diff |

If any gate fails, the change is **not done** — fix it before opening a PR.

---

## 2. TypeScript Standards

- **Strict mode is non-negotiable.** Never disable `strict`, `noImplicitAny`, or `strictNullChecks` in `tsconfig.json`.
- **No `any`.** Use `unknown` and narrow, or define the proper type. Acceptable exceptions: third-party type holes (must include a `// TODO: type this — <reason>` comment).
- **No `@ts-ignore`.** Use `@ts-expect-error` with a one-line justification if absolutely required.
- **Prefer `type` over `interface`** for non-class shapes; use `interface` only when extending or for class contracts.
- **Exhaustive switch on unions** — use a `never` default to catch missing cases at compile time.
- **No `as` casts** unless narrowing from `unknown` or asserting a Supabase row shape that can't be inferred. Document why.
- **Function signatures**: parameters and return types are explicit on all exported functions and hooks.

---

## 3. React Native / Expo Conventions

- **Theme tokens only.** No inline hex colors. Every screen starts with `const { theme } = useTheme(); const c = theme.colors;`. See CLAUDE.md → Design System.
- **Both themes verified.** Every visual change is checked in light **and** dark before "done".
- **No `StyleSheet.create` with hardcoded colors.** Use the theme inside the component or pass tokens through.
- **Components are pure for visuals, hooks own data.** Tab/screen files orchestrate; UI lives in `components/`.
- **No direct `Alert.alert` for non-destructive errors** — use the toast pattern. Reserve `Alert` for destructive confirmations (unmatch, delete, sign out).
- **Lists**: always provide `keyExtractor`. Prefer `FlatList`/`SectionList` over `.map()` for >10 items.
- **Images**: use `expo-image` with `contentFit` set explicitly. Never raw `<Image source={{ uri }} />` without dimensions.
- **Navigation**: route via `expo-router` only — no manual `react-navigation` `navigate()` calls.
- **Side effects**: every `useEffect` has a clear cleanup or a comment explaining why none is needed. Subscriptions (Supabase realtime, listeners) **must** unsubscribe.
- **Accessibility**: every interactive element has `accessibilityLabel` and `accessibilityRole`. Icon-only buttons must label what they do.

---

## 4. Supabase / Data Rules

- **Always check `error` before mutating local state.** Pattern in CLAUDE.md → Coding Standards.
- **Never trust client-side admin checks.** Admin operations route through Edge Functions (see Compliance Rule #3).
- **Sanitize user input** going into `.or()` PostgREST filters via `sanitizeILike()` (CLAUDE.md → Search Sanitization).
- **Use the documented column names** — see CLAUDE.md → Column traps. `exercise_type` not `workout_type`, `accepted` not `matched`, `sender_id`/`receiver_id` not `user1_id`/`user2_id`.
- **Streaks/atomic counters via RPC** (DEC-003). Never read-modify-write from the client.
- **Realtime subscriptions** must filter by user/match (Compliance Rule #6).
- **No PII in logs.** `console.error` is fine for diagnostics; never log emails, tokens, or location coordinates.

---

## 5. Error Handling — Required Patterns

Use the patterns in CLAUDE.md verbatim:

- **Screen load** → `loading` / `error` / data states with `<Skeleton />` and `<ErrorState onRetry />`.
- **Async button** → `submitting` guard, spinner, disabled state, error toast on failure, no UI mutation if the request fails.
- **Destructive action** → `Alert.alert` with Cancel (default) and a `style: "destructive"` confirmation.
- **Pull-to-refresh failure** → keep existing data, show toast (DEC-005). Never replace visible content with `<ErrorState>` on refresh.

If a new pattern is needed, add it to CLAUDE.md → Coding Standards before using it across the codebase.

---

## 6. Performance

- **No N+1 queries from the client.** Use RPC + LATERAL joins (`get_inbox`, `get_home_data` patterns).
- **Pagination** for any list that can grow past ~40 items (cursor-based, see FM-803).
- **Memoize** expensive renders: `useMemo` for derived data, `React.memo` for list rows, `useCallback` for handlers passed to memoized children.
- **Avoid re-rendering whole tabs on focus.** Use `useFocusEffect` selectively (FM-904 pattern).
- **No synchronous heavy work** on the JS thread during gestures — move to `react-native-reanimated` worklets if it blocks 60fps.

---

## 7. Security & Privacy (must respect every time)

These are restated from CLAUDE.md → Compliance Rules. Code that violates any of these does not ship:

1. iOS digital purchases via IAP only — never web Stripe.
2. Account deletion goes through the `delete-account` Edge Function (auth user must be deleted).
3. Admin actions go through `admin-action` Edge Function with server-side `is_admin` check.
4. `.or()` filter input is sanitized.
5. Push tokens are unregistered before `signOut()`.
6. Realtime subscriptions filter by `match_id`/`user_id`.
7. Location is never written without explicit consent.
8. Legal text is a real tappable link, not plain copy.

---

## 8. Acceptance Criteria — How We Write Them

Every story (in JIRA, in CLAUDE.md, in PR description) uses **Given/When/Then**:

```
AC1: Given <precondition>, When <action>, Then <observable result>
AC2: Given <precondition>, When <action>, Then <observable result>
...
```

Each AC must be:

- **Observable** — a tester can verify it without reading code.
- **Atomic** — one behavior per AC. If you say "and", split it.
- **Negative-path included** — at least one AC covers the failure / empty / offline case.
- **State-grounded** — name the screen, the button, the table, the field. No "the user does the thing".
- **DB-verifiable when state changes** — if a row changes, the AC says which row and which column.

A story without ACs is not ready to start. ACs without a failure-path AC are not complete.

---

## 9. Definition of Done (applies to EVERY story)

A change is **done** when **all** of the following are true. Copy this checklist into the PR description and check each box.

**Behavior**
- [ ] All Given/When/Then ACs verified manually
- [ ] Happy path tested
- [ ] Failure path tested (network off, server error, empty result)
- [ ] Loading, success, and error states all exist
- [ ] Destructive actions show a confirmation dialog with Cancel as default
- [ ] Idempotent — double-tap/double-submit does not duplicate the action

**Code quality**
- [ ] `tsc --noEmit` clean
- [ ] `expo lint` clean on touched files
- [ ] `expo-doctor` 17/17 green
- [ ] No `console.log` left behind (use `console.error` for diagnostics only)
- [ ] No commented-out blocks of code
- [ ] No new `any`, `@ts-ignore`, or `as` casts without justification
- [ ] No new hardcoded hex colors — all from `useTheme()`

**UI**
- [ ] Verified on iOS simulator
- [ ] Verified on Android emulator
- [ ] Light mode looks correct
- [ ] Dark mode looks correct
- [ ] Keyboard does not cover inputs/buttons
- [ ] Accessibility labels on every interactive element
- [ ] Touch targets ≥ 44×44 px

**Data**
- [ ] Supabase `error` is checked before any local state mutation
- [ ] DB row state verified after the action (read it back; don't trust the optimistic update)
- [ ] No PII logged
- [ ] Subscriptions/listeners are cleaned up

**Process**
- [ ] Commit message follows `[FM-XXX] short description` (CLAUDE.md → Commit Convention)
- [ ] PR description includes the story link, the ACs, and this DoD checklist
- [ ] Story-specific DoD items from CLAUDE.md story spec are also checked

If any box is unchecked, the change is **not done** — finish it or break the remaining work into a follow-up story.

---

## 10. Code Review Checklist (for the reviewer)

The reviewer signs off only after verifying:

- [ ] The PR description has the AC list and the DoD checklist completed
- [ ] Diff stays inside `FlexMatchesMobile/` — nothing leaks into the monorepo `apps/mobile/` skeleton
- [ ] No new dependency added without a one-line justification in the PR
- [ ] No new top-level state, context, or theme token without justification
- [ ] Patterns match CLAUDE.md (error handling, async button, theme usage)
- [ ] Tests / smoke verification described in PR matches what the AC requires
- [ ] No security/compliance rule violated (CLAUDE.md → Compliance Rules)
- [ ] Reviewer pulled the branch and ran the touched screen at least once

A PR that the reviewer can't load and click is not reviewable — request a smoke video or screenshots.

---

## 11. When in Doubt

- **CLAUDE.md** is the source of truth for project state, design system, schema, and decisions.
- **CODE_QUALITY.md** (this file) is the source of truth for how code is written and shipped.
- **JIRA / docs/FlexMatches_JIRA_Backlog_v3.xlsx** is the source of truth for what is being worked on.

If these three contradict each other, stop and ask before coding.
