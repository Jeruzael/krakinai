# Phase 4 Stage A verification

Verified 2026-10-26 against PR #3 head `78e7781d237cfd416646d818835dcaec9e1fdd67` in an isolated managed worktree. PR #3 was open and unmerged; this branch targets its implementation branch. The user's running app and browser storage were not used.

## Directly verified

Persistence code, record types, IndexedDB version/stores, backup code, canonical assembler and Project JSON serializer are unchanged in Stage A. The existing 7-row workspace remains compact. Generation/provider output is a separate derived read-only representation. Local intentional preflight acknowledgements are evidence keyed and not persisted.

## Automated verification

- `npm ci`: exit 0; 189 packages installed. Existing `whatwg-encoding` deprecation; install audit reports 6 development advisories (3 moderate, 1 high, 2 critical). No dependency upgrade.
- Baseline: 71 tests / 13 files, typecheck and build all exit 0.
- Stage A: 90 tests / 17 files, `npm test` exit 0. Intermediate runs emitted React `act(...)` warnings from asynchronous MediaThumbnail effects; the final recorded Stage A run has no warnings.
- `npm run typecheck`, `npm run build`, `npm audit --omit=dev`, `git diff --check`: exit 0. Production audit: 0 vulnerabilities. Build: 415.27 kB JS / 118.98 kB gzip.
- Independent source review identified validation-ID collision and mismatched source display; both corrected and regression coverage added for validation collisions.

## Isolated Chromium

18 assertions passed: explicit Mika rear-camera/gaze, time/style/visible-speech findings; acknowledgement retention; Escape and focus restoration; exact Taglish/Unicode JSON; one identity description; smaller generation document; exact clipboard write argument and download bytes; native clipboard readback with Windows CRLF normalized; Omni dialogue formatting; golden Project JSON; no scene/draft writes; no horizontal overflow for Builder/Output at 1440, 768 and 390px.

Before screenshots: 9 files (Builder, Output, Character at three widths). Stage A screenshots: 6 files. Scripts, raw logs, generated downloads, fixture and screenshots are outside Git under the task's `phase4` visualization directory. They contain synthetic records only.

## Assumptions and remaining risks

Preflight is incomplete pattern matching, never proof of consistency. No provider generation, speech or identity quality was tested. Official provider guidance is dated and can change; unknown general duration/attachment limits remain unknown. Browser storage remains profile/origin-specific. Production audit covers the resolved production dependency graph, not a security audit of application behavior. Optional anchor/pack persistence is deliberately isolated in Stage B.
