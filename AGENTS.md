# K-switch

Read README.md and CONTRIBUTING.md before modifying this project.

- Use `k-switch@bug.guru`, schema `org.gnome.shell.extensions.guru.bug.k-switch`, and D-Bus namespace
  `guru.bug.KSwitch`. Do not add automatic migration for the
  former Layout Pair identity; users can transfer configuration through files.
- The 0.4.0 K-switch schema/path is also transferred through export/import.
  Do not add automatic migration; document export before replacing that version.

- Preserve overlapping ordered groups and checked membership. There is no system
  group: external sources absent from every group leave the active group sticky.
  Caps resumes that group. The skip flag affects only next/previous group cycling.
- Keep short panel names and optional long menu names distinct. The panel shows
  the group alone by default; both labels can be hidden independently. Use the
  packaged symbolic icon only when neither label is shown. The global visibility
  switch hides the entire indicator, including its icon.
- Short names and nonempty long names must each be unique after trimming,
  case-insensitive comparison and Unicode composition normalization. Reject duplicate edits/imports;
  repair stored duplicates with suffixes while preserving IDs, order and membership.
  Display names literally and use stable IDs for control/focus identity.
- Register optional next/previous group bindings directly with Main.wm in NORMAL
  and OVERVIEW. Do not add external transports or Custom Shortcuts integration.
  Reject equivalent nonempty GTK accelerators on edit/import before writing.
- Support all configured GNOME sources, including IBus. Reconcile against saved
  GNOME settings; transient engine unavailability must not delete membership.
- Keep Caps Lock as the default within-group shortcut and Shift+Caps Lock for Caps.
- Seed fresh membership from the first two saved GNOME sources, never fixed
  languages. Preserve explicit legacy overrides when migrating.
  Legacy source keys must have empty defaults. Native setup checks must also
  start without US/Russian sources and derive expectations from configured IDs.
- Keep enable() synchronous with owned cancellable asynchronous initialization.
  Verify metadata before obtaining GSettings or acquiring switching resources.
  Keep the runtime-version RPC owned by the entry point until disable, including
  pending/failed startup. Fail once with a notification; require re-enable.
- Check Shell, preferences-code and on-disk versions before preferences can
  synchronize or write settings. Mismatches must preserve configuration and block
  editing until a matching session is available.
  Active Shell code must report its own version; metadata is not execution proof.
  Cancel pending transfers on lock/close and recheck versions before writing.
- Keep menu items alive during group activation; label/visibility changes must
  not destroy the active gesture's actor.
- Target GNOME Shell 50. Verify version-specific APIs against its actual source.
- Keep pure policy in src/core, Shell code in src/runtime, and GTK code in src/prefs.
- Run npm run check before committing. Run native integration tests for adapter or
  preferences changes; they bind local sockets and require first-attempt escalation
  in a managed sandbox. Never test by modifying the working desktop implicitly.
- Do not weaken strict typing, lint rules, formatting or coverage thresholds.
  Do not add suppression comments or speculative compatibility fallbacks.
- Use the GNOME language with gettext domain k-switch; keep Russian and Latvian
  catalogs complete. Core carries marked templates/data without gettext imports.
  Localize automatic names only on creation and validate uniqueness afterwards;
  keep user names and stable widget IDs independent of translated labels.
- Shexli must analyze the actual release ZIP with hash-locked dependencies.
  Reject all findings, scanner failures and incomplete/inconsistent JSON reports;
  the scanner's zero exit code alone is not success. Preserve the negative controls.
- Update the README status for unfinished work. Keep commits scoped and tested.

- Publish only to GitHub. Tags must pass the complete CI gate before releases.
  Do not publish to EGO, replace published assets, or push archive/pre-squash.
  Keep release tags immutable; verify their remote peeled commit against the
  immutable workflow event SHA again immediately before publishing assets.
- Source match approvals must bind the exact source SHA256 and match fields.
  Scanner errors, partial reports and unreviewed matches fail closed.
  Run SCANOSS locally before tagging; never invoke it in GitHub Actions. Hosted
  checks use security:ci and explicitly report provenance as not run.
- Preserve NOTICE in the ZIP. npm dependencies are build/dev tools, not bundled
  runtime code. Release SBOM and provenance must describe the actual artifact.
