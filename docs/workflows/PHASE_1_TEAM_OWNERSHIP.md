# FlexMatches™ — Workflow Framework

## Phase 1: Team & Ownership Map

> **Date:** April 2026
> **Framework Version:** 1.0
> **PO Decision:** Full Option A — all workflows, all phases, no shortcuts

---

### 1.1 Role-Responsibility Map

Even though Erdinc is the sole team member, every responsibility must have an explicit owner. Claude Code acts as the development agent, but NEVER makes product decisions or triggers releases.

---

#### Role 1: CPO / Product Lead

| Attribute | Detail |
|-----------|--------|
| **Person** | Erdinc |
| **Primary Ownership** | Product vision, feature prioritization, Go/No-Go decisions, user research, competitive analysis |
| **Supporting Responsibilities** | Review all workflow definitions before coding begins; approve every release; define Pro feature gates; decide which workflows ship in which version |
| **Deliverables** | Product roadmap, feature specs, prioritization decisions, release approval sign-off |
| **Must Review Before Code Changes** | Every workflow card's "Business Purpose" and "Acceptance Criteria" sections; any change to monetization logic; any change to onboarding flow |

---

#### Role 2: BA / Workflow Owner

| Attribute | Detail |
|-----------|--------|
| **Person** | Erdinc (supported by Claude as analyst) |
| **Primary Ownership** | Workflow inventory, workflow cards (all 24 items), business rules catalog, user flow documentation |
| **Supporting Responsibilities** | Map every screen to its workflows; identify missing workflows; document happy/alternate/error paths; maintain workflow register |
| **Deliverables** | Workflow register, detailed workflow cards, gap analysis, business rules catalog |
| **Must Review Before Code Changes** | Workflow card must exist and be marked "Go" before any code touches that workflow; all acceptance criteria must be defined |

---

#### Role 3: UX / Design Owner

| Attribute | Detail |
|-----------|--------|
| **Person** | Erdinc (design decisions) |
| **Primary Ownership** | Screen layouts, interaction patterns, design system compliance, dark/light mode consistency, accessibility |
| **Supporting Responsibilities** | Define required UI states for each workflow (loading, empty, error, success, disabled); approve design token usage; review animations and transitions |
| **Deliverables** | UI state definitions per workflow, design system rules, accessibility requirements |
| **Must Review Before Code Changes** | Every workflow card's "Required UI States" section; any new component; any change to theme tokens |

---

#### Role 4: System Architect

| Attribute | Detail |
|-----------|--------|
| **Person** | Claude (analysis) + Erdinc (approval) |
| **Primary Ownership** | Technical architecture, state management patterns, navigation rules, data flow, Edge Function design, Supabase schema |
| **Supporting Responsibilities** | Classify root causes; define coding patterns; prevent technical debt; review component responsibilities; ensure separation of concerns |
| **Deliverables** | Architecture decisions, root cause classifications, CLAUDE.md updates, coding patterns |
| **Must Review Before Code Changes** | Root cause must be classified before fix is proposed; CLAUDE.md must be current; no fix may introduce new patterns that contradict existing architecture |

---

#### Role 5: QA / Test Lead

| Attribute | Detail |
|-----------|--------|
| **Person** | Claude (test case definition) + Erdinc (execution on device) |
| **Primary Ownership** | Test cases for every workflow, regression checklists, defect tracking, acceptance verification |
| **Supporting Responsibilities** | Document current behavior vs expected behavior; define edge cases; verify fixes don't break other workflows; maintain defect log |
| **Deliverables** | QA test cases per workflow, regression checklists, defect log, acceptance sign-off |
| **Must Review Before Code Changes** | Current behavior must be documented before fix; regression scope must be defined; fix must not create new defects |

---

#### Role 6: App Engineer

| Attribute | Detail |
|-----------|--------|
| **Person** | Claude Code (execution) + Erdinc (review + approval) |
| **Primary Ownership** | React Native/Expo code, screen implementation, component development, navigation, UI state management |
| **Supporting Responsibilities** | Follow coding patterns from CLAUDE.md; implement fixes per workflow cards; write accessible code; maintain dark/light mode support |
| **Deliverables** | Code changes per workflow, commits following [FM-XXX] convention |
| **Must Review Before Code Changes** | Workflow card must be "Go"; CLAUDE.md patterns must be followed; PO must approve before merge |

---

#### Role 7: Backend / Data / DevOps Engineer

| Attribute | Detail |
|-----------|--------|
| **Person** | Claude Code (execution) + Erdinc (approval + deployment) |
| **Primary Ownership** | Supabase schema, Edge Functions, RPC functions, RLS policies, EAS build configuration, environment variables |
| **Supporting Responsibilities** | Deploy Edge Functions; manage Supabase migrations; configure EAS profiles; manage secrets |
| **Deliverables** | Schema migrations, Edge Function code, deployment scripts |
| **Must Review Before Code Changes** | Schema changes must be reviewed before deployment; Edge Functions must follow the JWT→service-role pattern; migrations must be reversible where possible |

