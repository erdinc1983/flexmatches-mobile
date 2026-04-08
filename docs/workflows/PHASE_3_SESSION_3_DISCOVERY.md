# FlexMatches™ — Phase 3, Session 3

## Batch 2: Discovery & Matching — Full 24-Item Workflow Cards (13 workflows)

> 🎯 **Primary Role:** BA / Workflow Owner
> **Supporting:** System Architect (impl analysis), QA (test cases)
> **Date:** April 2026

---

## WF-040: Discover — Swipe Mode (Like/Pass)

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Core value delivery — help users find compatible fitness partners through intuitive card swiping |
| 2 | **User Goal** | Browse potential partners and connect with compatible ones quickly |
| 3 | **Trigger** | Navigate to Discover tab with swipe mode selected (default mode) |
| 4 | **Preconditions** | Authenticated. Profile exists. users table populated with other users. |
| 5 | **Entry Points** | Tab bar → Discover (defaults to list mode, user switches to swipe via mode toggle) |
| 6 | **Happy Path** | Discover tab → mode toggle to swipe → SwipeDeck loads scored users → swipe right (like) → matches.insert(pending) → if partner already liked you → status=accepted → push notification → chat unlocked in Messages tab |
| 7 | **Alternate Paths** | (a) Swipe left (pass) → passes.insert → card removed, next card shown. (b) Tap card body → ProfileSheet opens with full profile. (c) Tap info button → same ProfileSheet. (d) Tap ❤ button → same as swipe right. (e) Tap ✕ button → same as swipe left. (f) No mutual match → status stays pending, partner sees in their matches tab. |
| 8 | **Edge Cases** | (a) Deck runs out (currentIndex >= users.length) → if loadingMore: show spinner + "Loading more partners…" → if no more: show "You've seen everyone! 🎉" + "Pull to refresh for new matches." (b) onDeckLow fires when remaining cards <= 5 (DECK_LOW_THRESHOLD) → triggers loadMore(). (c) User with no sports → calcMatchScore returns lower score but user still shown. (d) Two users like each other simultaneously → server-side dedup via FM-105 (Eagle 1). (e) Already-matched users excluded via excluded set (matches + passes + blocks). (f) Banned users excluded via .is("banned_at", null) filter. (g) Fast velocity swipe (vx > 0.6 && dx > 50) triggers even without reaching SWIPE_THRESHOLD (100px). |
| 9 | **Error Paths** | (a) load() fails → 30s timeout → setError(true) → ErrorState with "Could not load profiles" + retry button. (b) Like insert fails → silent failure (no try/catch on individual like — user thinks they liked but DB may not have it). (c) Pass insert fails → silent failure (same issue). (d) notifyUser fails → silent (best-effort push). (e) Refresh fails → Alert "Could not refresh. Please try again." + preserves existing data (DEC-005). |
| 10 | **Screens Involved** | discover.tsx (main), SwipeDeck.tsx (card stack), ProfileSheet.tsx (detail modal), DiscoverMap.tsx (map view — separate workflow) |
| 11 | **Required UI States** | Loading (DiscoverSkeleton), Error (ErrorState + retry), Empty deck (two variants: loading more vs all seen), Cards active (swipe + overlays LIKED/NOPE), Undo available (undo button blue vs gray), Profile nudge banner (no sports), Search bar expanded, Filter modal |
| 12 | **Backend Behavior** | Query: users.select(SELECT_FIELDS).neq("id", me).is("banned_at", null).order("created_at", desc).range(0, PAGE_SIZE-1). Parallel queries: matches (mine), passes (mine), blocks (mine). Client-side scoring: calcMatchScore() returns 0-100. Client-side sorting: at_gym first, then by score desc. On like: matches.insert({sender_id, receiver_id, status:"pending"}).select("id").single(). On pass: passes.insert({user_id, passed_id}).select("id").single(). On mutual: server detects accepted status, both users see chat. |
| 13 | **Current Implementation** | SwipeDeck: PanResponder with 6px onMoveShouldSetPanResponder threshold (fixes tap-through, Eagle 4). Animated rotation ±14deg. LIKED/NOPE overlays with opacity tied to pan.x. Background cards scale 0.94→1.0 as top card leaves. SWIPE_DURATION=230ms. commitSwipeRef pattern ensures PanResponder closure always calls latest commitSwipe. 4 action buttons: Undo (conditional blue/gray), Pass (✕), Info (ℹ), Like (sparkle ✦). Match scoring: sports overlap (30pts), level match (20pts), schedule overlap (15pts), recency (20pts), gym bonus (10pts), intent compatibility (15pts), proximity (10pts). buildReasons() generates up to 3 human-readable reason chips. SwipeCardContent: photo with gradient overlay, gym badge, match % pill, name/age/level/city/active overlay, "Why this works" section with reason chips, sport chips, status row (pending/connected). |
| 14 | **Gap Analysis** | (a) **No free like limit** — PRO_FEATURES lists "Unlimited likes per day" implying free has a limit, but no code enforces any limit. All users can like unlimited. (b) **Match reasons not visible in swipe mode** — reasons are in the card info section but require scrolling/reading. In swipe mode, the primary decision is made from the photo + name + score, not the reasons. (c) **Silent failure on like/pass** — if matches.insert or passes.insert fails, no error shown. User thinks they acted but nothing happened in DB. (d) **30s timeout is very long** — users likely leave before 30s. Discover uses 30s vs messages.tsx 15s. (e) **Default view mode is "list" not "swipe"** — despite swipe being described as default in comments, useState defaults to "list". |
| 15 | **Defects Found** | **DEF-040:** Empty state message "You've seen everyone!" and "No matches found" are generic — don't guide user to invite friends, join circles, or expand search radius. Apple reviewer will see this on day 1 with few users. **DEF-041:** Free tier has no like limit enforced — contradicts Pro feature list "Unlimited likes per day." |
| 16 | **Root Cause** | DEF-040: UX defect (missing actionable empty state). DEF-041: missing workflow definition (free tier limits never designed as code). |
| 17 | **Acceptance Criteria** | AC1: Swipe right creates match request (pending) + sends push notification to target user. AC2: Mutual like transitions match to accepted + creates chat in both users' inboxes. AC3: Swipe left adds user to passes table, user not shown again. AC4: Undo reverses last swipe action (removes DB entry, card returns to deck). AC5: Empty state shows actionable CTAs (invite friends, join circles, expand radius). AC6: Free users limited to 10 likes/day with counter visible (future: tied to DEF-145). AC7: Match scoring is deterministic and based on sport/level/schedule/proximity/intent overlap. |
| 18 | **QA Test Cases** | TC1: Swipe right → match request visible in partner's matches tab + push received. TC2: Both users like each other → match accepted → chat appears for both. TC3: Swipe left → user disappears from deck, not shown again on refresh. TC4: Undo after like → match request removed from DB, card returns. TC5: Undo after pass → pass removed from DB, card returns. TC6: Deck exhausted (all users swiped) → empty state displayed. TC7: onDeckLow triggers → new cards loaded seamlessly. TC8: Tap card → ProfileSheet opens. TC9: Tap info button → ProfileSheet opens. TC10: Pull-to-refresh → new users loaded, stale data replaced. TC11: No users in area → empty state with CTAs. TC12: Filter applied → only matching users shown. TC13: Profile nudge banner shown when user has no sports. |
| 19 | **Regression Checklist** | Changes to discover.tsx or SwipeDeck.tsx must verify: (a) PanResponder gesture handling (6px threshold), (b) tap-through to info button works, (c) match creation + notification, (d) pass creation, (e) undo functionality, (f) pagination/loadMore, (g) excluded set (no duplicate users), (h) scoring algorithm output, (i) empty state display, (j) pull-to-refresh |
| 20 | **Apple Reviewer Check** | Apple will navigate to Discover immediately after onboarding. With few users in test environment, they will likely see empty state or very few cards. Empty state MUST NOT look broken. Cards must swipe smoothly. App must not crash if deck is empty. Match scoring should show reasonable values, not 0% for everyone. |
| 21 | **Analytics Events** | discover_tab_viewed (with mode: swipe/list/map), card_swiped (direction: left/right, user_id, match_score), match_request_sent (target_user_id, match_score), mutual_match_created (match_id), undo_action_used (action: like/pass), deck_exhausted (total_swiped), filter_applied (filter_type, filter_value), discover_empty_state_shown, profile_sheet_opened (from: swipe/list), pagination_triggered (offset) |
| 22 | **Performance Notes** | calcMatchScore runs per-user on load — O(n) where n = users count. With PAGE_SIZE=20, this is <50ms. loadMore appends to existing array without re-scoring old entries. InteractionManager.runAfterInteractions defers last_active update after navigation animation. Animated PanResponder uses native driver: false (JS-driven) — may drop frames on older devices. |
| 23 | **CLAUDE.md Updates** | Add: "Free tier users limited to 10 likes per day. Reset at midnight UTC. Track daily_likes_count in client state, verify server-side." Add: "Default discover view mode should match product intent (currently defaults to 'list', comments say 'swipe')." |
| 24 | **Go/No-Go** | **GO** — Core swipe mechanics work correctly. DEF-040 is UX polish (not a crash). DEF-041 is monetization gap (not blocking Apple submission). Both can be fixed in Tier 4. |

