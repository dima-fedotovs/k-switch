// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import type { GroupConfiguration } from '../src/core/groups.js';
import { readConfiguration, writeConfiguration } from '../src/shared/settings.js';
import * as Keyboard from 'resource:///org/gnome/shell/ui/status/keyboard.js';
import { shellVersion } from '../src/shared/shell-version.js';
import { UUID, VERSION } from '../src/shared/release.js';

interface TestExtension {
  readonly dir: Gio.File;
  readonly metadata: Record<string, unknown>;
  enable(): Promise<void>;
  disable(): void;
  getSettings(): Gio.Settings;
}

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

async function activate(id: string): Promise<void> {
  const source = Object.values(Keyboard.getInputSourceManager().inputSources).find(
    (item) => item.id === id,
  );
  if (source === undefined) {
    throw new Error(`Missing test layout: ${id}`);
  }
  source.activate(true);
  await settle();
}

function expectSource(id: string): void {
  check(Keyboard.getInputSourceManager().currentSource?.id === id, `Expected active layout ${id}`);
}

export async function runShellChecks(extension: TestExtension): Promise<string[]> {
  check(
    Gio.Vfs.get_default().get_supported_uri_schemes().sort().join(',') ===
      Gio.Vfs.get_local().get_supported_uri_schemes().sort().join(','),
    'Shell fixture must use local GIO VFS',
  );
  return runChecks(extension);
}

async function runChecks(extension: TestExtension): Promise<string[]> {
  const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  const settings = extension.getSettings();
  const checked: string[] = [];
  check(
    (await shellVersion(UUID, new Gio.Cancellable())) === VERSION,
    'Shell reports the loaded extension version',
  );
  check(
    desktop.get_strv('xkb-options').includes('grp:caps_toggle'),
    'Caps shortcut must be applied',
  );
  await selectGroup('Primary');
  await activate('us');
  await triggerSwitch();
  expectSource('ru');
  await triggerSwitch();
  expectSource('us');
  await activate('lv+tilde');
  await triggerSwitch();
  expectSource('us');
  check(settings.get_string('active-group') === 'primary', 'Ungrouped LV keeps the previous group');
  checked.push('Ungrouped sources stay active until Caps resumes the sticky primary group');
  await groupChecks(settings, checked);
  await sourceChanges(settings, desktop, checked);
  await singletonCheck(settings, checked);
  await selectGroup('Primary');
  await physicalKeys(checked, settings);
  writeConfiguration(settings, { ...readConfiguration(settings), shortcut: 'menu' });
  await settle();
  check(
    desktop.get_strv('xkb-options').includes('grp:menu_toggle'),
    'Shortcut change must apply live',
  );
  checked.push('Live within-group shortcut changes');
  extension.disable();
  await settle();
  check(
    desktop.get_strv('xkb-options').join(',') === 'compose:ralt,grp:alt_shift_toggle',
    'Disabling must restore all prior options',
  );
  await activate('ru');
  await triggerSwitch();
  expectSource('lv+tilde');
  checked.push('Disable restores native handler and previous keyboard options');
  for (let index = 0; index < 3; index += 1) {
    await extension.enable();
    await settle();
    await selectGroup('Primary');
    await activate('us');
    await triggerSwitch();
    expectSource('ru');
    extension.disable();
    await settle();
  }
  checked.push('Three enable/disable cycles without duplicate handlers');
  await cancelledStartupCheck(extension, checked);
  await cachedSchemaCheck(extension, checked);
  await competingExtension(extension, checked);
  await bindingFailureCheck(extension, checked);
  await capsConflictCheck(extension, checked);
  await cachedRuntimeCheck(extension, checked);
  return checked;
}

async function cancelledStartupCheck(extension: TestExtension, checked: string[]): Promise<void> {
  const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  const settings = extension.getSettings();
  const options = desktop.get_strv('xkb-options').join(',');
  const configuration = settings.get_string('configuration');
  const pending = extension.enable();
  extension.disable();
  await pending;
  await settle();
  check(Main.panel.statusArea['k-switch'] === undefined, 'Cancelled startup creates no indicator');
  check(desktop.get_strv('xkb-options').join(',') === options, 'Cancelled startup preserves XKB');
  check(
    settings.get_string('configuration') === configuration,
    'Cancelled startup preserves settings',
  );
  checked.push('Disable cancels pending metadata IO before acquiring resources');
}

