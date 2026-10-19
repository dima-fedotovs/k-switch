# Source review

Initial review: 2026-10-18. Scanner: SCANOSS 1.54.2, public OSS Knowledge Base.
Pre-release review refreshed: 2026-10-19 for version 0.4.2, covering all 83
fingerprinted source, test and script files. The fingerprint inventory was
compared with the complete tracked source/test/script allowlist before submission.
One complete SCANOSS report supplied the review; subsequent validation reuses it
without another API scan. The initial managed-worktree attempt produced an empty
fingerprint file because SCANOSS skipped the hidden `.codex` parent directory;
the gate rejected it. Fingerprinting now allows hidden parent paths within the
explicit staging tree, which excludes dependencies and build output.
Four files returned matches, all retaining their existing exact file and match
approvals: codeql-gate, security-negative, keybindings and fixture-isolation.
No new matches require approval. The indicator and transfer implementations no
longer return matches; their earlier reviews remain documented here and bound
to their earlier file hashes.
The reviewed declarations and comparisons concern the tracked project source;
they are not a universal originality certificate.

## Known influence

Switch Two Layouts v13 by Alice Mikityanska supplies the signal interception
technique, not the group policy. Its published source declares
`MIT OR GPL-2.0-or-later`. Attribution and the selected GPL option are retained
in the distributed NOTICE. The ownership wrapper, groups and adapters are
implemented separately. GNOME Shell APIs were checked against the installed
GNOME 50.1 resources; the runtime imports those modules instead of bundling them.

## Reviewed SCANOSS matches

- `src/prefs/transfer.ts`: four fingerprint hits against
  `jeffshee/gnome-ext-hanabi`, revision `5cd090d`, `src/prefs.ts`.
  https://github.com/jeffshee/gnome-ext-hanabi/blob/5cd090d/src/prefs.ts
  Comparison shows common SPDX/import declarations and GTK/Adwaita signatures;
  its wallpaper preferences implementation is different. The longest normalized
  common run is the SPDX header followed by GI imports. This does not establish
  that its application logic was copied. The source itself declares
  GPL-3.0-or-later; the scanner's component-level GPL-3.0-only label is less
  specific than that file's notice.
- `src/runtime/indicator.ts` (0.4.1 historical review): four fingerprint hits against npm package
  `create-codasaii-gnome-extension@1.0.4`,
  `template/src/components/counter.ts`.
  https://www.npmjs.com/package/create-codasaii-gnome-extension/v/1.0.4
  Retrieved upstream MD5: `e78e76aa2d4ad660ad74be5bc7f95556`, matching the
  0.4.1 report. The reviewed span was K-switch lines 6-14 and upstream lines 5-13.
  Matching content is the standard Main/PanelMenu/PopupMenu import block and
  common label construction. Its counter arithmetic, settings model, GObject
  subclass and methods differ from K-switch's group indicator.
- `src/runtime/keybindings.ts`: four hits against
  `boerdereinar/copyous@v1.0.0`, `src/lib/misc/shortcuts.ts`.
  https://github.com/boerdereinar/copyous/blob/v1.0.0/src/lib/misc/shortcuts.ts
  Retrieved upstream MD5: `4fce3c2efb6908fab65efc7a725d3b41`, matching the
  report. The reported spans are K-switch lines 5-15 and upstream lines 6-16,
  covering common Shell/Main import scaffolding near the declarations.
  The upstream manages clipboard actions through GObject properties, actor
  events and a file monitor. K-switch registers two ordered-group callbacks,
  limits their action modes and rolls back partial registration failures.
  The comparison supports a framework-boilerplate match; it does not identify
  shared application or cleanup logic. No additional code attribution is
  required by this finding.

- `scripts/codeql-gate.ts`: four hits against
  `SerenityJS/vanilla-behaviors`, ref `beta`, `src/behavior-pack.ts`.
  https://github.com/SerenityJS/vanilla-behaviors/blob/beta/src/behavior-pack.ts
  The retrieved file MD5 equals the scanner's file_hash. The common normalized
  run is `import { readdirSync, readFileSync } from node:fs; import { join ... }`.
  The upstream implements Minecraft behavior packs, not SARIF policy.
- `scripts/security-negative.ts`: four hits against
  `fitlab-ai/agent-infra@v0.7.6`, `tests/integration/cli/cli.test.ts`.
  https://github.com/fitlab-ai/agent-infra/blob/v0.7.6/tests/integration/cli/cli.test.ts
  The retrieved file MD5 equals the scanner's file_hash. The common normalized
  run is the assert and execFileSync/spawnSync Node import sequence. The upstream
  tests sandbox-engine bootstrapping; K-switch tests redacted scanner rejection.
- `test/fixture-isolation.test.ts`: seven hits against
  `openclaw/clawsweeper`, revision `04e5065`, `test/setup-codex-context.test.ts`.
  https://github.com/openclaw/clawsweeper/blob/04e5065/test/setup-codex-context.test.ts
  The retrieved file MD5 equals the scanner's file_hash. The reported lines
  cover standard Node assert, subprocess, filesystem, temporary-directory, path
  and test imports. The upstream configures a Codex API context; K-switch checks
  that an unisolated Shell fixture exits before invoking desktop settings tools.
  No application or test logic is shared by this match.

These boilerplate matches are recorded in provenance.json with exact file
and normalized match hashes. Changing a source file or match requires a new
review. No whole project, directory or upstream license is blanket-excluded.

## Dependency inventory

All npm dependencies are development/build tools and are excluded from the
extension ZIP. The release CycloneDX SBOM retains each dependency's declared
license and marks its build/development purpose. ScanCode scans both the tracked
source distribution and the files placed in the extension ZIP.

## License-text false positives

ScanCode also reads identifiers in NOTICE, the npm lock-file inventory, review
notes and scanner test fixtures as license text. It can interpret TypeScript
uses of JSON near license-policy code as the historical JSON license, and the
plain upstream license sentence as GPL-1.0-or-later fragments. These are not new
license grants for those files. Reviewed metadata detections are recorded in
licenses.json by exact path, source SHA256 and expression; modifying their text
requires renewed review. The declarative licenses.json policy is validated as
review data rather than recursively interpreting its license names as licenses.
