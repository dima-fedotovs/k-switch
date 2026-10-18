# Source review

Initial review: 2026-10-18. Scanner: SCANOSS 1.54.2, public OSS Knowledge Base.
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
- `src/runtime/indicator.ts`: four fingerprint hits against npm package
  `create-codasaii-gnome-extension@1.0.4`,
  `template/src/components/counter.ts`.
  https://www.npmjs.com/package/create-codasaii-gnome-extension/v/1.0.4
  Matching content is the standard Clutter/St/Main/PanelMenu/PopupMenu import
  block and common label construction. Its counter arithmetic, settings model,
  GObject subclass and methods differ from K-switch's group indicator.

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

These four boilerplate matches are recorded in provenance.json with exact file
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
