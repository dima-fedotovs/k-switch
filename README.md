# K-switch

A GNOME Shell 50 extension for organizing keyboard input sources into overlapping
groups. Supports XKB layouts and IBus engines.

Cycle input sources within the active group using a configurable shortcut.
The default is Caps Lock, with Shift+Caps Lock toggling normal Caps Lock.
You can also assign shortcuts to move between groups.

The optional panel indicator shows the group's short name. A separate
**Show selected language** option adds the actual input source; it is off by
default. GNOME's existing language indicator remains separately managed.

## Groups and switching

Groups have a required short name, an optional long name for the indicator menu,
an ordered list of input sources, checkbox membership, and a **Skip when cycling
groups** switch. A source can belong to several groups. Empty groups are allowed
while editing. The menu uses the long name when provided, otherwise the short name.
There is no automatically generated All layouts group.

Short names and nonempty long names must each be unique, ignoring case,
surrounding spaces and Unicode composition. Empty long names can repeat.
Names containing `&`, `<` or `>` are displayed literally. Error diagnostics also
use plain text, including invalid imported values and version strings. Keyboard focus follows
stable group/source IDs when controls are rebuilt, including after a rename.

- Within a group, cycle through checked, currently available sources in order.
  From a source outside that group, select its first available member. A single
  member stays selected without reactivating its input engine.
- Next/previous shortcuts search other groups circularly in the corresponding
  direction, excluding groups marked to skip. Select the first available member
  different from the current source. If no candidate exists, do nothing.
- Selecting a group from our menu follows the first-different rule, but a group
  containing only the current source can still become active. Unavailable groups
  are disabled in the menu.