---

## WF-041: Discover — List Mode

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Alternative discovery for users who prefer browsing and filtering over swiping |
| 2 | **User Goal** | Scan multiple profiles quickly and connect with interesting ones |
| 3 | **Trigger** | Discover tab with list mode selected via mode toggle |
| 4 | **Preconditions** | Same as WF-040 |
| 5 | **Entry Points** | Discover tab → mode toggle → list icon |
| 6 | **Happy Path** | List mode → 2-column GridCard grid → scroll → tap card → ProfileSheet → tap "Connect" → match request sent → undo toast (4s) → partner notified |
| 7 | **Alternate Paths** | (a) Filter pills (At gym, Nearby, level, sport) → instant filter. (b) Filter modal (full filter set) → Apply. (c) Search bar → filter by name. (d) Tap "Pending" on sent request → cancel/withdraw. (e) Tap "Connected ✓" → navigate to chat. |
| 8 | **Edge Cases** | (a) Pending users shown at top of list mixed with new users. (b) Connect undo toast: 4-second window (connectTimerRef). After 4s, undo disappears. (c) Filter shows live preview count in Apply button "Show X partners". (d) Clear all filters resets to EMPTY_FILTERS. (e) Search is client-side filter on displayed array, not a new DB query. |
| 9 | **Error Paths** | (a) Connect insert fails → no error (silent — same as swipe). (b) Cancel request fails → optimistic UI already removed, inconsistent state. |
| 10 | **Screens Involved** | discover.tsx (FlatList section), GridCard.tsx, FilterModal, ProfileSheet.tsx |
| 11 | **Required UI States** | Grid loaded, Filter pills active/inactive, Filter modal open, Search bar expanded, Connect undo toast, Loading more (footer spinner), Empty (EmptyState), Partner count row |
| 12 | **Backend Behavior** | Same data as WF-040 (shared state). connect() calls matches.insert. cancelRequest() calls matches.delete. Filters are client-side on loaded data. |
| 13 | **Current Implementation** | FlatList numColumns=2 with GridCard. FilterPill component for quick filters. FilterModal with sections: At Gym, Fitness Level, Schedule, Sport, Intent, Show Me, Max Distance. applyFilters() runs client-side. Partner count shows "X partners near you" or "X partners matching filters". Connect button → undo toast with 4s auto-dismiss. Pending button with ✕ to cancel. Connected button links to chat. |
| 14 | **Gap Analysis** | (a) Undo inconsistency: swipe undo has NO time limit, connect undo has 4s limit. Should be consistent. (b) Search is only on name — cannot search by sport, city, or other attributes. (c) Pending users have no visual separation from new users in the grid. |
| 15 | **Defects Found** | None critical. Minor: undo timing inconsistency between swipe and list modes. |
| 16 | **Root Cause** | N/A |
| 17 | **Acceptance Criteria** | AC1: Grid displays users in 2 columns. AC2: Filters reduce displayed users instantly. AC3: Connect creates match request + notification. AC4: Undo reverses connect within window. AC5: Cancel withdraws pending request. AC6: Connected links to chat. AC7: Empty state shown when no results. |
| 18 | **QA Test Cases** | TC1: Grid displays correctly. TC2: Filter by level → only matching shown. TC3: Filter by sport → only matching shown. TC4: Connect → undo toast → undo reverses. TC5: Cancel pending → request removed. TC6: Connected → navigates to chat. TC7: Search by name → filters list. TC8: Clear all → all users shown. TC9: Pull-to-refresh works. |
| 19 | **Regression Checklist** | Filter logic, connect/undo/cancel, GridCard rendering, pagination, search |
| 20 | **Apple Reviewer Check** | List mode is the default view — Apple reviewer will see this first. Must look polished with real content. |
| 21 | **Analytics Events** | discover_list_viewed, filter_applied (type, value), connect_sent (user_id), connect_undone, request_cancelled, search_used |
| 22 | **Performance Notes** | Client-side filtering on loaded array — instant. FlatList with numColumns=2 is performant. |
| 23 | **CLAUDE.md Updates** | None needed |
| 24 | **Go/No-Go** | **GO** |

