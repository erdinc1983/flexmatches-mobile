# FlexMatches™ — Release Control Guide

> **Owner:** Erdinc (PO & Sole Release Authority)
> **Entity:** FlexMatches LLC (Delaware)
> **Last updated:** April 2026

---

## 1. Release Authority

**Only Erdinc (PO) can approve and execute releases.** No code reaches production without PO sign-off. Claude Code can write code, but NEVER pushes to production or triggers builds without explicit PO approval.

### Release Approval Checklist
Before ANY release, PO must verify:

- [ ] All stories in sprint are marked Done
- [ ] All QA verification tasks passed
- [ ] No critical or high-severity bugs open
- [ ] App tested on physical iOS device
- [ ] App tested on physical Android device (or emulator)
- [ ] Dark mode verified on key screens
- [ ] No console errors or warnings
- [ ] CLAUDE.md updated with completed sprint status
- [ ] Changelog written (see Section 5)
- [ ] PO signs off: "Approved for release"

---

## 2. Version Numbering Strategy

### Semantic Versioning: MAJOR.MINOR.PATCH

| Component | When to increment | Example |
|-----------|------------------|---------|
| **MAJOR** | Breaking changes, major redesign, platform migration | 1.0.0 → 2.0.0 |
| **MINOR** | New features, new screens, significant enhancements | 1.0.0 → 1.1.0 |
| **PATCH** | Bug fixes, performance improvements, minor tweaks | 1.0.0 → 1.0.1 |

### Current Version
- **app.json version:** `1.0.0`
- **iOS buildNumber:** `8` (auto-increments via EAS)
- **Android versionCode:** `1` (auto-increments via EAS)

### Version History

| Version | Date | Type | Changes |
|---------|------|------|---------|
| 1.0.0 | April 2026 | Initial | App Store submission — Eagle 0–5 complete |

### How to update version:
```json
// app.json — update "version" field
"version": "1.1.0"
```
EAS handles buildNumber/versionCode auto-increment. You only change the `version` string.

---

## 3. Environment Strategy

### Build Profiles (eas.json)

| Profile | Purpose | Channel | When to use |
|---------|---------|---------|-------------|
| `development` | Local dev with dev client | — | Daily development |
| `simulator` | iOS Simulator testing | — | Quick UI testing |
| `preview` | Internal testing (TestFlight/Internal) | `preview` | Pre-release QA |
| `production` | App Store / Google Play | `production` | Public releases only |

### Build Commands

```bash
# Development build (for your iPhone via USB)
eas build --platform ios --profile development

# Preview build (TestFlight for beta testers)
eas build --platform ios --profile preview

# Production build (App Store submission)
eas build --platform ios --profile production

# Android production
eas build --platform android --profile production

# Submit to App Store (after production build)
eas submit --platform ios --latest

# Submit to Google Play (after production build)  
eas submit --platform android --latest
```

### OTA Updates (expo-updates)

For small fixes that don't require a new binary build:

```bash
# Push an OTA update to preview channel
eas update --branch preview --message "Fix: session button color"

# Push an OTA update to production channel
eas update --branch production --message "Fix: streak display bug"
```

**⚠️ OTA limitations:** Cannot change native code, permissions, or app.json config. Only JS/TS changes. If you change anything in `app.json`, `eas.json`, or add a new native module, you MUST do a full build + store submission.

---

## 4. Release Process — Step by Step

### 4.1 Regular Release (new features / bug fixes)

