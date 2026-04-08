# FlexMatches™ — Workflow Framework

## Phase 2: Complete Workflow Inventory

> **Date:** April 2026
> **Total Workflows Identified:** 106
> **Status:** Initial inventory — not yet tested

---

### Workflow Priority Legend
- **P0** = Core flow — app is broken without it
- **P1** = Important — most users encounter it
- **P2** = Supporting — power users or edge cases
- **P3** = Secondary — rarely triggered or admin-only

### Status Legend
- **🟢 Documented** = Happy path + error path defined and tested
- **🟡 Partial** = Screen exists, happy path works, edge cases not tested
- **🟠 Suspected Bug** = Known or suspected issues in current implementation
- **🔴 Missing** = Workflow not implemented or critically broken
- **⚪ Not Tested** = Cannot verify without device testing

---

## Category 1: App Launch / Session Restore

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-001 | Cold launch → auth check → route | P0 | Architect | 🟡 Partial | No | ⚪ | 0 | Medium — Apple tests cold launch | Low |
| WF-002 | Background resume → state restore | P1 | Architect | 🟡 Partial | No | ⚪ | 0 | Low | Medium — stale data |
| WF-003 | Deep link from push → route to target | P0 | Architect | 🟡 Partial | No | ⚪ | 0 | Medium — Apple tests deep links | Low |
| WF-004 | App killed → reopen → session restore | P0 | Architect | 🟡 Partial | No | ⚪ | 0 | High — broken = infinite spinner | Low |
| WF-005 | Expired token → auto refresh → continue | P1 | Architect | 🟡 Partial | No | ⚪ | 0 | Medium | Low |

**Category total: 5 workflows**

---

## Category 2: Authentication

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-010 | Email/password registration | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | High — Apple tests registration | Low |
| WF-011 | Apple Sign-In registration | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | High — Apple requires this | Low |
| WF-012 | Email/password login | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | High — Apple tests login | Low |
| WF-013 | Apple Sign-In login | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | High — Apple requires this | Low |
| WF-014 | Forgot password (request link) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | High — Apple requires this | Low |
| WF-015 | Reset password (from email link) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Medium | Low |
| WF-016 | Logout | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-017 | Auth state change (token refresh) | P1 | Architect | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 8 workflows**

---

## Category 3: Onboarding

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-020 | Full 5-step onboarding (new user) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | High — Apple tests new user flow | Low |
| WF-021 | Skip step (steps 2-5, with partial save) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Medium | Low |
| WF-022 | Back navigation during onboarding | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-023 | Onboarding save failure → retry | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Medium — broken = stuck user | Low |
| WF-024 | Resume onboarding after app kill | P2 | App Engineer | 🟠 Suspected | No | ⚪ | 1? | Medium | Low |

**Category total: 5 workflows**

---

## Category 4: Profile

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-030 | View own profile | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-031 | Edit profile (all fields) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-032 | Upload/change avatar photo | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Medium — image upload |
| WF-033 | City autocomplete (Google Places) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-034 | View other user's profile (ProfileSheet) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-035 | Share profile link | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-036 | Profile completeness indicator | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 7 workflows**

---

## Category 5: Discovery / Matching

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-040 | Discover — swipe mode (like/pass) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Medium | Medium — card rendering |
| WF-041 | Discover — list mode (scroll + filters) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Medium — list performance |
| WF-042 | Discover — map mode | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Medium — map rendering |
| WF-043 | Send match request (like) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-044 | Receive match request (pending) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-045 | Accept match request | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-046 | Decline match request | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-047 | Mutual match → chat unlocked | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Medium | Low |
| WF-048 | Undo last swipe action | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-049 | Discover pagination (deck low trigger) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Medium |
| WF-050 | Discover empty state (no users nearby) | P1 | UX | 🟡 Partial | No | ⚪ | 0 | Medium — Apple sees this first | Low |
| WF-051 | Discover refresh (useFocusEffect) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Medium |
| WF-052 | Duplicate match request prevention | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 13 workflows**