---

## WF-042: Discover — Map Mode

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Location-based discovery showing nearby users on a map |
| 2 | **User Goal** | See where potential partners are relative to my location |
| 3 | **Trigger** | Mode toggle → map icon |
| 4 | **Preconditions** | Authenticated. Location permission granted (optional). Users with lat/lng exist. |
| 5 | **Entry Points** | Discover tab → mode toggle → map |
| 6 | **Happy Path** | Map mode → DiscoverMap renders with user markers → tap marker → ProfileSheet opens → Connect from sheet |
| 7 | **Alternate Paths** | (a) No users with coordinates → empty map. (b) Own location not shared → map centers on default area. |
| 8 | **Edge Cases** | (a) Many users at same location → markers overlap. (b) User zooms out → all markers cluster. (c) No location permission → map still shows users who shared their location. |
| 9 | **Error Paths** | (a) react-native-maps fails to load → blank area. (b) No lat/lng on any user → empty map. |
| 10 | **Screens Involved** | discover.tsx, DiscoverMap.tsx, ProfileSheet.tsx |
| 11 | **Required UI States** | Map rendered, User markers, Empty map, ProfileSheet on tap |
| 12 | **Backend Behavior** | Same data as WF-040. Map uses lat/lng from user profiles. |
| 13 | **Current Implementation** | DiscoverMap component wrapping react-native-maps. User markers at lat/lng positions. Tap marker → onUserPress → ProfileSheet. |
| 14 | **Gap Analysis** | (a) No clustering for overlapping markers. (b) No gym location markers (gyms not in DB). (c) No "near me" centering if user hasn't shared location. (d) Basic implementation — functional but not polished. |
| 15 | **Defects Found** | None critical. Feature is basic but works. |
| 16 | **Root Cause** | N/A |
| 17 | **Acceptance Criteria** | AC1: Map renders with user markers. AC2: Tap marker opens ProfileSheet. AC3: Connect from ProfileSheet works. |
| 18 | **QA Test Cases** | TC1: Map loads with markers. TC2: Tap marker → ProfileSheet. TC3: No users with coordinates → graceful empty. |
| 19 | **Regression Checklist** | Map rendering, marker placement, ProfileSheet integration |
| 20 | **Apple Reviewer Check** | Map requires NSLocationWhenInUseUsageDescription (already set in app.json). Apple will verify the permission prompt is appropriate. |
| 21 | **Analytics Events** | discover_map_viewed, map_marker_tapped (user_id) |
| 22 | **Performance Notes** | react-native-maps is native — performant. Many markers (100+) could slow down. |
| 23 | **CLAUDE.md Updates** | None needed |
| 24 | **Go/No-Go** | **GO** |