async function cachedSchemaCheck(extension: TestExtension, checked: string[]): Promise<void> {
  const schema = extension.metadata['settings-schema'];
  extension.metadata['settings-schema'] = 'guru.bug.k-switch';
  try {
    await extension.enable();
    check(
      (await shellVersion(UUID, new Gio.Cancellable())) === VERSION,
      'Cached schema metadata must not prevent the current runtime from starting',
    );
  } finally {
    extension.disable();
    extension.metadata['settings-schema'] = schema;
  }
  checked.push('Current runtime uses its shipped schema despite stale Shell metadata');
}

async function capsConflictCheck(extension: TestExtension, checked: string[]): Promise<void> {
  const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  const settings = extension.getSettings();
  const options = desktop.get_strv('xkb-options');
  const configuration = readConfiguration(settings);
  const conflict = 'ctrl:grouptoggle_capscontrol';
  try {
    writeConfiguration(settings, { ...configuration, shortcut: 'caps' });
    desktop.set_strv('xkb-options', [conflict]);
    let rejected = false;
    try {
      await extension.enable();
    } catch (error) {
      rejected = String(error).includes(conflict);
    }
    check(rejected, 'The Caps-to-Ctrl group toggle must reject startup');
    check(
      desktop.get_strv('xkb-options').join(',') === conflict,
      'Rejected startup preserves the conflicting user option',
    );
    check(Main.panel.statusArea['k-switch'] === undefined, 'Rejected startup leaves no indicator');
  } finally {
    extension.disable();
    desktop.set_strv('xkb-options', options);
    writeConfiguration(settings, configuration);
  }
  checked.push('Caps-to-Ctrl group-toggle conflict rejects startup and releases resources');
}

async function cachedRuntimeCheck(extension: TestExtension, checked: string[]): Promise<void> {
  const settings = extension.getSettings();
  const saved = settings.get_string('configuration');
  const file = extension.dir.get_child('metadata.json');
  const [, bytes] = file.load_contents(null);
  try {
    file.replace_contents(
      new TextEncoder().encode(JSON.stringify({ 'version-name': '99.0.0' })),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
    );
    let rejected = false;
    try {
      await extension.enable();
    } catch (error) {
      rejected = String(error).includes('Log out and sign in again');
    }
    check(rejected, 'Cached runtime refuses changed on-disk code before starting');
    check(
      settings.get_string('configuration') === saved,
      'Rejected startup preserves configuration',
    );
    check(Main.panel.statusArea['k-switch'] === undefined, 'Rejected startup creates no indicator');
  } finally {
    file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    extension.disable();
  }
  checked.push(
    'Cached runtime refuses mismatched installed versions without touching configuration',
  );
}

async function bindingFailureCheck(extension: TestExtension, checked: string[]): Promise<void> {
  const add = Main.wm.addKeybinding.bind(Main.wm);
  const remove = Main.wm.removeKeybinding.bind(Main.wm);
  const removed: string[] = [];
  Main.wm.addKeybinding = (...args): number =>
    args[0] === 'k-switch-previous-group' ? Meta.KeyBindingAction.NONE : add(...args);
  Main.wm.removeKeybinding = (name): void => {
    removed.push(name);
    remove(name);
  };
  try {
    let rejected = false;
    try {
      await extension.enable();
    } catch (error) {
      rejected = String(error).includes('Cannot register group shortcut');
    }
    check(rejected, 'A failed group binding must reject startup');
    check(removed.includes('k-switch-next-group'), 'Failure rolls back the first binding');
    check(Main.panel.statusArea['k-switch'] === undefined, 'Failure releases the session');
  } finally {
    extension.disable();
    Main.wm.addKeybinding = add;
    Main.wm.removeKeybinding = remove;
  }
  await extension.enable();
  await settle();
  extension.disable();
  checked.push('Failed direct registration rolls back acquired bindings; re-enable succeeds');
}

function indicator(): PanelMenu.Button {
  const value = Main.panel.statusArea['k-switch'];
  if (!(value instanceof PanelMenu.Button)) {
    throw new Error('Missing group indicator');
  }
  return value;
}

