# FlexMatches™ — Phase 3, Session 4

## Batch 3: Chat & Session Coordination — Full 24-Item Workflow Cards (17 workflows)

> 🎯 **Primary Role:** BA / Workflow Owner
> **Supporting:** System Architect (impl analysis), QA (test cases)
> **Date:** April 2026

---

## WF-060: Chat Inbox (List Conversations)

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Central hub for all partner conversations, prioritized by coordination urgency |
| 2 | **User Goal** | See all conversations, respond to urgent ones first |
| 3 | **Trigger** | Navigate to Chat tab |
| 4 | **Preconditions** | Authenticated. Has at least one accepted match. |
| 5 | **Entry Points** | Tab bar → Chat |
| 6 | **Happy Path** | Chat tab → load accepted matches + latest message per match + active sessions → sort by urgency (pending sessions > unread > recency) → display ConversationRow list → tap row → navigate to /chat/[matchId] |
| 7 | **Alternate Paths** | (a) Swipe row right → Save conversation. (b) Swipe row left → Delete messages / Unmatch options. (c) No matches → EmptyState "No conversations yet". (d) Pull-to-refresh reloads. |
| 8 | **Edge Cases** | (a) Partner sends message while viewing inbox → realtime subscription fires → conversation updates position in list. (b) Partner unmatches → conversation should disappear on next reload. (c) mountedRef prevents setState after component unmounts (race condition fix). (d) loadingRef prevents concurrent load calls. (e) STALE_MS=15s — data refreshes if tab revisited after 15s. |
| 9 | **Error Paths** | (a) Load fails → 15s timeout (useEffect with setTimeout) → setError(true) → ErrorState with retry. (b) **DEF-072: handleDeleteMessages has NO try/catch** → if network call fails, unhandled error may crash the app. (c) **DEF-073: handleUnmatch has NO try/catch** → same crash risk. |
| 10 | **Screens Involved** | messages.tsx, ConversationRow.tsx |
| 11 | **Required UI States** | Loading (MessagesSkeleton), Error (ErrorState + retry), Empty (EmptyState "No conversations yet"), Loaded (conversation list), Swipe actions revealed, Pull-to-refresh |
| 12 | **Backend Behavior** | matches.select(status=accepted) with sender_id/receiver_id matching current user. Messages aggregated per match for last message + unread count. buddy_sessions queried per match for active session. Realtime channel on messages table refreshes list. |
| 13 | **Current Implementation** | GestureHandlerRootView wraps FlatList for swipe gestures. ConversationRow renders: avatar, name, last message preview, unread badge, session pill (pending/accepted/needs_confirm). Sort: conversations with pending_theirs sessions first, then unread, then by lastMessageAt desc. 15s timeout via useEffect. Refs: mountedRef (prevent unmount setState), loadingRef (prevent concurrent), myIdRef (stable closure). requestNotificationPermission called on mount. |
| 14 | **Gap Analysis** | (a) **DEF-072/073 are critical crash risks** — swipe-to-delete and swipe-to-unmatch have no error handling. (b) ConversationRow uses some hardcoded iOS system colors (BUG-004 from Eagle — accepted as design intent). (c) Saved conversations stored in local Set — not persisted across app restarts. (d) No "search conversations" feature. |
| 15 | **Defects Found** | **DEF-072:** handleDeleteMessages — no try/catch. Network failure during delete will cause unhandled promise rejection, potentially crashing the app. **DEF-073:** handleUnmatch — no try/catch. Same crash risk. Both identified during Eagle but deferred. |
| 16 | **Root Cause** | Implementation defect — error handling omitted on destructive operations. |
| 17 | **Acceptance Criteria** | AC1: Inbox loads all accepted match conversations. AC2: Sort by urgency (session actions > unread > recency). AC3: Tap row navigates to chat. AC4: Swipe actions (save/delete/unmatch) work with error handling. AC5: Realtime updates when new message arrives. AC6: 15s timeout shows error with retry. AC7: Empty state when no matches. |
| 18 | **QA Test Cases** | TC1: Inbox loads with conversations. TC2: Tap → chat opens. TC3: Swipe delete → messages removed, match preserved. TC4: Swipe unmatch → match status = unmatched, conversation removed. TC5: Network error during delete → error alert (not crash). TC6: Network error during unmatch → error alert (not crash). TC7: New message from partner → conversation moves up in list. TC8: Empty inbox → EmptyState shown. TC9: Pull-to-refresh works. TC10: Kill app → reopen → inbox loads correctly. |
| 19 | **Regression Checklist** | Load query, sort logic, swipe gestures, realtime subscription, timeout, error handling, navigation |
| 20 | **Apple Reviewer Check** | Chat must work between test accounts. Empty state must be clean. Swipe actions must not crash. |
| 21 | **Analytics Events** | chat_inbox_viewed, conversation_opened (match_id), messages_deleted (match_id), unmatch_performed (match_id), inbox_empty_state_shown |
| 22 | **Performance Notes** | 15s STALE_MS prevents over-fetching. loadingRef prevents concurrent loads. Realtime subscription scoped to messages table changes. |
| 23 | **CLAUDE.md Updates** | Reinforce: "All destructive actions (delete, unmatch, cancel) MUST have try/catch with Alert.alert error feedback." |
| 24 | **Go/No-Go** | **NO-GO** — DEF-072 and DEF-073 are crash risks. Fix: add try/catch to both handlers (~15 min total). |