---

## WF-043: Send Match Request (Like)

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Express interest in training with another user |
| 2 | **User Goal** | Let another user know I want to connect |
| 3 | **Trigger** | Swipe right (swipe mode), tap Connect (list mode), tap Connect on ProfileSheet |
| 4 | **Preconditions** | Target user not already matched/passed/blocked |
| 5 | **Entry Points** | SwipeDeck swipe right, GridCard Connect, PersonCard Send Request, ProfileSheet Connect |
| 6 | **Happy Path** | Action → haptic feedback → matches.insert({sender_id: me, receiver_id: target, status: "pending"}) → setStatuses({[target]: "pending"}) → notifyUser(target, {type: "match_request", title: "New Match Request 🤝", body: "[name] wants to connect with you!"}) |
| 7 | **Alternate Paths** | (a) Target already liked me → server may auto-accept (depends on trigger/RLS). (b) Target has notifications disabled → push fails silently. |
| 8 | **Edge Cases** | (a) Network failure during insert → silent failure. User thinks they liked, nothing in DB. (b) Rapid double-tap → could create duplicate request (mitigated by Eagle FM-105 server-side check). (c) Like a user who just deleted their account → insert may fail with FK violation. |
| 9 | **Error Paths** | (a) Insert fails → no error shown (silent). (b) notifyUser fails → silent (best-effort). |
| 10 | **Screens Involved** | discover.tsx (onLike, connect functions) |
| 11 | **Required UI States** | Pre-action (Connect button visible), Action feedback (haptic), Post-action (status → "pending"), Undo available |
| 12 | **Backend Behavior** | matches.insert({sender_id, receiver_id, status:"pending"}).select("id").single() → returns match ID for undo reference. notifyUser() inserts notification + sends push. |
| 13 | **Current Implementation** | onLike(): excludedRef.add(userId), setStatuses pending, haptic Medium, matches.insert, setLastSwipe for undo, notifyUser with match_request type. connect(): same logic but with connectUndo (4s toast) instead of setLastSwipe. Both use appUser context for sender name. |
| 14 | **Gap Analysis** | (a) **No try/catch on matches.insert in onLike()** — if insert fails, user is excluded (excludedRef.add happened before insert) but match doesn't exist in DB. User can't undo either because setLastSwipe only fires if data returned. (b) **No rate limiting** — user can like everyone instantly. |
| 15 | **Defects Found** | **DEF-043:** onLike/connect add user to excluded set BEFORE DB insert succeeds. If insert fails, user is permanently excluded from session until refresh. Race condition between optimistic exclusion and DB confirmation. |
| 16 | **Root Cause** | Implementation defect (optimistic state update without rollback on failure). |
| 17 | **Acceptance Criteria** | AC1: Like creates match request in DB. AC2: Push notification sent to target. AC3: Target user excluded from future cards. AC4: If insert fails, user is NOT permanently excluded. AC5: Haptic feedback on action. |
| 18 | **QA Test Cases** | TC1: Like → match request in DB. TC2: Like → target gets push. TC3: Like → undo removes request. TC4: Like with network off → [expected: error or retry; actual: silent fail + user excluded]. TC5: Rapid double-like → no duplicate. |
| 19 | **Regression Checklist** | Match creation, notification, exclusion logic, undo |
| 20 | **Apple Reviewer Check** | Like must work. Notification must arrive. |
| 21 | **Analytics Events** | match_request_sent (target_id, source: swipe/list/profile, match_score) |
| 22 | **Performance Notes** | Single DB insert + push — fast. |
| 23 | **CLAUDE.md Updates** | Add: "Optimistic exclusion must be rolled back if DB insert fails." |
| 24 | **Go/No-Go** | **CONDITIONAL GO** — DEF-043 is a subtle bug (only manifests on network failure during like). Low probability but causes permanent exclusion of that user. |