- An external selection (Super+Space, GNOME's menu, another application) keeps the
  current group if it contains that source. Otherwise search subsequent groups in
  circular order, including skipped groups. If no group contains the selected
  source, **keep the last active group and leave the chosen source active**. The
  next Caps press resumes that group's cycle at its first available member.
- Editing groups does not itself switch the keyboard. Deleting the active group,
  or losing all its available members, selects the first nonempty available group.
  With no usable groups, group switching and Caps do nothing.

The **Groups** preferences page provides short/long names, checkbox membership,
drag handles, and keyboard-accessible up/down buttons for group and source order.
The **Switching** page controls both group shortcuts, the within-group preset,
indicator visibility, source-label visibility, and import/export. Changes save
automatically; names and typed shortcuts use an explicit apply button.

Checkbox and skip-switch changes update existing controls without rebuilding the
list, preserving scroll position and keyboard focus. Rapid edits merge with the
latest saved values. Structural changes rebuild the editor and restore named focus.
Removing a source from GNOME removes its rows from user groups. Re-adding it
appends an unchecked row. Temporarily unavailable IBus engines retain their
checkboxes; switching skips them until GNOME exposes them again.

## Shortcuts and GNOME Settings

Within-group presets: Caps Lock, Shift+Caps Lock, Alt+Caps Lock, Menu, Scroll Lock,
both Shift keys, Alt+Shift, and Ctrl+Shift. Modifier combinations have conflict
notes. Caps Lock remains the default.

Next/previous group shortcuts are **unset by default**. Enter a GTK accelerator
such as `<Super><Alt>space` or `<Super><Alt>b` and apply it; clear it to disable.
Unmodified function keys such as `F8` are also accepted. Separate modifier-only
group switching such as Ctrl+Shift is unsupported: the XKB switching signal does
not identify which modifier combination triggered it.

Group shortcuts are registered directly with GNOME Shell and work in applications
and the overview while K-switch is enabled. Configure them in K-switch; they do
not appear in GNOME Settings. No external command, helper or Custom Shortcuts
registration is used. Disabling releases both bindings. Changes apply live.
A registration failure rolls back acquired bindings and reports a startup error;
choose another assignment and re-enable. Accelerators already owned by another
component may be unavailable.

Next and previous must be different when both are set: GTK-equivalent spellings
such as `<Ctrl><Alt>n` and `<Alt><Control>n` are rejected on edit/import. Both may
be empty. Existing assignments are never silently rewritten; saved duplicates
are marked as errors in preferences until corrected.

While enabled, K-switch temporarily replaces **`grp:` XKB options** with the
within-group preset, preserving other options. Disabling restores previous group
options unless independently changed. Caps remaps, including the combined
Caps-to-Ctrl/Left-Ctrl group toggle, are rejected before enabling a Caps preset.

## Interface language

The interface follows the GNOME environment's language automatically. English is
the source/fallback; Russian and Latvian catalogs cover all application messages,
including notifications, validation and accessible descriptions. Update warnings
are localized even when Shell metadata was cached before translations were added. There is no
separate language selector. Keyboard sources are independent of UI language.

Automatic group names are translated once, when created, and checked for
uniqueness in that language. Existing group names, source names/IDs and exported
field names are preserved when the environment language changes.

## Configuration and migration

On a fresh installation, **Primary** enables the first two sources in GNOME's
saved input-source order, including IBus. Other sources start unchecked. With
one source only that source is enabled; an empty list creates an empty group.
There is no fixed US/RU default. Explicit legacy pair settings are migrated
instead; existing group configurations are preserved.
Legacy source keys have empty defaults. Only their explicitly saved, nonempty
values are migrated; an unset legacy field never inserts a language.

Existing pair preferences migrate to **Primary**, preserving order and the
within-group shortcut. Version 2 group configurations preserve their group IDs,
short names, memberships, order and next-group shortcut. Their generated system
group is removed. New optional long names and the previous shortcut start empty;
source-label display defaults off. A saved active system-group ID selects the
first usable user group. The last active group remains per-computer state and is
not exported.

Import accepts versions 1, 2 and 3 and validates before writing. Unknown fields,
duplicate identifiers and unsupported versions are rejected. Sources absent on
the target computer are removed with a message; import never changes GNOME input
sources. Configuration files are UTF-8 JSON with a 16 KiB size limit. Oversized
exports are rejected before replacing a file.
Duplicate names in imports are rejected before writing. Previously saved duplicate
names receive ` (2)`, ` (3)` suffixes without deleting groups or changing their IDs,
membership or order. Existing suffixed names are reserved during that repair.

Version 3 stores `groups` (ordered objects with `id`, `name`, `longName`, `skip`,
and ordered `entries` containing `source`/`enabled`), `shortcut`, `groupShortcut`
(next), `previousGroupShortcut`, `showIndicator`, `showSource`, and `version`.
Source IDs include their type, for example `xkb:us` or `ibus:anthy`. Legacy
GSettings keys are retained for migration; subsequent edits use version 3.

## Development and architecture

Requirements: Node.js 24.22 or newer in the 24.x series, npm, Python 3.12+, GJS, GNOME's
`gnome-extensions` CLI, `glib-compile-schemas`, and GNU gettext tools. Native UI checks also use
English, Russian and Latvian UTF-8 locales, Xvfb, D-Bus and ImageMagick's `import` command. TypeScript 6.0.3 is pinned for
compilation and typed linting. `.nvmrc` pins the tested Node 24.22.0 patch so CI
uses the same runtime instead of an older preinstalled 24.x release.

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --require-hashes -r security/shexli-requirements.txt
npm ci
npm run hooks:install
npm run check
```

`check` requires formatting, typed ESLint with zero warnings, shell syntax,
strict TypeScript, unit tests with **100% statements/functions/branches/lines for
`src/core`**, strict schema compilation, exact ZIP content verification (including Prettier style and a 200-character JavaScript
line limit), catalog freshness/completeness/placeholder validation, and a
real GJS/GSettings/file smoke test with an in-memory backend. It also runs the
hash-locked Shexli 0.2.1 analyzer on the built ZIP and requires zero findings.
Keep the virtual environment active when running checks or committing.

```sh
npm run format
npm run quality:prove
npm run quality:prove:shexli
npm run test:prefs
npm run test:shell
```

Socket/display integration checks require escalation on their first attempt in
a managed sandbox. They use private D-Bus sessions and temporary XDG state and
never install into or configure the working desktop. Both native fixtures select
local GIO VFS; the Shell fixture checks its local URI capabilities before
behavioral tests and unmounts its private document portal before D-Bus shutdown.
The launcher supplies all temporary XDG paths before starting D-Bus. The session
script refuses mismatched paths before running any desktop settings command.
Native fixtures load the same formatted production runtime checked inside the ZIP.
Results are in `artifacts/`.

| Directory            | Responsibility                                                     |
| -------------------- | ------------------------------------------------------------------ |
| `src/core`           | Pure group selection, validation, migration and resource ownership |
| `src/runtime`        | Shell input sources, shortcuts, lifecycle and panel indicator      |
| `src/shared`         | GSettings persistence and configured-source reconciliation         |
| `src/prefs`          | GTK4/libadwaita editor and bounded configuration-file operations   |
| `types/shell50.d.ts` | Narrow contract missing from upstream GNOME 50 typings             |
| `test`               | Unit, real GJS, GTK and headless GNOME checks                      |

GNOME Shell and preferences run in separate processes. Lint rules enforce their
boundaries. Only the runtime adapter uses Shell's internal source-manager API.
The entry point owns the runtime-version D-Bus service from enable to disable,
including pending or failed initialization; it reports executing code, not readiness.
A startup failure releases the working session and notifies once. Correct the
cause and re-enable to retry.
Owned handlers, the runtime-version D-Bus service, direct keybindings, panel
widgets and XKB options are released on disable.
The GNOME 50.1 adapter applies the current XKB ID explicitly after option changes:
the installed `reapply()` passes an object where its helper expects an ID. Native
tests press new shortcuts without an intervening source activation and reject
critical Shell log messages.

## Local installation

**Updating from 0.4.0:** export settings using the old preferences window before
replacing the extension. Close preferences, disable K-switch, install the new ZIP,
then log out and sign in again. Open the new preferences and import that file.
The old `/guru/bug/k-switch/` settings are left untouched and are not migrated
automatically. Import preserves groups and shortcuts; the active group is local
state and is not part of an export. A fresh installation still enables the first
two configured GNOME input sources.

```sh
npm run check
gnome-extensions install --force artifacts/k-switch@bug.guru.shell-extension.zip
```

Version 0.4.0 renames Layout Pair to **K-switch** and uses the domain `bug.guru`.
The UUID is `k-switch@bug.guru`. Starting with 0.4.1, the GSettings schema is
`org.gnome.shell.extensions.guru.bug.k-switch` with path
`/org/gnome/shell/extensions/guru/bug/k-switch/`, following GNOME's extension
review requirements. The D-Bus action interface remains `guru.bug.KSwitch` at
`/guru/bug/KSwitch`.

For future K-switch updates, close preferences and disable K-switch before
replacing the ZIP. On Wayland, log out and back in to load changed Shell code.
On first installation, log out and back in if GNOME has not discovered the
extension:

```sh
gnome-extensions enable k-switch@bug.guru
gnome-extensions prefs k-switch@bug.guru
```

Repository checks never install or enable it in the working desktop.

Preferences query a version method provided by the active runtime code, rather
than trusting Shell's cached metadata. For an inactive extension they use Shell's
metadata; enabling cached code also checks the installed version asynchronously
before opening settings or acquiring resources. The lifecycle entry point returns synchronously; initialization runs asynchronously.
Disabling cancels its owned request before startup can acquire switching resources.
Late results from a previous activation cannot affect a newer one. These versions must match the preferences code
and installed `metadata.json` **before loading or migrating configuration**.
If they differ, editing and import/export are unavailable: a
status screen lists all three versions and asks you to log out and sign in again.
Saved groups are preserved. Updates while the window is open also trigger this
check. A failed version query keeps editing blocked and provides **Check again**.
An inactive extension with matching versions can still be configured.
Both entry points use the schema declared in metadata. UUID, version and schema
are verified against installed metadata before obtaining GSettings. Stale schema
metadata blocks startup/editing until a new session; no schema is substituted.
Pending file dialogs are cancelled when editing is blocked or the window closes.
Import/export recheck the versions immediately before writing, so a late dialog
completion cannot bypass the guard or replace a file after cancellation.

Seeing **All layouts** only in the panel, or errors mentioning
`allSkip,groupShortcut,groups,shortcut,showIndicator,version`, means the Shell is
still executing the older group implementation while newer preferences have
been opened. Reinstalling the ZIP or toggling the extension does not clear its
loaded module cache. Start a new session when convenient; do not reset your
groups. Closing preferences before an update also avoids cached preferences
modules. The guard becomes available once the new preferences code is loaded;
it cannot retrofit itself into a window already executing older code.

## Quality and publication status

K-switch is distributed through [GitHub](https://github.com/dima-fedotovs/k-switch).
Versions below 1.0 are pre-releases; check the repository's Releases page for
published artifacts. No EGO publication is configured.
Unit tests cover group policy, migration and configuration validation with
100% core coverage in all four metrics.
Native checks exercise sticky unassigned sources, group overlap/order, separate
short/long names, optional source display, indicator selection/visibility, real
IBus activation, unavailable engines, source removal, virtual evdev input for all
eight presets, both direct group shortcuts, live reassignment, empty assignments, registration
rollback and cleanup/re-enable scenarios. GTK checks reject equivalent shortcut
assignments on edit/import and display saved duplicates without rewriting them.
GTK checks cover group and source editing, settings updates after import, and a
three-group scrolling regression with focused/unfocused controls, rapid checkbox
edits and external settings updates.
The preferences guard is exercised against a private D-Bus Shell service,
including an old runtime, matching inactive runtime, updates with the window
open, metadata/runtime disagreement, missing runtime APIs and retry. Controlled
file-dialog completions exercise cancellation on update/close, version changes
before writing, and successful import/export. Fresh GSettings checks cover zero,
one, two and three configured sources, IBus-first ordering and legacy overrides.
A second private Shell starts without US or Russian sources and verifies fresh
membership and real Caps cycling directly against its configured source order.
Indicator tests toggle both options repeatedly with the menu open and ensure
activating a group retains its menu item until event handling completes.
Preferences-opening D-Bus failures are handled and reported; disabling cancels
outstanding requests. English, Russian and Latvian fixtures check translated GTK controls and the
Shell menu, literal names, focus and fresh FR/DE/ES setup. Gettext negative
controls reject stale POT, untranslated/fuzzy catalogs, bad placeholders and
missing tools. Manual wording and visual acceptance of both translations is
tracked in [#19](https://github.com/dima-fedotovs/k-switch/issues/19).
Laptop acceptance after a full sign-out/sign-in remains a
manual check; repository tests do not restart either working desktop.

GitHub CI runs on the explicit `ubuntu-26.04` image and checks GNOME Shell 50
before native tests. Required checks include quality/coverage, negative
controls, GTK/headless GNOME, secret scanning, licenses,
moderate-or-higher npm vulnerabilities, CodeQL for TypeScript and Actions, and
Shexli. The Shexli gate parses JSON rather than trusting the scanner's exit code:
errors, warnings and manual-review findings all block the build. Missing tools,
scanner errors or diagnostics, malformed/inconsistent reports and incomplete file inventories
also block it. The report's input, file counts and GNOME targets must match the
actual ZIP. Controlled fixtures verify rejection of schema violations,
synchronous Shell IO, unavailable/failing scanners and malformed/partial reports.
The quality job scans the final ZIP again before uploading release assets; the
release workflow publishes that same artifact. Reports are retained in the
`shexli-results` Actions artifact.
Required scanner failures block CI. ScanCode reports must match the exact input
file inventory and include their result fields; directory-only, partial, duplicate
or malformed reports and diagnostics are rejected before reading reported paths.
The VCS metadata file `.gitignore` is scanned separately in explicit single-file
mode because ScanCode skips it during directory traversal. SCANOSS runs locally before a release,
separately from GitHub CI; no PR, scheduled or release job contacts its API.
See [SECURITY.md](SECURITY.md) and [the source review](security/PROVENANCE.md).
Scanner dependencies are hash-locked.

Changes to main go through pull requests with required green checks. Dependabot
updates npm and Actions dependencies weekly; security checks also run weekly.
Compatible npm updates and Actions updates are grouped to limit PR noise. Major
Node typings and TypeScript upgrades require a coordinated runtime/linter change:
Node typings follow Node 24, and the pinned typescript-eslint supports TypeScript
below 6.1. Hosted quality checks upload/download the release assets and verify
their hashes before publication.
Actions are pinned to full commits, and only the release job has publication
permissions. The backup development branch remains local.

Before a stable release or an EGO submission:

- Review and accept maintainership, including the AI-assisted entry points;
  follow the [GNOME review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html).
- Complete manual acceptance on both computers, including real drag gestures,
  keyboard navigation, file-picker import/export and normal application input.
- Decide whether to support older GNOME versions.

The extension runs in the normal user session; login/lock-screen behavior is not
promised. Ptyxis/GTK4 non-Latin application shortcuts are a separate investigation.

The initial interception approach was inspired by
[Switch Two Layouts](https://extensions.gnome.org/extension/4042/switch-two-layouts/)
by Alice Mikityanska. License: **GPL-3.0-or-later**.

## GitHub releases

Repository: https://github.com/dima-fedotovs/k-switch

Before tagging, a maintainer runs `npm run build && npm run security` locally
with the locked scanner environment. This sends only source fingerprints to
SCANOSS. Review every new match and retain exact approvals in
`security/provenance.json`; an unavailable service leaves this local review
unfinished. GitHub cannot certify that this manual step happened. CI uses
`npm run security:ci` for ScanCode and Gitleaks, and its report explicitly marks
provenance as `local-only-not-run`.

A tag such as `v0.4.0` reruns the complete hosted gate. The tag must match all project
version declarations and refer to a commit from main. Versions below 1.0 and
versions with a prerelease suffix are marked as pre-releases. Failed checks do
not publish a release. A repeated run cannot replace an existing release.
The checkout and remote tag's peeled commit must equal the commit resolved from
the immutable workflow event SHA, including annotated tags. The remote reference is checked again just
before publishing; moved, deleted and off-main tags stop the release. The
repository also protects `v*` tags against updates and deletion without bypasses;
the policy is recorded in `.github/release-tag-ruleset.json` for maintainers.

The verified ZIP, SHA256SUMS and CycloneDX SBOM are attached to the release.
The SBOM inventories npm build/development dependencies, not code bundled into
the extension. LICENSE and NOTICE are included inside the ZIP.

After downloading all release assets into one directory:

```sh
sha256sum --check SHA256SUMS
gh attestation verify k-switch@bug.guru.shell-extension.zip --repo dima-fedotovs/k-switch
```

The build-provenance attestation binds the ZIP to its repository, commit and
workflow. It does not certify runtime safety. Release publication uses the same
ZIP checked in that tag workflow; it does not rebuild it in the publishing job.

To run the publication scans locally, install `security/requirements.txt` with
Python 3.12 and `pip install --require-hashes`, plus Gitleaks 8.30.1. Build first,
then run `npm run security`. This contacts the public SCANOSS API using WFP
fingerprints. Generated reports remain under ignored `artifacts/security/`.