---

## Category 6: Chat / Session Coordination

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-060 | Chat inbox (list conversations) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Medium | Medium — N+1 query |
| WF-061 | Send message | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-062 | Receive message (realtime) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-063 | Read receipt marking | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-064 | Propose session (3-step wizard) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-065 | Accept session | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-066 | Decline session | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-067 | Cancel session | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-068 | Confirm session completed | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-069 | Mark session as no-show | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-070 | Reschedule session | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-071 | Edit session (replace via wizard) | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-072 | Delete messages (preserve match) | P1 | App Engineer | 🟠 Suspected | No | ⚪ | 1 | Low | Low |
| WF-073 | Unmatch (remove connection) | P1 | App Engineer | 🟠 Suspected | No | ⚪ | 1 | Low | Low |
| WF-074 | Save/bookmark conversation | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-075 | Chat send failure → text preserved | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-076 | Session action error handling | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 17 workflows**

---

## Category 7: Home Screen

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-080 | Home screen data load (orchestration) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Medium | High — many parallel queries |
| WF-081 | Primary action card (8 variants) | P0 | UX | 🟡 Partial | No | ⚪ | 0 | Medium — first thing Apple sees | Low |
| WF-082 | Quick check-in (gym attendance) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-083 | Gym toggle (is_at_gym on/off) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-084 | View upcoming sessions strip | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-085 | View active now partners | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-086 | Pull-to-refresh (keep data + toast on fail) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-087 | Profile nudge (complete your profile) | P2 | UX | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-088 | New circles section | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 9 workflows**

---

## Category 8: Streaks & Activity

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-090 | Streak tracking (log_checkin RPC) | P0 | Backend | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-091 | Log workout (activity screen) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-092 | View workout history | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-093 | Streak reset (missed day) | P1 | Backend | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-094 | Same-day duplicate check-in prevention | P1 | Backend | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 5 workflows**

---

## Category 9: Circles / Community

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-100 | Browse circles (list + search) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Medium |
| WF-101 | Join circle | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-102 | Leave circle | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-103 | Create circle (wizard with map picker) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-104 | View circle detail (members, events) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-105 | Circle event scheduling | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-106 | Circle capacity enforcement | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 7 workflows**

---

## Category 10: Notifications

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-110 | In-app notification list | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-111 | Mark notification as read | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-112 | Push notification receive (foreground) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-113 | Push notification tap → deep link | P0 | Architect | 🟡 Partial | No | ⚪ | 0 | Medium — Apple tests this | Low |
| WF-114 | Push token registration | P1 | Backend | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-115 | Push token cleanup on logout | P1 | Backend | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-116 | Realtime badge count update | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Medium |
| WF-117 | Notification bell icon (unread count) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 8 workflows**

---

## Category 11: Settings / Privacy / Account

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-120 | View settings screen | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-121 | Change theme (dark/light) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-122 | Change units (imperial/metric) | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-123 | Privacy toggles (5 options) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Medium — Apple checks privacy | Low |
| WF-124 | Notification preferences (6 types) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-125 | Change email | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-126 | Reset password (from settings) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-127 | Delete account (Edge Function) | P0 | Backend | 🟡 Partial | No | ⚪ | 0 | High — Apple requires this | Low |
| WF-128 | Sign out | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Medium | Low |
| WF-129 | FAQ accordion | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-130 | Report a bug | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 11 workflows**

---

## Category 12: Subscription / Monetization

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-140 | View Pro screen (not subscribed) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | High — Apple reviews IAP | Low |
| WF-141 | Subscribe to Pro (iOS IAP) | P0 | Backend | 🔴 Missing | No | ⚪ | 1 | **Critical — IAP stubbed** | Low |
| WF-142 | Subscribe to Pro (Android Stripe) | P1 | Backend | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-143 | View Pro screen (already subscribed) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-144 | Manage subscription (billing portal) | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-145 | Free tier limits enforcement | P0 | App Engineer | 🔴 Missing | No | ⚪ | 1 | **High — no conversion pressure** | Low |
| WF-146 | Pro feature unlock verification | P1 | App Engineer | 🔴 Missing | No | ⚪ | 1 | Medium | Low |
| WF-147 | Subscription expiry handling | P1 | Backend | 🔴 Missing | No | ⚪ | 1 | Medium | Low |