---

## WF-044: Receive Match Request

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Notify user that someone wants to train with them |
| 2 | **User Goal** | See who's interested and decide whether to accept |
| 3 | **Trigger** | Another user sends match request (WF-043) |
| 4 | **Preconditions** | Authenticated. Has push token registered. |
| 5 | **Entry Points** | Push notification tap → matches tab. In-app notification → matches tab. |
| 6 | **Happy Path** | Push received → user taps → navigates to /(tabs)/matches → sees pending request with Accept/Decline |
| 7 | **Alternate Paths** | (a) App in foreground → in-app notification banner. (b) Notifications disabled → user only sees on next matches tab visit. |
| 8 | **Edge Cases** | (a) Sender deletes request before receiver sees it → request disappears. (b) Multiple pending requests → all shown in matches tab. |
| 9 | **Error Paths** | (a) Push delivery fails → user doesn't know about request until they open matches tab. |
| 10 | **Screens Involved** | matches.tsx (hidden tab), notifications.tsx |
| 11 | **Required UI States** | New request badge, Pending request card with Accept/Decline buttons |
| 12 | **Backend Behavior** | Realtime or poll on matches table. Push notification with type: match_request. Deep link to /(tabs)/matches. |
| 13 | **Current Implementation** | NotificationContext tracks unread. Push deep link via extractRoute → "/(tabs)/matches" for match_request type. |
| 14 | **Gap Analysis** | None significant. |
| 15 | **Defects Found** | None |
| 16 | **Root Cause** | N/A |
| 17 | **Acceptance Criteria** | AC1: Push received with sender name. AC2: Tap navigates to matches tab. AC3: Request visible with Accept/Decline. |
| 18 | **QA Test Cases** | TC1: Send request → receiver gets push. TC2: Tap push → matches tab. TC3: Multiple requests → all visible. |
| 19 | **Regression Checklist** | Push delivery, deep linking, matches tab rendering |
| 20 | **Apple Reviewer Check** | Push notifications must work with test accounts. |
| 21 | **Analytics Events** | match_request_received, match_request_viewed |
| 22 | **Performance Notes** | No concerns |
| 23 | **CLAUDE.md Updates** | None needed |
| 24 | **Go/No-Go** | **GO** |