---

#### Role 8: Growth / Analytics / Trust & Safety Owner

| Attribute | Detail |
|-----------|--------|
| **Person** | Erdinc (decisions) + Claude (analysis) |
| **Primary Ownership** | Analytics instrumentation, event tracking, funnel analysis, safety policies, content moderation rules, Apple/Google compliance |
| **Supporting Responsibilities** | Define analytics events per workflow; ensure block/report flows work; verify Apple reviewer flows; monitor trust signals (reliability score, no-show rate) |
| **Deliverables** | Analytics event catalog, trust & safety rules, compliance checklist, growth metrics |
| **Must Review Before Code Changes** | Analytics events must be defined before feature ships; trust & safety implications must be assessed for any user-facing workflow |

---

### 1.2 Responsibility Leak Check

| Area | Primary Owner | Status |
|------|--------------|--------|
| Product vision & priorities | CPO (Erdinc) | ✅ Owned |
| Workflow documentation | BA (Erdinc + Claude) | ✅ Owned |
| UX design decisions | UX (Erdinc) | ✅ Owned |
| Architecture & patterns | Architect (Claude + Erdinc) | ✅ Owned |
| Test case definition | QA (Claude + Erdinc) | ✅ Owned |
| Test execution on device | QA (Erdinc) | ✅ Owned |
| App code implementation | App Engineer (Claude Code) | ✅ Owned |
| Code review & approval | PO (Erdinc) | ✅ Owned |
| Backend/Supabase changes | Backend Engineer (Claude Code) | ✅ Owned |
| Edge Function deployment | DevOps (Erdinc — manual via CLI) | ✅ Owned |
| EAS builds & submissions | DevOps (Erdinc — manual) | ✅ Owned |
| Analytics instrumentation | Growth (Erdinc + Claude) | ⚠️ **GAP: No analytics tool integrated. Mixpanel/Amplitude not installed. All analytics events are theoretical until SDK is added.** |
| Content moderation | Trust & Safety (Erdinc) | ⚠️ **GAP: Block/report exists but no moderation queue or dashboard. Reports go to a DB table with no review flow.** |
| Legal compliance | CPO (Erdinc) | ⚠️ **GAP: Terms & Privacy Policy are templates, not lawyer-reviewed. Hosted pages not live yet.** |
| Release approval | CPO (Erdinc) | ✅ Owned |
| Financial/billing | CPO (Erdinc) | ⚠️ **GAP: IAP is stubbed. No revenue flow exists. RevenueCat not integrated.** |

### 1.3 Identified Responsibility Leaks

| # | Leak | Impact | Resolution |
|---|------|--------|------------|
| LEAK-001 | No analytics SDK installed — all event tracking is theoretical | Cannot measure retention, conversion, or any user behavior. Every product decision is a guess. | Install Mixpanel or Amplitude before shipping. Define event catalog in Phase 3 workflow cards. |
| LEAK-002 | Reports table has no review workflow — reports are write-only | Users can report abuse but nobody reviews it. Safety risk and Apple reviewer risk. | Build admin review queue for reports, or set up email alerts on new reports. |
| LEAK-003 | Legal pages not hosted — flexmatches.com/terms and /privacy-policy return 404 | Apple will reject the app. Welcome screen links to non-existent pages. | Host pages on Vercel/Netlify before Apple submission. |
| LEAK-004 | IAP is fully stubbed — Pro subscription cannot be purchased | Revenue = $0. Pro features listed but not gated. Users have no reason to pay. | Wire RevenueCat + enforce free limits before launch. |
| LEAK-005 | No crash reporting or error monitoring tool | Bugs in production are invisible unless users report them. | Integrate Sentry or Bugsnag. |

---

### 1.4 Decision Authority Matrix

| Decision Type | Who Decides | Who Must Be Consulted |
|--------------|------------|----------------------|
| Which features to build | CPO (Erdinc) | — |
| Workflow Go/No-Go for coding | BA (Erdinc) | Architect, QA |
| Architecture patterns | Architect (Claude) | CPO for approval |
| Root cause classification | Architect (Claude) | QA for verification |
| Fix approach | Architect (Claude) | CPO for approval |
| Code implementation | App Engineer (Claude Code) | — |
| Code merge/push | CPO (Erdinc) | QA regression check |
| Release to App Store | CPO (Erdinc) | QA full sign-off |
| Schema/migration changes | Backend Engineer (Claude Code) | Architect + CPO approval |
| Edge Function deployment | DevOps (Erdinc via CLI) | Backend Engineer |
| Pricing changes | CPO (Erdinc) | — |
| Legal document changes | CPO (Erdinc) | Lawyer recommended |

---

*Phase 1 complete. Proceed to Phase 2: Workflow Inventory.*
