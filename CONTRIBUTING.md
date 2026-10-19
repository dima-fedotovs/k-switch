# Contribution standards

The code should stay small enough to read and debug as part of GNOME Shell.

## Required gates

Run `npm run check` before every commit. Run `npm run quality:prove` when changing
the tooling, and native preference/Shell checks when changing GNOME integration.
Keep the hash-locked Shexli environment active (see README setup). Run
`npm run quality:prove:shexli` when changing the extension-review gate.
CI repeats the fast gate and verifies that deliberate mistakes are rejected.

Formatting is automatic through Prettier, including shell scripts. EditorConfig
defines UTF-8, LF, two-space indentation and final newlines. TypeScript uses strict
null checking, exact optional properties, unchecked-index protection and unused
code checks. Typed ESLint rejects unsafe `any`, non-null assertions, unhandled
promises, excessive complexity and cross-process imports. Warnings fail the gate.

Do not add inline ESLint disables, `@ts-ignore`, `@ts-nocheck`, coverage exclusions,
or reduce thresholds to make a change pass. Fix the design or add the missing test.
Any necessary framework exception belongs in central configuration with an exact
scope and a reason. The existing `Adw.PreferencesWindow` exception is required by
GNOME Shell 50's preferences host API; unrelated deprecated APIs stay forbidden.

## Design and testing

- Keep policy in the pure core, and GNOME version dependencies in the adapter.
- Validate imported configuration before writing anything. Imports are versioned
  and must not add/remove system input sources or reset unrelated settings.
- Treat every connected handler and temporarily changed option as an owned
  resource. Test normal cleanup, failed startup, repeated enable/disable and
  changes made by another settings editor.
- Add a focused regression test for behavior fixes. Core coverage must remain
  100% in all four metrics; native adapters require real integration evidence.
- Do not treat unit coverage as proof of Wayland input behavior. Use the private
  headless Shell fixture to exercise virtual evdev keys.
- Avoid blocking work inside GNOME Shell. Small configuration-file operations
  belong in the separate preferences process.
- Preserve a readable, unminified JavaScript release artifact. Ship only runtime
  modules, metadata, schema XML, compiled locale catalogs and license/provenance notices. Format compiled
  JavaScript with the project Prettier configuration, then check style and the
  independent 200-character line limit in the final ZIP. Native fixtures use that
  same formatted runtime.

## Translation workflow

Install GNU gettext (`xgettext`, `msgfmt`, `msgcmp`, `msgattrib`, `msgmerge`) and the
`en_US.UTF-8`, `ru_RU.UTF-8`, `lv_LV.UTF-8` locales for native tests. Mark visible
strings with `_()` or `text()`. Pure-core data uses `N_()` and `MessageError`
templates/parameters; translation happens at the UI boundary. Never import
gettext or a UI library into the pure core. Use string `%s` placeholders, with
positional forms such as `%2$s` when reordering is needed.

Run `npm run translations:update` after changing messages. Update `po/ru.po` and
`po/lv.po` against `po/k-switch.pot` (for example with `msgmerge --update
--backup=none`). Finish every translation and remove fuzzy markers, then run
`npm run translations:check`. Do not translate stored identifiers, configuration
fields, system source names or user names. Preserve widget IDs independently
of translated labels. Add translator comments where wording needs context.

The build checks catalog completeness and placeholders, compiles the MO files
into `dist/locale`, and verifies their exact bytes in the ZIP. GTK and Shell tests
run in all three languages. The automated gates cannot certify linguistic
quality; final wording, layout and ordinary-input acceptance remain human tasks
in issue #19. Do not close that issue with an implementation PR.

## Commits and releases

Install hooks with `npm run hooks:install`. Commit whole, checked iterations;
partial staging is rejected because the tested working tree must match the
snapshot being committed. Pushes require a clean tree with no untracked project
files. Do not use `--no-verify` to bypass a failed gate.

Keep README release limitations current. Public publication needs a real project
URL, confirmed identity, human code review/maintainership, and native acceptance.
Publishing a ZIP or declaring a Shell version does not prove runtime compatibility.
