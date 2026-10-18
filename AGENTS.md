# K-switch

Read README.md and CONTRIBUTING.md before modifying this project.

- Use `k-switch@bug.guru`, schema `guru.bug.k-switch`, and D-Bus namespace
  `guru.bug.KSwitch`. Do not add automatic migration or coordination for the
  former Layout Pair identity; users can transfer configuration through files.

- Preserve overlapping ordered groups and checked membership. There is no system
  group: external sources absent from every group leave the active group sticky.
  Caps resumes that group. The skip flag affects only next/previous group cycling.
- Keep short panel names and optional long menu names distinct. The panel shows
  the group alone by default; the source label is optional.
- Integrate next/previous actions with GNOME custom shortcuts bidirectionally;
  own only our paths and preserve unrelated or repurposed shortcuts.
- Support all configured GNOME sources, including IBus. Reconcile against saved
  GNOME settings; transient engine unavailability must not delete membership.
- Keep Caps Lock as the default within-group shortcut and Shift+Caps Lock for Caps.
- Seed fresh membership from the first two saved GNOME sources, never fixed
  languages. Preserve explicit legacy overrides when migrating.
- Check Shell, preferences-code and on-disk versions before preferences can
  synchronize or write settings. Mismatches must preserve configuration and block
  editing until a matching session is available.
- Keep menu items alive during group activation; label/visibility changes must
  not destroy the active gesture's actor.
- Target GNOME Shell 50. Verify version-specific APIs against its actual source.
- Keep pure policy in src/core, Shell code in src/runtime, and GTK code in src/prefs.
- Run npm run check before committing. Run native integration tests for adapter or
  preferences changes; they bind local sockets and require first-attempt escalation
  in a managed sandbox. Never test by modifying the working desktop implicitly.
- Do not weaken strict typing, lint rules, formatting or coverage thresholds.
  Do not add suppression comments or speculative compatibility fallbacks.
- Update the README status for unfinished work. Keep commits scoped and tested.

- Publish only to GitHub. Tags must pass the complete CI gate before releases.
  Do not publish to EGO, replace published assets, or push archive/pre-squash.
- Source match approvals must bind the exact source SHA256 and match fields.
  Scanner errors, partial reports and unreviewed matches fail closed.
  Run SCANOSS locally before tagging; never invoke it in GitHub Actions. Hosted
  checks use security:ci and explicitly report provenance as not run.
- Preserve NOTICE in the ZIP. npm dependencies are build/dev tools, not bundled
  runtime code. Release SBOM and provenance must describe the actual artifact.