async function selectGroup(name: string): Promise<void> {
  const menu = indicator().menu;
  if (!(menu instanceof PopupMenu.PopupMenu)) {
    throw new Error('Missing group menu');
  }
  const row = menu
    ._getMenuItems()
    .find((item) => item instanceof PopupMenu.PopupMenuItem && item.label.text === name);
  if (!(row instanceof PopupMenu.PopupMenuItem)) {
    throw new Error(`Missing group ${name}`);
  }
  row.emit('activate', null);
  await settle();
}

function configureGroups(settings: Gio.Settings): GroupConfiguration {
  const config = readConfiguration(settings);
  writeConfiguration(settings, {
    ...config,
    groupShortcut: '<Super><Alt>space',
    previousGroupShortcut: '<Super><Alt>b',
    groups: [
      ...config.groups,
      {
        id: 'latvian',
        name: 'lv',
        longName: 'Latvian',
        skip: true,
        entries: [
          { source: 'xkb:us', enabled: true },
          { source: 'xkb:lv+tilde', enabled: true },
          { source: 'ibus:missing-engine', enabled: true },
        ],
      },
      {
        id: 'reverse',
        name: 'rev',
        longName: 'Reverse test',
        skip: true,
        entries: [{ source: 'xkb:ru', enabled: true }],
      },
    ],
  });
  return config;
}

async function groupChecks(settings: Gio.Settings, checked: string[]): Promise<void> {
  const config = configureGroups(settings);
  await settle();
  await selectGroup('Primary');
  await activate('lv+tilde');
  check(
    settings.get_string('active-group') === 'latvian',
    'External selection finds even an excluded group',
  );
  await activate('us');
  check(settings.get_string('active-group') === 'latvian', 'Shared source preserves current group');
  await activate('ru');
  check(
    settings.get_string('active-group') === 'reverse',
    'External selection finds the nearest later group even when excluded',
  );
  await selectGroup('Latvian');
  expectSource('us');
  await triggerSwitch();
  expectSource('lv+tilde');
  check(
    settings.get_string('active-group') === 'latvian',
    'Own activation must keep its chosen group',
  );
  const seat = Shell.Global.get().get_stage().get_context().get_backend().get_default_seat();
  const keyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
  await pressKeys(keyboard, [125, 56, 57]);
  await settle();
  await settle();
  check(
    settings.get_string('active-group') === 'primary',
    'Assigned global shortcut changes group',
  );
  expectSource('us');
  writeConfiguration(settings, {
    ...readConfiguration(settings),
    groups: readConfiguration(settings).groups.map((group) => ({ ...group, skip: false })),
  });
  await settle();
  await pressKeys(keyboard, [125, 56, 48]);
  await settle();
  await settle();
  check(
    settings.get_string('active-group') === 'reverse',
    'Direct previous shortcut wraps backwards across three groups',
  );
  await liveShortcutChecks(settings, keyboard);
  await selectGroup('Latvian');
  await indicatorChecks(settings);
  await indicatorMenuChecks(settings);
  await indicatorActivationCheck(settings);
  checked.push(
    'Repeated indicator toggles with an open menu; group activation retains its menu item and closes the menu',
  );
  writeConfiguration(settings, { ...config, groupShortcut: '', previousGroupShortcut: '' });
  await settle();
  check(indicator().visible, 'Indicator can be shown again');
  checked.push(
    'Overlapping groups, long menu/short panel names, optional source, real next/previous direct shortcuts and live reassignment',
  );
}

async function indicatorActivationCheck(settings: Gio.Settings): Promise<void> {
  const menu = indicator().menu;
  if (!(menu instanceof PopupMenu.PopupMenu)) {
    throw new Error('Missing group menu');
  }
  writeConfiguration(settings, { ...readConfiguration(settings), showIndicator: true });
  await settle();
  menu.open();
  await settle();
  await settle();
  const row = menu._getMenuItems()[0];
  if (!(row instanceof PopupMenu.PopupMenuItem)) {
    throw new Error('Missing primary group item');
  }
  row.emit('activate', null);
  await settle();
  check(!menu.isOpen, 'Group activation must close the menu');
  check(settings.get_string('active-group') === 'primary', 'Menu activation must select Primary');
  check(row.get_parent() !== null, 'Activating a group must retain its menu item');
}