---

## WF-045: Accept Match Request

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Create a mutual connection between two users |
| 2 | **User Goal** | Accept a training partner and start chatting |
| 3 | **Trigger** | User taps "Accept" on pending match request |
| 4 | **Preconditions** | Match exists with status=pending. User is the receiver. |
| 5 | **Entry Points** | matches.tsx → Accept button on request card |
| 6 | **Happy Path** | Tap Accept → matches.update({status: "accepted"}) → notifyUser(sender, {type: "match_accepted"}) → conversation appears in both users' Chat inboxes |
| 7 | **Alternate Paths** | (a) Decline instead (WF-046). |
| 8 | **Edge Cases** | (a) Sender deleted account → accept may fail (FK violation). (b) Sender already unmatched → match no longer exists. |
| 9 | **Error Paths** | (a) Update fails → should show error (needs verification). |
| 10 | **Screens Involved** | matches.tsx |
| 11 | **Required UI States** | Pending (Accept/Decline visible), Accepted (card changes to "Connected"), Error (alert) |
| 12 | **Backend Behavior** | matches.update({status: "accepted"}).eq("id", match_id). notifyUser(sender_id, type: "match_accepted"). |
| 13 | **Current Implementation** | Accept button updates status. Push notification sent to original sender. Conversation appears in messages.tsx on next load. |
| 14 | **Gap Analysis** | None significant. |
| 15 | **Defects Found** | None |
| 16 | **Root Cause** | N/A |
| 17 | **Acceptance Criteria** | AC1: Accept changes status to accepted. AC2: Sender receives notification. AC3: Chat appears for both users. |
| 18 | **QA Test Cases** | TC1: Accept → status accepted. TC2: Sender gets "match accepted" push. TC3: Chat visible for both. TC4: Accept after sender deleted account → graceful error. |
| 19 | **Regression Checklist** | Status update, notification, chat creation |
| 20 | **Apple Reviewer Check** | Must work with test accounts. |
| 21 | **Analytics Events** | match_accepted (match_id, response_time_hours) |
| 22 | **Performance Notes** | No concerns |
| 23 | **CLAUDE.md Updates** | None |
| 24 | **Go/No-Go** | **GO** |

---

## WF-046: Decline Match Request

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Allow users to reject unwanted connection requests |
| 2 | **User Goal** | Decline without awkwardness |
| 3 | **Trigger** | User taps "Decline" on pending match request |
| 4 | **Preconditions** | Match exists with status=pending. User is receiver. |
| 5 | **Entry Points** | matches.tsx → Decline button |
| 6 | **Happy Path** | Tap Decline → matches.update({status: "declined"}) → request disappears → NO notification sent to sender (intentional — reduces awkwardness) |
| 7 | **Edge Cases** | (a) Declined user sends new request later → should be allowed (no permanent block). |
| 8 | **Defects Found** | None |
| 9 | **Go/No-Go** | **GO** |