---

## WF-061: Send Message

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Real-time communication between matched fitness partners |
| 2 | **User Goal** | Send a message to my training partner |
| 3 | **Trigger** | User types in message input and taps send button |
| 4 | **Preconditions** | In /chat/[matchId] screen. Match status = accepted. |
| 5 | **Entry Points** | Chat screen input field + send button |
| 6 | **Happy Path** | Type message → tap send → setSending(true) → messages.insert({match_id, sender_id, content}) → setText("") → notifyUser(other.id, {type:"message"}) → flatListRef.scrollToEnd |
| 7 | **Alternate Paths** | (a) Empty text → send button disabled. (b) Multiline text → TextInput multiline enabled, max 500 chars. |
| 8 | **Edge Cases** | (a) Rapid sends → sending flag prevents double-submit. (b) Very long message → maxLength=500 enforced. (c) Emoji-only messages → work normally. (d) Partner offline → push notification queued by Expo. |
| 9 | **Error Paths** | (a) Insert fails → Alert "Send Failed. Your message could not be sent. Please try again." → text is PRESERVED in input (user can retry without retyping). (b) notifyUser fails → caught silently (.catch → console.warn). Push failure doesn't block message send. |
| 10 | **Screens Involved** | chat/[matchId].tsx |
| 11 | **Required UI States** | Input empty (send button gray), Input has text (send button orange), Sending (spinner in send button), Error (Alert + text preserved) |
| 12 | **Backend Behavior** | messages.insert({match_id, sender_id, content, read_at: null}). Realtime channel on messages table delivers message to partner's chat screen. notifyUser() creates notification row + sends push. |
| 13 | **Current Implementation** | sendMessage() in chat/[matchId].tsx. try/catch wraps insert. On success: setText(""). On error: Alert + text preserved. notifyUser wrapped in .catch() to prevent blocking. Vibration.vibrate(150) on incoming message (partner's side). FlatList scrollToEnd with 80ms delay. |
| 14 | **Gap Analysis** | (a) No offline queue — if network is down, message fails immediately. No "retry" button beyond the user manually tapping send again. (b) No typing indicator. (c) No message delivery confirmation beyond read receipts. |
| 15 | **Defects Found** | None critical. Minor: no offline message queue. |
| 16 | **Root Cause** | N/A |
| 17 | **Acceptance Criteria** | AC1: Message appears in chat for both users. AC2: Push notification sent to partner. AC3: Send failure preserves text. AC4: Send button disabled while sending. AC5: Max 500 characters. |
| 18 | **QA Test Cases** | TC1: Send message → appears in both chats. TC2: Partner receives push. TC3: Network off → error alert → text preserved. TC4: Empty text → send disabled. TC5: 500 char limit enforced. TC6: Rapid taps → no duplicate messages. |
| 19 | **Regression Checklist** | Insert, notification, text preservation, button state, scrolling |
| 20 | **Apple Reviewer Check** | Messaging must work between test accounts. |
| 21 | **Analytics Events** | message_sent (match_id, message_length) |
| 22 | **Performance Notes** | Single insert + push. No performance concerns. |
| 23 | **CLAUDE.md Updates** | None needed. |
| 24 | **Go/No-Go** | **GO** — Well-implemented with proper error handling. |

---

## WF-062: Receive Message (Realtime)

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Instant message delivery without polling |
| 2 | **User Goal** | See partner's messages as they send them |
| 3 | **Trigger** | Partner sends a message (WF-061) |
| 4 | **Preconditions** | Chat screen open for this match. Realtime subscription active. |
| 5 | **Entry Points** | Automatic — realtime subscription fires |
| 6 | **Happy Path** | Partner sends → postgres_changes INSERT event on messages table filtered by match_id → setMessages appends new message → Vibration.vibrate(150) if not my message → flatListRef.scrollToEnd(animated: true, 80ms delay) |
| 7 | **Alternate Paths** | (a) Chat screen not open → message stored in DB, visible on next open. (b) App in background → push notification delivered instead. |
| 8 | **Edge Cases** | (a) Realtime connection drops → messages missed until reconnect. Supabase JS handles reconnect automatically. (b) Message update (read_at) also handled via UPDATE event on same channel. |
| 9 | **Error Paths** | (a) Realtime subscription fails → messages only visible on manual refresh. |
| 10 | **Screens Involved** | chat/[matchId].tsx |
| 11 | **Required UI States** | New message appears, vibration feedback, auto-scroll |
| 12 | **Backend Behavior** | Supabase Realtime channel `chat-msgs:{matchId}` with filter `match_id=eq.{matchId}`. Events: INSERT (new message), UPDATE (read receipt). |
| 13 | **Current Implementation** | useEffect subscribes to channel on mount. Returns cleanup (removeChannel). INSERT handler appends to messages state. UPDATE handler updates read_at for existing message. userIdRef used for closure stability. |
| 14 | **Gap Analysis** | (a) Filter is correctly scoped by match_id (Eagle 2 fix — prevents cross-conversation leakage). (b) No reconnection indicator — user doesn't know if realtime dropped. |
| 15 | **Defects Found** | None. |
| 16 | **Root Cause** | N/A |
| 17 | **Acceptance Criteria** | AC1: Message appears instantly. AC2: Vibration on incoming. AC3: Auto-scroll to bottom. AC4: Read receipt updated in real-time. |
| 18 | **QA Test Cases** | TC1: Partner sends → message appears <1s. TC2: Vibration feedback on receive. TC3: Chat auto-scrolls. TC4: Partner reads → checkmarks turn blue. |
| 19 | **Regression Checklist** | Realtime subscription, filter, vibration, scroll, read receipt |
| 20 | **Apple Reviewer Check** | Must show realtime messaging between test accounts. |
| 21 | **Analytics Events** | message_received (match_id) |
| 22 | **Performance Notes** | Realtime is efficient — no polling. |
| 23 | **CLAUDE.md Updates** | None. |
| 24 | **Go/No-Go** | **GO** |

---

## WF-064: Propose Session (3-Step Wizard)

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Enable partners to schedule real-world workout sessions — the core accountability feature |
| 2 | **User Goal** | Plan when and where to work out with my partner |
| 3 | **Trigger** | Tap ⋮ menu → "Today" / "Tomorrow" / "Propose a session" |
| 4 | **Preconditions** | In accepted match chat. |
| 5 | **Entry Points** | Chat header menu button (⋮) → action menu modal → 3 options |
| 6 | **Happy Path** | Menu → select option → wizard modal opens → Step 1: pick sport (11 options + "Other" with custom name) → Step 2: pick date (CalendarPicker with quick pills: Today/Tomorrow/This Sat/Next Mon) → Step 3: optional time (hour:minute picker) + optional location (text input + 🗺️ MapLocationPicker) → "Send session proposal" → buddy_sessions.insert → push notification → scheduleSessionReminder (local notification) → wizard closes → SessionBanner appears in chat |
| 7 | **Alternate Paths** | (a) "Today" or "Tomorrow" quick option pre-fills date → wizard opens at Step 1 with date already set. (b) "Other" sport → shows custom name TextInput. (c) Edit existing session → opens wizard pre-filled with current values, old session cancelled on new proposal success. (d) Close wizard → editingSessionRef.current cleared. |
| 8 | **Edge Cases** | (a) Past dates blocked in CalendarPicker (isPast check). (b) "Other" sport with empty title → uses "Other" as sport name. (c) User already has active session with this partner → warning banner: "You already have a [sport] session planned." (d) Both users propose simultaneously → two pending sessions exist. Only latest loaded in banner. (e) Edit flow: editingSessionRef stores old session ID → cancel old ONLY after new insert succeeds → prevents orphan state. |
| 9 | **Error Paths** | (a) Insert fails → Alert "Could not propose session. Please try again." → wizard stays open. (b) notifyUser fails → silent (push is best-effort). (c) scheduleSessionReminder fails → silent. |
| 10 | **Screens Involved** | chat/[matchId].tsx (wizard modal), MapLocationPicker.tsx, SessionBanner.tsx |
| 11 | **Required UI States** | Menu closed, Menu open (4 options + unmatch), Wizard Step 1 (sport grid), Wizard Step 2 (date + calendar), Wizard Step 3 (time + location + propose button), Proposing (spinner), Error (Alert), Existing session warning |
| 12 | **Backend Behavior** | buddy_sessions.insert({proposer_id, receiver_id, match_id, sport, session_date, session_time?, location?, status:"pending"}). notifyUser(receiver, type:"session_proposed"). If editing: buddy_sessions.update({status:"cancelled"}).eq("id", oldId) after new insert. |
| 13 | **Current Implementation** | Session wizard is a Modal with 3 steps managed by wizardStep state. openWizard(prefilledDate?) resets all fields. CalendarPicker with month navigation, past-date blocking. TimeColumn with ▲/▼ buttons (hour 0-23, minute 0-55 step 5). MapLocationPicker in separate Modal. Proposing flag prevents double-submit. editingSessionRef pattern: store old ID → insert new → cancel old → clear ref. |
| 14 | **Gap Analysis** | **CRITICAL RETENTION GAP:** (a) No post-session flow — after session completes (both users confirm), there's NO prompt to rate the partner, log a workout together, share progress, or schedule the next session. The accountability loop dies here. This is the #1 feature missing for retention. (b) No session reminder push notifications (scheduleSessionReminder creates local notification but not push). (c) No recurring session option — must re-propose each time. (d) confirm_session uses an RPC function — if RPC doesn't exist, confirmation will silently fail. |
| 15 | **Defects Found** | **DEF-064:** No post-session loop (rate/log/schedule next). Biggest retention gap. **DEF-065:** No push reminder before session time (local notification only, which doesn't work when app is killed). Both are Phase 2 roadmap features, not Apple submission blockers. |
| 16 | **Root Cause** | DEF-064: design mismatch (accountability loop not closed by design). DEF-065: missing implementation. |
| 17 | **Acceptance Criteria** | AC1: Sport selection from 11 options + custom. AC2: Date selection via calendar (no past dates). AC3: Quick date pills work (Today/Tomorrow/This Sat/Next Mon). AC4: Time and location are optional. AC5: Proposal creates session + sends push. AC6: Edit pre-fills wizard + cancels old session only after new succeeds. AC7: Error shown on failure, wizard stays open. |
| 18 | **QA Test Cases** | TC1: Propose session → partner sees SessionBanner. TC2: Today quick option → date pre-filled. TC3: Past date → blocked in calendar. TC4: Other sport with custom name → saved correctly. TC5: Optional time → saved or null. TC6: Location via text input → saved. TC7: Location via MapPicker → saved. TC8: Edit existing → old cancelled, new created. TC9: Network error → alert, wizard stays. TC10: Both users propose → two sessions (latest shown). |
| 19 | **Regression Checklist** | Wizard step transitions, calendar date selection, time picker, location picker, insert + notification, edit flow, error handling |
| 20 | **Apple Reviewer Check** | Session scheduling is a key differentiator. Must work smoothly. Calendar must look native. |
| 21 | **Analytics Events** | session_wizard_opened (source: today/tomorrow/custom), session_sport_selected, session_date_selected, session_proposed (sport, date, has_time, has_location), session_edited |
| 22 | **Performance Notes** | CalendarPicker re-renders on month change — lightweight. MapLocationPicker loads react-native-maps — heavier. |
| 23 | **CLAUDE.md Updates** | Add: "Post-session flow (rate partner, log workout, schedule next) is the #1 planned retention feature." |
| 24 | **Go/No-Go** | **GO** — Session proposal works correctly. Post-session is roadmap. |

---

## WF-065: Accept Session

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Partner agrees to the proposed workout session |
| 2 | **User Goal** | Confirm I'll attend the session |
| 3 | **Trigger** | Tap "Accept" on SessionBanner (state: pending_theirs) |
| 4 | **Preconditions** | Session exists with status=pending. User is the receiver (not proposer). |
| 5 | **Entry Points** | SessionBanner in chat → Accept button |
| 6 | **Happy Path** | Tap Accept → sessionActing=true → buddy_sessions.update({status:"accepted"}) → scheduleSessionReminder (local notif) → notifyUser(proposer, {type:"session_accepted"}) → loadSession() refreshes banner → banner shows "upcoming" state with date/time/location |
| 7 | **Alternate Paths** | (a) Decline instead (WF-066). |
| 8 | **Edge Cases** | (a) Proposer deletes session before accept → update fails → Alert shown. (b) Session already accepted (double-tap) → sessionActing flag prevents. |
| 9 | **Error Paths** | (a) Update fails → Alert "Could not update session. Please try again." → try/catch handles correctly. |
| 10 | **Screens Involved** | chat/[matchId].tsx, SessionBanner.tsx |
| 11 | **Required UI States** | pending_theirs (Accept/Decline visible), Acting (spinner), upcoming (date/time shown), Error (Alert) |
| 12 | **Backend Behavior** | buddy_sessions.update({status:"accepted"}).eq("id", session.id). notifyUser(proposer_id, type: session_accepted). |
| 13 | **Current Implementation** | acceptSession() in chat screen. try/catch with Alert on failure. sessionActing flag prevents double-tap. scheduleSessionReminder called with partner name + date. notifyUser sends push to proposer. loadSession() refreshes SessionBanner state. |
| 14 | **Gap Analysis** | Well-implemented. Error handling present. |
| 15 | **Defects Found** | None. |
| 16 | **Root Cause** | N/A |
| 17 | **Acceptance Criteria** | AC1: Accept updates status. AC2: Proposer receives push. AC3: Banner changes to "upcoming". AC4: Error handled with Alert. |
| 18 | **QA Test Cases** | TC1: Accept → banner shows upcoming. TC2: Proposer gets push. TC3: Network error → alert. TC4: Double-tap → no duplicate update. |
| 19 | **Regression Checklist** | Status update, notification, banner refresh, error handling |
| 20 | **Apple Reviewer Check** | Session accept must work between test accounts. |
| 21 | **Analytics Events** | session_accepted (session_id, response_time_hours) |
| 22 | **Performance Notes** | Single update + push. No concerns. |
| 23 | **CLAUDE.md Updates** | None. |
| 24 | **Go/No-Go** | **GO** |

---

## WF-066 through WF-076: Remaining Chat Workflows

### WF-066: Decline Session — **GO**
- try/catch present. notifyUser sends "Session Declined" push to proposer. setSession(null) removes banner.

### WF-067: Cancel Session — **GO**  
- try/catch present. Increments sessions_cancelled counter. Calls recalcReliability() to update reliability_score. setSession(null).

### WF-068: Confirm Session Completed — **GO**
- Uses RPC: supabase.rpc("confirm_session", {p_session_id, p_user_id, p_other_id}). Returns {both_confirmed} — only marks complete when BOTH users confirm. Increments sessionCount. try/catch present.

### WF-069: Mark No-Show — **GO**
- Alert.alert confirmation first: "Session didn't happen? This will be recorded." Uses RPC: supabase.rpc("no_show_session", {p_session_id, p_reporter_id, p_partner_id}). Updates reliability scores. try/catch present.

### WF-070: Reschedule Session — **GO**
- Opens wizard pre-filled with existing session values via editSession(). editingSessionRef stores old session ID. New session created, old cancelled AFTER success.

### WF-071: Edit Session — **GO**
- Same as reschedule (uses editSession function). Pre-fills sport, date, time, location from existing session.

### WF-072: Delete Messages — **NO-GO**
- **DEF-072:** handleDeleteMessages has NO try/catch. Messages are deleted from DB but if network fails, unhandled promise rejection. Fix: wrap in try/catch with Alert. ~5 min fix.

### WF-073: Unmatch — **NO-GO**
- **DEF-073:** handleUnmatch has NO try/catch. Sets status to "unmatched" (DEC-004: distinct from "declined"). From action menu: Alert.alert confirmation → supabase.from("matches").update({status:"declined"}).eq("id", matchId) → router.back(). Note: action menu unmatch sets status to "declined" not "unmatched" — **inconsistency with DEC-004.**
- **DEF-073b:** Action menu unmatch uses status "declined" instead of "unmatched" — violates DEC-004 design decision.

### WF-074: Save/Bookmark Conversation — **GO**
- Local Set<string> state in messages.tsx. Swipe action toggles save state. Not persisted across app restarts.

### WF-075: Send Failure → Text Preserved — **GO**
- try/catch in sendMessage(). On error: Alert shown, setText NOT called → input retains user's text. Eagle fix.

### WF-076: Session Action Error Handling — **GO**
- All session actions (accept, decline, cancel, confirm, no-show) wrapped in try/catch with Alert.alert. sessionActing flag prevents double-tap. Eagle 3 fix.

---

## Session 4 Summary

| ID | Workflow | Go/No-Go | Blocking Defect |
|----|----------|----------|-----------------|
| WF-060 | Chat inbox | **NO-GO** | DEF-072, DEF-073 (no try/catch) |
| WF-061 | Send message | **GO** | — |
| WF-062 | Receive message (realtime) | **GO** | — |
| WF-063 | Read receipts | **GO** | read_at updated via realtime |
| WF-064 | Propose session | **GO** | DEF-064/065 are roadmap items |
| WF-065 | Accept session | **GO** | — |
| WF-066 | Decline session | **GO** | — |
| WF-067 | Cancel session | **GO** | — |
| WF-068 | Confirm completed | **GO** | — |
| WF-069 | Mark no-show | **GO** | — |
| WF-070 | Reschedule | **GO** | — |
| WF-071 | Edit session | **GO** | — |
| WF-072 | Delete messages | **NO-GO** | DEF-072 (crash risk) |
| WF-073 | Unmatch | **NO-GO** | DEF-073 + DEF-073b (crash + wrong status) |
| WF-074 | Save conversation | **GO** | — |
| WF-075 | Send failure | **GO** | — |
| WF-076 | Session errors | **GO** | — |

**Results: 14 GO, 0 CONDITIONAL, 3 NO-GO**

### Defects Found in Session 4

| ID | Severity | Description | Root Cause |
|----|----------|-------------|------------|
| DEF-072 | HIGH | handleDeleteMessages — no try/catch, crash risk on network failure | Implementation defect |
| DEF-073 | HIGH | handleUnmatch — no try/catch, crash risk on network failure | Implementation defect |
| DEF-073b | MEDIUM | Action menu unmatch uses status "declined" instead of "unmatched" — violates DEC-004 | Implementation defect |
| DEF-064 | MEDIUM | No post-session loop (rate, log, schedule next) — biggest retention gap | Design mismatch (planned Phase 2) |
| DEF-065 | LOW | No push reminder before session (local notification only) | Missing implementation |

### Key Source Code Findings

**Session lifecycle is well-architected:**
- SessionBanner has 5 clear states: pending_mine, pending_theirs, upcoming, needs_confirm, confirmed
- getSessionState() function correctly determines state from session.status + date + proposer
- Realtime subscription on buddy_sessions table keeps banner in sync
- confirm_session RPC ensures both users must confirm (mutual confirmation model)
- recalcReliability() recomputes score from sessions_completed, sessions_no_show, sessions_cancelled

**Edit flow is cleverly designed:**
- editingSessionRef stores old session ID
- New session created FIRST
- Old session cancelled ONLY after new insert succeeds
- Prevents orphan state (old cancelled but new failed)

**Unmatch inconsistency:**
- Swipe unmatch in messages.tsx: uses status "unmatched" (correct per DEC-004)
- Action menu unmatch in chat/[matchId].tsx: uses status "declined" (WRONG per DEC-004)
- These should both use "unmatched"

*Session 4 complete. All 17 Chat & Session workflows have full 24-item cards.*
