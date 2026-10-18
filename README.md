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

While the extension is enabled, two actions appear under **GNOME Settings →
Keyboard → View and Customize Shortcuts → Custom Shortcuts**:

- **K-switch: Next group**
- **K-switch: Previous group**

Assign either there or in our Switching page. Changes synchronize both ways.
Deleting a system action clears its assignment; assigning a new nonempty shortcut
in K-switch restores that action. GNOME's settings daemon handles the global
key and invokes the corresponding extension D-Bus action. These are standard
[GNOME custom shortcuts](https://help.gnome.org/gnome-help/keyboard-shortcuts-set),
not replacements for GNOME's input-source shortcuts.

Disabling removes only our registered paths and unexports our actions. Unrelated
custom shortcuts and paths repurposed to another command are preserved. When the
system schemas are unavailable, locked, or the reserved path belongs to another
command, a notification explains that extension-local bindings are used instead;
those fallback bindings do not appear in GNOME Settings. An accelerator already
owned by another component may be unavailable; choose another combination.

While enabled, K-switch temporarily replaces **`grp:` XKB options** with the
within-group preset, preserving other options. Disabling restores previous group
options unless independently changed. Caps remaps and the competing Switch Two
Layouts extension are detected; do not run both switchers together.

## Configuration and migration

On a fresh installation, **Primary** enables the first two sources in GNOME's
saved input-source order, including IBus. Other sources start unchecked. With
one source only that source is enabled; an empty list creates an empty group.
There is no fixed US/RU default. Explicit legacy pair settings are migrated
instead; existing group configurations are preserved.

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

Version 3 stores `groups` (ordered objects with `id`, `name`, `longName`, `skip`,
and ordered `entries` containing `source`/`enabled`), `shortcut`, `groupShortcut`
(next), `previousGroupShortcut`, `showIndicator`, `showSource`, and `version`.
Source IDs include their type, for example `xkb:us` or `ibus:anthy`. Legacy
GSettings keys are retained for migration; subsequent edits use version 3.
System custom-shortcut names, commands and registration paths are local integration
state and are not exported.

## Development and architecture

Requirements: Node.js 24.22 or newer in the 24.x series, npm, GJS, GNOME's
`gnome-extensions` CLI, and `glib-compile-schemas`. Native UI checks also use
Xvfb, D-Bus and ImageMagick's `import` command. TypeScript 6.0.3 is pinned for
compilation and typed linting. `.nvmrc` pins the tested Node 24.22.0 patch so CI
uses the same runtime instead of an older preinstalled 24.x release.

```sh
npm ci
npm run hooks:install
npm run check
```

`check` requires formatting, typed ESLint with zero warnings, shell syntax,
strict TypeScript, unit tests with **100% statements/functions/branches/lines for
`src/core`**, strict schema compilation, exact ZIP content verification, and a
real GJS/GSettings/file smoke test with an in-memory backend.

```sh
npm run format
npm run quality:prove
npm run test:prefs
npm run test:shell
```

Socket/display integration checks require escalation on their first attempt in
a managed sandbox. They use private D-Bus sessions and temporary XDG state and
never install into or configure the working desktop. Both native fixtures select
local GIO VFS; the Shell fixture checks its local URI capabilities before
behavioral tests and unmounts its private document portal before D-Bus shutdown.
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
Owned handlers, custom-shortcut registrations, D-Bus actions, local fallback
keybindings, panel widgets and XKB options are released on disable.
The GNOME 50.1 adapter applies the current XKB ID explicitly after option changes:
the installed `reapply()` passes an object where its helper expects an ID. Native
tests press new shortcuts without an intervening source activation and reject
critical Shell log messages.

## Local installation

```sh
npm run check
gnome-extensions install --force artifacts/k-switch@bug.guru.shell-extension.zip
```

Version 0.4.0 renames Layout Pair to **K-switch** and uses the domain `bug.guru`.
The UUID is `k-switch@bug.guru`, GSettings schema is `guru.bug.k-switch` with path
`/guru/bug/k-switch/`, and D-Bus action interface is `guru.bug.KSwitch` at
`/guru/bug/KSwitch`.

This is a separate extension identity with independent settings. It does not read
or modify the old Layout Pair namespace, migrate its settings automatically, or
coordinate with the old extension. To keep groups, export them from Layout Pair
before removing it, then import the file into K-switch. Existing file formats
remain supported. Remove the old extension before enabling the new one.

For future K-switch updates, close preferences and disable K-switch before
replacing the ZIP. On Wayland, log out and back in to load changed Shell code.
On first installation, log out and back in if GNOME has not discovered the
extension. Disable Switch Two Layouts before enabling K-switch:

```sh
gnome-extensions enable k-switch@bug.guru
gnome-extensions prefs k-switch@bug.guru
```

To return to the original setup, disable K-switch and re-enable the previous
extension. Repository checks never install or enable it in the working desktop.

Preferences verify GNOME Shell's cached `GetExtensionInfo` version against their
own code version and the installed `metadata.json` **before loading or migrating
configuration**. If they differ, editing and import/export are unavailable: a
status screen lists all three versions and asks you to log out and sign in again.
Saved groups are preserved. Updates while the window is open also trigger this
check. A failed version query keeps editing blocked and provides **Check again**.
An inactive extension with matching versions can still be configured.

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
All 26 unit tests pass; group policy, migration and configuration validation have
100% core coverage in all four metrics.
Native checks exercise sticky unassigned sources, group overlap/order, separate
short/long names, optional source display, indicator selection/visibility, real
IBus activation, unavailable engines, source removal, virtual evdev input for all
eight presets, both system group shortcuts through a private `gsd-media-keys`,
live system reassignment and cleanup/re-enable/conflict scenarios. Real GSettings
checks verify two-way shortcut sync, deletion/restoration and ownership cleanup.
GTK checks cover group and source editing, settings updates after import, and a
three-group scrolling regression with focused/unfocused controls, rapid checkbox
edits and external settings updates.
The preferences guard is exercised against a private D-Bus Shell service,
including an old runtime, matching inactive runtime, updates with the window
open, missing version information and retry. Fresh GSettings checks cover zero,
one, two and three configured sources, IBus-first ordering and legacy overrides.
Indicator tests toggle both options repeatedly with the menu open and ensure
activating a group retains its menu item until event handling completes.
Preferences-opening D-Bus failures are handled and reported; disabling cancels
outstanding requests. Laptop acceptance after a full sign-out/sign-in remains a
manual check; repository tests do not restart either working desktop.

GitHub CI runs on the explicit `ubuntu-26.04` image and checks GNOME Shell 50
before native tests. Required checks include quality/coverage, six negative
controls, GTK/headless GNOME, secret scanning, licenses,
moderate-or-higher npm vulnerabilities, and CodeQL for TypeScript and Actions.
Required scanner failures block CI. SCANOSS runs locally before a release,
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
- Add localization and decide whether to support older GNOME versions.

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