**Category total: 8 workflows**

---

## Category 13: Goals & Challenges

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-150 | View goals list | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-151 | Create goal | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-152 | Update goal progress | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-153 | View challenges list | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-154 | Join challenge | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-155 | Update challenge progress | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-156 | View challenge leaderboard | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-157 | Ended challenge → block updates | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 8 workflows**

---

## Category 14: Leaderboard & Feed

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-160 | View leaderboard | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Medium |
| WF-161 | Tier progression display | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-162 | View social feed | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Medium |
| WF-163 | Give kudos | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-164 | Post to feed | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 5 workflows**

---

## Category 15: Admin / Internal Tools

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-170 | Admin auth guard (is_admin check) | P1 | Backend | 🟡 Partial | No | ⚪ | 0 | Medium — must not be bypassed | Low |
| WF-171 | Admin user list + search + filter | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Medium |
| WF-172 | Admin action (8 operations via Edge Function) | P1 | Backend | 🟡 Partial | No | ⚪ | 0 | Medium — security | Low |
| WF-173 | Admin self-protection guard | P1 | Backend | 🟡 Partial | No | ⚪ | 0 | Medium | Low |
| WF-174 | Admin edit user fields | P2 | Backend | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 5 workflows**

---

## Category 16: Referral / Growth

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-180 | View referral screen | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-181 | Copy referral code | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-182 | Share referral link (native share) | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-183 | Referral milestone tracking | P2 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-184 | Referral deep link (recipient joins) | P2 | Backend | 🔴 Missing | No | ⚪ | 1 | Low | Low |

**Category total: 5 workflows**

---

## Category 17: Trust & Safety

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-190 | Block user | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | High — Apple requires this | Low |
| WF-191 | Report user | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | High — Apple requires this | Low |
| WF-192 | Blocked user → hidden from discover | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | High | Low |
| WF-193 | Banned user experience | P1 | App Engineer | 🟠 Suspected | No | ⚪ | 1? | High — Apple checks this | Low |
| WF-194 | Report review queue (admin) | P1 | Backend | 🔴 Missing | No | ⚪ | 1 | **High — reports go nowhere** | Low |
| WF-195 | Content policy enforcement | P2 | Growth/T&S | 🔴 Missing | No | ⚪ | 1 | Medium | Low |
| WF-196 | Search input sanitization | P0 | Backend | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 7 workflows**

---

## Category 18: Global / Cross-Cutting

| ID | Workflow | Priority | Owner | Status | Happy Path Doc | Tested | Defects | Reviewer Risk | Perf Risk |
|----|----------|----------|-------|--------|---------------|--------|---------|---------------|-----------|
| WF-200 | Error boundary (crash recovery) | P0 | Architect | 🟡 Partial | No | ⚪ | 0 | Medium | Low |
| WF-201 | ErrorState component (screen-level errors) | P0 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-202 | 15-second timeout → error state | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-203 | Network offline → graceful degradation | P1 | App Engineer | 🟠 Suspected | No | ⚪ | 1? | Medium | Low |
| WF-204 | Theme switching (dark ↔ light) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |
| WF-205 | Accessibility labels | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Medium — Apple checks a11y | Low |
| WF-206 | Keyboard handling (all input screens) | P1 | App Engineer | 🟡 Partial | No | ⚪ | 0 | Low | Low |

**Category total: 7 workflows**

---

## Summary Dashboard

### Totals