---

## WF-047: Mutual Match → Chat Unlocked

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | When both users express interest, unlock direct communication |
| 2 | **User Goal** | Start chatting with my new fitness partner |
| 3 | **Trigger** | Match status changes to "accepted" (via WF-045 accept, or automatic if both users liked) |
| 4 | **Preconditions** | Match with status=accepted exists. |
| 5 | **Entry Points** | Chat tab → conversation appears. Push notification tap → chat. |
| 6 | **Happy Path** | Match accepted → conversation row appears in messages.tsx → tap → /chat/[matchId] → can send messages |
| 7 | **Edge Cases** | (a) Chat tab already loaded → realtime should add conversation (if subscription covers new matches). (b) Chat tab not yet visited → loads on first visit. |
| 8 | **Gap Analysis** | (a) Realtime subscription may not pick up NEW matches — it listens for message changes, not match status changes. User may need to pull-to-refresh or revisit tab. |
| 9 | **Defects Found** | **DEF-047:** New match may not appear immediately in chat inbox without refresh — realtime subscription on messages doesn't detect new match creation. |
| 10 | **Go/No-Go** | **CONDITIONAL GO** — User can pull-to-refresh. Not a crash but could confuse first-time users. |

---

## WF-048: Undo Last Swipe Action

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Allow users to reverse accidental swipes |
| 2 | **User Goal** | Take back a like or pass I didn't mean |
| 3 | **Trigger** | User taps undo button (↩) in swipe mode |
| 4 | **Preconditions** | lastSwipe state is not null. In swipe mode. |
| 5 | **Entry Points** | SwipeDeck undo button |
| 6 | **Happy Path** | Tap undo → if last was pass: passes.delete(dbId). If last was like: matches.delete(dbId) + remove from statuses + remove from matchIds. → swipeDeckRef.undoLast() → card returns to deck. → setLastSwipe(null) → undo button turns gray. |
| 7 | **Edge Cases** | (a) Only ONE undo available — tracks last action only. (b) No time limit on undo (unlike list mode 4s). (c) Undo after partner already accepted → deletes accepted match (potentially confusing for partner). |
| 8 | **Gap Analysis** | (a) Undo after mutual match → deletes the match, partner may have already seen "Connected" in their chat. No notification sent to partner about un-match. |
| 9 | **Defects Found** | **DEF-048:** Undo on a like that was already accepted (mutual match) silently deletes the match. Partner's chat shows broken/missing conversation. No notification that the match was reversed. |
| 10 | **Root Cause** | Design mismatch (undo designed for pending requests but also works on accepted matches). |
| 11 | **Go/No-Go** | **CONDITIONAL GO** — Low probability (requires rapid mutual like + undo). But could cause confusion when it happens. |

---

## WF-049: Discover Pagination

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Load more users as deck runs low without loading all users at once |
| 2 | **User Goal** | Keep seeing new potential partners without interruption |
| 3 | **Trigger** | onDeckLow fires when remaining unswiped cards <= DECK_LOW_THRESHOLD (5) |
| 4 | **Preconditions** | hasMore = true. loadingMore = false. |
| 5 | **Entry Points** | Automatic — triggered by SwipeDeck or FlatList onEndReached |
| 6 | **Happy Path** | Remaining cards <= 5 → onDeckLow() → loadMore() → users.select(range: rawOffset, rawOffset+PAGE_SIZE-1) → filter by excludedRef → score + sort → append to users array → setRawOffset += PAGE_SIZE |
| 7 | **Edge Cases** | (a) No more users → setHasMore(false) → loadMore stops. (b) All new users are in excluded set → appended array is empty but hasMore may still be true. (c) Concurrent loadMore calls → prevented by loadingMore flag. |
| 8 | **Defects Found** | None |
| 9 | **Go/No-Go** | **GO** |

---