```
1. DEVELOP
   └── All stories coded on master branch
   └── Claude Code commits with [FM-XXX] convention
   └── PO reviews each commit

2. QA
   └── Build preview: eas build --platform ios --profile preview
   └── Install on test device via TestFlight
   └── Run through QA verification tasks
   └── Test on Android emulator or device

3. APPROVE
   └── PO runs Release Approval Checklist (Section 1)
   └── PO updates version in app.json if needed
   └── PO writes changelog entry

4. BUILD
   └── eas build --platform ios --profile production
   └── eas build --platform android --profile production

5. SUBMIT
   └── eas submit --platform ios --latest
   └── eas submit --platform android --latest
   └── Update "What's New" in App Store Connect
   └── Update "Release Notes" in Google Play Console

6. MONITOR
   └── Watch for Apple/Google review feedback
   └── Monitor crash reports after release
   └── Check analytics for unexpected drops

7. DOCUMENT
   └── Update version history in this file
   └── Update CLAUDE.md sprint status
   └── Git tag: git tag -a v1.1.0 -m "Release 1.1.0"
   └── git push origin v1.1.0
```

### 4.2 Hotfix Release (critical bug in production)

```
1. IDENTIFY
   └── Critical bug reported by user or crash monitoring
   └── PO decides: hotfix (OTA) or full release?

2. IF OTA-ELIGIBLE (JS-only fix):
   └── Fix the bug
   └── Test locally
   └── eas update --branch production --message "Hotfix: [description]"
   └── Done — no App Store review needed

3. IF FULL BUILD NEEDED (native change):
   └── Fix the bug
   └── Increment PATCH version (e.g., 1.0.0 → 1.0.1)
   └── eas build --platform ios --profile production
   └── eas submit --platform ios --latest
   └── Request expedited review in App Store Connect
   └── App Store Connect → App → click "Contact Us" or use expedited review option
```

### 4.3 Beta / TestFlight Release

```
1. Build preview: eas build --platform ios --profile preview
2. EAS automatically uploads to TestFlight (internal testing)
3. Add beta testers in App Store Connect → TestFlight → Internal/External Testing
4. Testers install via TestFlight app on their iPhone
5. Collect feedback → fix → repeat
```

---

## 5. Changelog Format

Every release gets an entry in this format:

```markdown
## v1.1.0 — [Release Name] (YYYY-MM-DD)

### New Features
- FM-XXX: [Feature description]
- FM-XXX: [Feature description]

### Bug Fixes
- FM-XXX: [Bug description + fix]

### Improvements
- [Performance, UX, or technical improvement]

### Known Issues
- [Any known issues shipping with this release]
```

---

## 6. App Store Credentials & Access

### Apple App Store Connect
- **Apple ID:** erdincemur@gmail.com
- **Team ID:** 5R7ZFWNABK
- **ASC App ID:** 6761497083
- **Bundle ID:** com.flexmatches.app

### Google Play Console
- **Package:** com.flexmatches.app
- **Developer Account:** [TODO — create under FlexMatches LLC]

### EAS / Expo
- **Owner:** erdinc1983
- **Project ID:** 4e957dd8-fd32-4678-9b74-4232d65e658d
- **Project:** flexmatches

### Supabase
- **Project URL:** [from .env — EXPO_PUBLIC_SUPABASE_URL]
- **Edge Functions:** delete-account, admin-action, verify-iap
- **RPC Functions:** log_checkin

### Domain
- **Website:** flexmatches.com
- **Terms:** flexmatches.com/terms
- **Privacy:** flexmatches.com/privacy-policy

---

## 7. Supabase Edge Function Deployment

Edge Functions are deployed independently from the app. They run on Supabase's edge network.

```bash
# Deploy all Edge Functions
supabase functions deploy delete-account
supabase functions deploy admin-action
supabase functions deploy verify-iap

# Set secrets (one-time, per function)
supabase secrets set APPLE_SHARED_SECRET=your_apple_secret

# View logs
supabase functions logs delete-account
supabase functions logs admin-action
supabase functions logs verify-iap
```

**⚠️ Edge Functions are NOT part of OTA updates.** They must be deployed separately via the Supabase CLI. A new app version does NOT automatically update Edge Functions.

---

## 8. Rollback Procedures

### OTA Rollback
```bash
# List recent updates
eas update:list

# Roll back by publishing a previous JS bundle
eas update --branch production --message "Rollback to pre-[issue] state"
```