| Metric | Count |
|--------|-------|
| **Total workflows** | **106** |
| **P0 (core)** | **28** |
| **P1 (important)** | **42** |
| **P2 (supporting)** | **33** |
| **P3 (secondary)** | **3** |
| **🟢 Fully documented** | **0** |
| **🟡 Partial** | **91** |
| **🟠 Suspected bug** | **5** |
| **🔴 Missing implementation** | **8** |
| **⚪ Not tested on device** | **106** |
| **Known/suspected defects** | **~12** |
| **High reviewer risk** | **14** |

### By Category

| # | Category | Workflows | P0 | Defects | Reviewer Risk |
|---|----------|-----------|----|---------|----- |
| 1 | App Launch / Session Restore | 5 | 3 | 0 | Medium |
| 2 | Authentication | 8 | 6 | 0 | High |
| 3 | Onboarding | 5 | 1 | 1? | High |
| 4 | Profile | 7 | 2 | 0 | Low |
| 5 | Discovery / Matching | 13 | 4 | 0 | Medium |
| 6 | Chat / Session Coordination | 17 | 5 | 2 | Low |
| 7 | Home Screen | 9 | 2 | 0 | Medium |
| 8 | Streaks & Activity | 5 | 1 | 0 | Low |
| 9 | Circles / Community | 7 | 0 | 0 | Low |
| 10 | Notifications | 8 | 1 | 0 | Medium |
| 11 | Settings / Privacy / Account | 11 | 2 | 0 | Medium |
| 12 | Subscription / Monetization | 8 | 2 | **4** | **Critical** |
| 13 | Goals & Challenges | 8 | 0 | 0 | Low |
| 14 | Leaderboard & Feed | 5 | 0 | 0 | Low |
| 15 | Admin / Internal Tools | 5 | 0 | 0 | Medium |
| 16 | Referral / Growth | 5 | 0 | 1 | Low |
| 17 | Trust & Safety | 7 | 3 | **3** | **High** |
| 18 | Global / Cross-Cutting | 7 | 2 | 1? | Medium |

### Critical Findings

| Finding | Details | Impact |
|---------|---------|--------|
| **Zero workflows fully documented** | All 106 workflows are at "Partial" or worse | Every workflow needs a Phase 3 card |
| **Zero workflows tested on device** | All testing is theoretical until run on physical iPhone/Android | Bugs may exist that code review cannot find |
| **8 workflows missing implementation** | IAP stubbed, free limits not enforced, referral deep link missing, report review missing | Revenue = $0, safety gap, growth loop broken |
| **14 workflows with high Apple reviewer risk** | Auth, onboarding, delete account, block/report, IAP, privacy | Apple rejection likely without fixes |
| **Subscription category has 4 defects** | IAP stubbed, no free limits, no Pro verification, no expiry handling | Entire monetization layer is non-functional |
| **Trust & Safety has 3 defects** | Reports go nowhere, banned user experience unclear, no content policy | Apple reviewer and user safety risk |

---

### Recommended Phase 3 Execution Order

Based on reviewer risk + defect count + user impact:

| Batch | Category | Workflows | Why First |
|-------|----------|-----------|-----------|
| **Batch 1** | Auth + Onboarding + App Launch | WF-001 to WF-024 | Apple reviewer tests these first |
| **Batch 2** | Discovery + Matching | WF-040 to WF-052 | Core value proposition |
| **Batch 3** | Chat + Sessions | WF-060 to WF-076 | Core engagement loop |
| **Batch 4** | Trust & Safety + Settings | WF-120 to WF-196 | Apple compliance |
| **Batch 5** | Subscription | WF-140 to WF-147 | Revenue enablement |
| **Batch 6** | Home + Streaks | WF-080 to WF-094 | Daily engagement |
| **Batch 7** | Circles + Notifications + Profile | WF-030 to WF-117 | Supporting features |
| **Batch 8** | Goals, Challenges, Leaderboard, Feed, Admin, Referral | Remaining | Secondary features |

---

*Phase 2 complete. Ready for Phase 3, Batch 1: Auth + Onboarding + App Launch detailed workflow cards (18 workflows, 24 items each).*