async function indicatorMenuChecks(settings: Gio.Settings): Promise<void> {
  const menu = indicator().menu;
  if (!(menu instanceof PopupMenu.PopupMenu)) {
    throw new Error('Missing group menu');
  }
  check(
    menu._getMenuItems().filter((item) => item instanceof PopupMenu.PopupMenuItem).length ===
      readConfiguration(settings).groups.length + 1,
    'Menu must contain exactly configured groups and Settings, without All layouts',
  );
  for (let cycle = 0; cycle < 3; cycle += 1) {
    writeConfiguration(settings, { ...readConfiguration(settings), showIndicator: true });
    await settle();
    menu.open();
    await settle();
    check(menu.isOpen, 'Indicator menu must open');
    writeConfiguration(settings, { ...readConfiguration(settings), showSource: cycle % 2 === 0 });
    await settle();
    check(
      indicator().accessible_name.includes(' · ') === (cycle % 2 === 0),
      'Language visibility must update repeatedly with the menu open',
    );
    writeConfiguration(settings, { ...readConfiguration(settings), showIndicator: false });
    await settle();
    check(!menu.isOpen, 'Hiding the indicator must close its open menu');
  }
}

async function liveShortcutChecks(
  settings: Gio.Settings,
  keyboard: Clutter.VirtualInputDevice,
): Promise<void> {
  writeConfiguration(settings, { ...readConfiguration(settings), groupShortcut: '<Super><Alt>n' });
  await settle();
  await pressKeys(keyboard, [125, 56, 49]);
  check(settings.get_string('active-group') === 'primary', 'A changed direct shortcut works live');
  writeConfiguration(settings, { ...readConfiguration(settings), groupShortcut: '' });
  await settle();
  const active = settings.get_string('active-group');
  await pressKeys(keyboard, [125, 56, 49]);
  check(settings.get_string('active-group') === active, 'An empty assignment releases its key');
}

async function indicatorChecks(settings: Gio.Settings): Promise<void> {
  check(
    indicator().accessible_name === 'lv',
    'Panel shows the short group name without a language by default',
  );
  writeConfiguration(settings, { ...readConfiguration(settings), showSource: true });
  await settle();
  check(
    indicator().accessible_name.includes('lv · '),
    'Optional language is added to the group indicator',
  );
  writeConfiguration(settings, { ...readConfiguration(settings), showIndicator: false });
  await settle();
  check(!indicator().visible, 'Indicator can be hidden without changing system indicator');
}

async function singletonCheck(settings: Gio.Settings, checked: string[]): Promise<void> {
  const config = readConfiguration(settings);
  await activate('us');
  writeConfiguration(settings, {
    ...config,
    groups: [
      ...config.groups,
      {
        id: 'single',
        name: 'Single',
        longName: '',
        skip: false,
        entries: [{ source: 'xkb:us', enabled: true }],
      },
    ],
  });
  await settle();
  const manager = Keyboard.getInputSourceManager();
  let events = 0;
  const signal = manager.connect('current-source-changed', () => {
    events += 1;
  });
  try {
    await selectGroup('Single');
    await triggerSwitch();
    check(
      events === 0 && settings.get_string('active-group') === 'single',
      'Singleton changes group without reactivating its source',
    );
    writeConfiguration(settings, config);
    await settle();
    check(
      settings.get_string('active-group') === 'primary',
      'Deleting active group selects the first available group',
    );
    expectSource('us');
  } finally {
    manager.disconnect(signal);
  }
  checked.push(
    'Singleton avoids source reactivation; deleting active group preserves current layout',
  );
}

async function sourceChanges(
  settings: Gio.Settings,
  desktop: Gio.Settings,
  checked: string[],
): Promise<void> {
  const original = desktop.get_value('sources');
  const pairs: [string, string][] = [
    ['xkb', 'us'],
    ['xkb', 'ru'],
    ['xkb', 'lv+tilde'],
    ['ibus', 'xkb:us::eng'],
    ['ibus', 'not-installed-engine'],
  ];
  desktop.set_value('sources', new GLib.Variant('a(ss)', pairs));
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (
      Object.values(Keyboard.getInputSourceManager().inputSources).some(
        (source) => source.type === 'ibus',
      )
    ) {
      break;
    }
    await settle();
  }
  const config = readConfiguration(settings);
  writeConfiguration(settings, {
    ...config,
    groups: [
      ...config.groups,
      {
        id: 'ibus',
        name: 'IBus',
        longName: '',
        skip: false,
        entries: [
          { source: 'xkb:us', enabled: true },
          { source: 'ibus:xkb:us::eng', enabled: true },
          { source: 'ibus:not-installed-engine', enabled: true },
        ],
      },
    ],
  });
  await settle();
  await selectGroup('IBus');
  await activate('us');
  await triggerSwitch();
  const source = Keyboard.getInputSourceManager().currentSource;
  check(
    source?.type === 'ibus' && source.id === 'xkb:us::eng',
    'Real IBus source participates in a group',
  );
  await triggerSwitch();
  expectSource('us');
  check(
    readConfiguration(settings)
      .groups.find((group) => group.id === 'ibus')
      ?.entries.some((entry) => entry.source === 'ibus:not-installed-engine' && entry.enabled) ===
      true,
    'Unavailable configured engines are retained',
  );
  desktop.set_value('sources', original);
  await settle();
  check(
    !readConfiguration(settings).groups.some((group) =>
      group.entries.some((entry) => entry.source.startsWith('ibus:')),
    ),
    'Deleting configured IBus sources removes memberships',
  );
  await selectGroup('Primary');
  checked.push(
    'Real IBus activation, unavailable engines preserved, configured source deletion reconciled',
  );
}