## WF-050: Empty State (No Users Nearby)

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Handle the cold start scenario gracefully |
| 2 | **User Goal** | Understand why no one is shown and what to do next |
| 3 | **Trigger** | Discover loads with zero users after filtering |
| 4 | **Current Implementation** | Swipe mode: "You've seen everyone! 🎉" + "Pull to refresh for new matches." List mode: EmptyState component with icon="search", title="No matches found", subtitle varies by filter state. |
| 5 | **Gap Analysis** | **Critical for first impression:** Empty state has no actionable CTAs. User sees "no one" and deletes the app. Should offer: (a) "Invite friends" button → referral flow. (b) "Join a Circle" button → circles tab. (c) "Expand your search" suggestion → clear filters or increase radius. (d) "Complete your profile" if incomplete → better matching. |
| 6 | **Defects Found** | **DEF-040:** (reiterated) Generic empty state with no actionable next steps. |
| 7 | **Go/No-Go** | **CONDITIONAL GO** — Not a crash but hurts retention severely. Top priority UX fix. |

---

## WF-051: Discover Refresh on Focus

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Ensure discover data is fresh when user returns to the tab |
| 2 | **User Goal** | See updated profiles and new users |
| 3 | **Trigger** | Tab receives focus (useFocusEffect) |
| 4 | **Preconditions** | Authenticated. AppUser loaded. |
| 5 | **Happy Path** | Tab focused → if elapsed > STALE_MS (5 minutes) or users empty → load() called → fresh data |
| 6 | **Edge Cases** | (a) Filters reset on every focus (EMPTY_FILTERS). (b) Search query cleared. (c) If appUser not yet available → skips load. |
| 7 | **Defects Found** | None |
| 8 | **Go/No-Go** | **GO** |

---

## WF-052: Duplicate Match Prevention

| # | Item | Detail |
|---|------|--------|
| 1 | **Business Purpose** | Prevent multiple match requests between same pair |
| 2 | **User Goal** | Not accidentally send duplicate requests |
| 3 | **Trigger** | User attempts to like someone they've already interacted with |
| 4 | **Preconditions** | Existing match/pass/block between users |
| 5 | **Current Implementation** | Client-side: excluded set built from all existing matches (pending+accepted), passes, and blocks at load time. excludedRef.current persists across loadMore calls. Server-side: Eagle FM-105 added uniqueness check. |
| 6 | **Gap Analysis** | None — well-handled at both client and server level. |
| 7 | **Defects Found** | None |
| 8 | **Go/No-Go** | **GO** |

---

## Session 3 Summary

| ID | Workflow | Go/No-Go | Blocking Defect |
|----|----------|----------|-----------------|
| WF-040 | Swipe mode | **GO** | — (DEF-040/041 are non-blocking) |
| WF-041 | List mode | **GO** | — |
| WF-042 | Map mode | **GO** | — |
| WF-043 | Send match request | **CONDITIONAL** | DEF-043 (optimistic exclusion without rollback) |
| WF-044 | Receive match request | **GO** | — |
| WF-045 | Accept match | **GO** | — |
| WF-046 | Decline match | **GO** | — |
| WF-047 | Mutual → chat | **CONDITIONAL** | DEF-047 (new match may not appear without refresh) |
| WF-048 | Undo swipe | **CONDITIONAL** | DEF-048 (undo accepted match breaks partner's chat) |
| WF-049 | Pagination | **GO** | — |
| WF-050 | Empty state | **CONDITIONAL** | DEF-040 (no actionable CTAs) |
| WF-051 | Refresh on focus | **GO** | — |
| WF-052 | Duplicate prevention | **GO** | — |

**Results: 8 GO, 4 CONDITIONAL, 0 NO-GO**

### New Defects Found in Session 3

| ID | Severity | Description | Root Cause |
|----|----------|-------------|------------|
| DEF-043 | Medium | Optimistic exclusion without rollback on DB failure | Implementation defect |
| DEF-047 | Medium | New match not visible in chat without refresh | Implementation defect |
| DEF-048 | Low | Undo on accepted match breaks partner's chat | Design mismatch |

*Session 3 complete. All 13 Discovery & Matching workflows have full 24-item cards.*