### Full Build Rollback
If a production build has a critical issue:
1. The previous build is still available in App Store Connect
2. In App Store Connect → App → Build → select previous build
3. Submit the previous build for review
4. Or push OTA update to fix the issue (faster than re-review)

### Supabase Rollback
```bash
# Edge Functions: redeploy previous version from git
git checkout v1.0.0 -- supabase/functions/
supabase functions deploy [function-name]

# Database: migrations are one-way — always test in preview first
```

---

## 9. Security & Access Control

### Who has access to what:

| System | Who | Access Level |
|--------|-----|-------------|
| GitHub (erdinc1983/flexmatches-mobile) | Erdinc | Owner (full) |
| Apple Developer / App Store Connect | Erdinc | Account Holder |
| Google Play Console | Erdinc (TODO) | Account Owner |
| Supabase Dashboard | Erdinc | Owner |
| EAS / Expo Dashboard | Erdinc | Owner |
| flexmatches.com (domain) | Erdinc | Registrant |
| FlexMatches LLC (Delaware) | Erdinc | Sole Member |

### Adding team members later:
- **GitHub:** Add as collaborator with "Write" access (not Admin)
- **App Store Connect:** Add as "Developer" role (cannot submit or manage pricing)
- **Supabase:** Add as "Developer" role (cannot delete project or manage billing)
- **EAS:** Share project but retain owner role

**Never share:** Apple Developer account password, Supabase service-role key, .env file, APPLE_SHARED_SECRET.

---

## 10. Pre-Submission Checklist (App Store / Google Play)

### Apple App Store — First Submission
- [ ] App runs on physical iPhone without crashes
- [ ] All screens tested in both light and dark mode
- [ ] Test account created (email + password for Apple reviewer)
- [ ] APP_STORE_LISTING.md [TODO] fields filled in
- [ ] Screenshots (6.7" and 6.1" required) uploaded
- [ ] App icon (1024x1024) uploaded
- [ ] Privacy Policy URL live and accessible
- [ ] Terms of Service URL live and accessible
- [ ] Age rating questionnaire completed (12+)
- [ ] In-App Purchase products created in App Store Connect (if IAP active)
- [ ] App Review notes include test account credentials
- [ ] Copyright updated to "2026 FlexMatches LLC"
- [ ] Export compliance: ITSAppUsesNonExemptEncryption = false ✅

### Google Play — First Submission
- [ ] App runs on Android device or emulator without crashes
- [ ] Google Play Developer account created under FlexMatches LLC ($25)
- [ ] App signing key generated via Play App Signing
- [ ] Store listing: title, description, screenshots, icon
- [ ] Privacy Policy URL
- [ ] Content rating questionnaire completed
- [ ] Target audience and content declarations
- [ ] Data safety section completed
- [ ] Internal testing track → closed testing → production (Google requires staged rollout)

---

## 11. Future Release Planning Template

For each planned release, copy this template:

```markdown
# Release Plan: v[X.Y.Z] — [Release Name]

## Release Date (target): YYYY-MM-DD
## Sprint: Eagle [N] / Growth [N]
## Release Type: Feature / Bugfix / Hotfix

## Stories Included:
| Key | Title | Status |
|-----|-------|--------|
| FM-XXX | [Title] | Done / In Progress |

## Dependencies:
- [ ] Edge Function deployment needed? Which ones?
- [ ] Database migration needed?
- [ ] New environment variables needed?
- [ ] New native module added? (requires full build, not OTA)

## Testing:
- [ ] QA verification complete
- [ ] iOS physical device tested
- [ ] Android tested
- [ ] Dark mode tested
- [ ] New user flow tested (fresh install)

## Approval:
- [ ] PO approved for release
- [ ] Changelog written
- [ ] Version updated in app.json

## Post-Release:
- [ ] Monitor crash reports for 24 hours
- [ ] Check analytics for anomalies
- [ ] Update CLAUDE.md
- [ ] Git tag created
```