async function physicalKeys(checked: string[], settings: Gio.Settings): Promise<void> {
  const seat = Shell.Global.get().get_stage().get_context().get_backend().get_default_seat();
  const keyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
  await activate('us');
  await settle();
  keyboard.notify_key(GLib.get_monotonic_time(), 58, Clutter.KeyState.PRESSED);
  keyboard.notify_key(GLib.get_monotonic_time(), 58, Clutter.KeyState.RELEASED);
  await settle();
  expectSource('ru');
  const keymap = seat.get_keymap();
  const before = keymap.get_caps_lock_state();
  keyboard.notify_key(GLib.get_monotonic_time(), 42, Clutter.KeyState.PRESSED);
  keyboard.notify_key(GLib.get_monotonic_time(), 58, Clutter.KeyState.PRESSED);
  keyboard.notify_key(GLib.get_monotonic_time(), 58, Clutter.KeyState.RELEASED);
  keyboard.notify_key(GLib.get_monotonic_time(), 42, Clutter.KeyState.RELEASED);
  await settle();
  expectSource('ru');
  check(keymap.get_caps_lock_state() !== before, 'Shift+Caps Lock must toggle Caps Lock only');
  checked.push('Virtual evdev keys: Caps switches; Shift+Caps toggles Caps Lock without switching');
  await pressKeys(keyboard, [42, 58]);
  for (const [preset, keys] of [
    ['caps', [58]],
    ['shift-caps', [42, 58]],
    ['alt-caps', [56, 58]],
    ['menu', [127]],
    ['scroll-lock', [70]],
    ['both-shifts', [42, 54]],
    ['alt-shift', [56, 42]],
    ['ctrl-shift', [29, 42]],
  ] as const) {
    await activate('us');
    writeConfiguration(settings, { ...readConfiguration(settings), shortcut: preset });
    await settle();
    await pressKeys(keyboard, keys);
    expectSource('ru');
  }
  checked.push('All eight shortcut presets switch layouts through virtual evdev input');
}

async function pressKeys(
  keyboard: Clutter.VirtualInputDevice,
  keys: readonly number[],
): Promise<void> {
  for (const key of keys) {
    keyboard.notify_key(GLib.get_monotonic_time(), key, Clutter.KeyState.PRESSED);
  }
  for (const key of [...keys].reverse()) {
    keyboard.notify_key(GLib.get_monotonic_time(), key, Clutter.KeyState.RELEASED);
  }
  await settle();
}

async function competingExtension(extension: TestExtension, checked: string[]): Promise<void> {
  const shell = new Gio.Settings({ schema_id: 'org.gnome.shell' });
  const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  const enabled = shell.get_strv('enabled-extensions');
  await extension.enable();
  await settle();
  shell.set_strv('enabled-extensions', [...enabled, 'switchtwolayouts@qtmax.dev']);
  await settle();
  check(
    desktop.get_strv('xkb-options').join(',') === 'compose:ralt,grp:alt_shift_toggle',
    'A competing extension must release our handler and options',
  );
  shell.set_strv('enabled-extensions', enabled);
  extension.disable();
  await settle();
  checked.push('Enabling a known competing switcher safely releases our resources');
}

async function triggerSwitch(): Promise<void> {
  Shell.Global.get().get_display().emit('modifiers-accelerator-activated');
  await settle();
}
