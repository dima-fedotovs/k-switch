// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import { buildPreferences } from '../src/prefs/window.js';
import { readConfiguration, synchronize, writeConfiguration } from '../src/shared/settings.js';
import { focusName } from '../src/prefs/focus.js';
import { verifyScrolling } from './prefs-scroll.js';
import { validAccelerator } from '../src/prefs/switching.js';
import { verifySessionGuard } from './session-guard-smoke.js';
import { verifyPreferencesRequests } from './preferences-request-smoke.js';

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function descendants(root: Gtk.Widget): Gtk.Widget[] {
  const widgets: Gtk.Widget[] = [root];
  for (const widget of widgets) {
    let child = widget.get_first_child();
    while (child !== null) {
      widgets.push(child);
      child = child.get_next_sibling();
    }
  }
  return widgets;
}

function button(window: Gtk.Widget, name: string): Gtk.Button {
  const value = descendants(window).find(
    (widget) => widget instanceof Gtk.Button && widget.name === name,
  );
  if (!(value instanceof Gtk.Button)) {
    throw new Error(`Missing button: ${name}`);
  }
  return value;
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

async function verify(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
  desktop: Gio.Settings,
): Promise<void> {
  check(
    readConfiguration(settings).groups[0]?.entries.length === 3,
    'Every configured source must appear',
  );
  button(window, 'Add group').emit('clicked');
  await settle();
  check(readConfiguration(settings).groups.length === 2, 'Add group must save');
  const checkbox = descendants(window).find(
    (widget) => widget instanceof Gtk.CheckButton && widget.name === 'primary:xkb:lv+tilde',
  );
  if (!(checkbox instanceof Gtk.CheckButton)) {
    throw new Error('Missing layout checkbox');
  }
  checkbox.grab_focus();
  checkbox.active = true;
  await settle();
  check(
    readConfiguration(settings).groups[0]?.entries[2]?.enabled === true,
    'Checkbox must enable source',
  );
  check(focusName(window) === 'primary:xkb:lv+tilde', 'Checkbox focus survives refreshing');
  button(window, 'Move xkb:lv+tilde up in Primary').emit('clicked');
  await settle();
  check(
    readConfiguration(settings).groups[0]?.entries[1]?.source === 'xkb:lv+tilde',
    'Layout reorder must save',
  );
  button(window, 'Move group Group 2 up').emit('clicked');
  await settle();
  check(readConfiguration(settings).groups[0]?.name === 'Group 2', 'Group reorder must save');
  button(window, 'Delete group Group 2').emit('clicked');
  await settle();
  check(readConfiguration(settings).groups.length === 1, 'Delete must save');
  check(
    !descendants(window).some(
      (widget) => widget instanceof Adw.PreferencesGroup && widget.title === 'All layouts',
    ),
    'All layouts is removed',
  );
  await verifyDragAndRename(window, settings);
  await verifySources(window, settings, desktop);
}

async function verifyDragAndRename(window: Gtk.Widget, settings: Gio.Settings): Promise<void> {
  const row = descendants(window).find(
    (widget) =>
      widget instanceof Adw.ActionRow &&
      descendants(widget).some((child) => child.name === 'primary:xkb:us'),
  );
  if (!(row instanceof Adw.ActionRow)) {
    throw new Error('Missing source drop row');
  }
  const controllers = row.observe_controllers();
  let target: Gtk.DropTarget | null = null;
  for (let index = 0; index < controllers.get_n_items(); index += 1) {
    const controller = controllers.get_item(index);
    if (controller instanceof Gtk.DropTarget) {
      target = controller;
    }
  }
  if (target === null) {
    throw new Error('Missing drop target');
  }
  const before = JSON.stringify(readConfiguration(settings));
  target.emit('drop', 'source:other:xkb:ru', 0, 0);
  check(JSON.stringify(readConfiguration(settings)) === before, 'Reject drops from other groups');
  target.emit('drop', 'source:primary:xkb:ru', 0, 0);
  await settle();
  check(
    readConfiguration(settings).groups[0]?.entries[0]?.source === 'xkb:ru',
    'Drop saves new order',
  );
  const name = descendants(window).find(
    (widget) => widget instanceof Adw.EntryRow && widget.name === 'Name of group primary',
  );
  if (!(name instanceof Adw.EntryRow)) {
    throw new Error('Missing group name');
  }
  name.text = 'Daily';
  name.emit('apply');
  await settle();
  check(readConfiguration(settings).groups[0]?.name === 'Daily', 'Rename applies');
  await verifyLongName(window, settings);
}

async function verifyLongName(window: Gtk.Widget, settings: Gio.Settings): Promise<void> {
  const longName = descendants(window).find(
    (widget) => widget instanceof Adw.EntryRow && widget.name === 'Long name of group primary',
  );
  if (!(longName instanceof Adw.EntryRow)) {
    throw new Error('Missing optional long name');
  }
  longName.text = 'Daily languages';
  longName.emit('apply');
  await settle();
  check(
    readConfiguration(settings).groups[0]?.longName === 'Daily languages',
    'Long name saves independently',
  );
}

async function verifySources(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
  desktop: Gio.Settings,
): Promise<void> {
  desktop.set_value(
    'sources',
    new GLib.Variant('a(ss)', [
      ['xkb', 'us'],
      ['xkb', 'ru'],
    ]),
  );
  await settle();
  check(
    readConfiguration(settings).groups[0]?.entries.length === 2,
    'Deleted system source is removed',
  );
  desktop.set_value(
    'sources',
    new GLib.Variant('a(ss)', [
      ['xkb', 'us'],
      ['xkb', 'ru'],
      ['xkb', 'lv+tilde'],
    ]),
  );
  await settle();
  check(
    readConfiguration(settings).groups[0]?.entries[2]?.enabled === false,
    'Returning source starts unchecked',
  );
  await verifyTransfer(window, settings);
}

async function verifyTransfer(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
): Promise<void> {
  writeConfiguration(settings, { ...readConfiguration(settings), shortcut: 'menu' });
  await settle();
  const choice = descendants(window).find((widget) => widget instanceof Adw.ComboRow);
  check(choice instanceof Adw.ComboRow && choice.selected === 3, 'Imported shortcut appears');
  const peer = new Gio.Settings({ schema_id: 'guru.bug.k-switch' });
  writeConfiguration(settings, { ...readConfiguration(settings), shortcut: 'caps' });
  await settle();
  check(readConfiguration(peer).shortcut === 'caps', 'Updates after import reach peers');
  check(
    validAccelerator('') && validAccelerator('<Super><Alt>space') && validAccelerator('F8'),
    'Optional accelerator accepts valid combinations',
  );
  check(
    !validAccelerator('<Control><Shift>') && !validAccelerator('a'),
    'Reject modifier-only and bare typing',
  );
  await verifyIndicatorOptions(window, settings);
  await verifyScrolling(window, settings);
  const screenshot = GLib.getenv('K_SWITCH_SCREENSHOT');
  if (screenshot !== null) {
    const capture = Gio.Subprocess.new(
      ['import', '-window', 'K-switch', screenshot],
      Gio.SubprocessFlags.NONE,
    );
    check(capture.wait_check(null), 'Screenshot must be saved');
  }
}

async function verifyIndicatorOptions(window: Gtk.Widget, settings: Gio.Settings): Promise<void> {
  await verifyIndicatorSwitches(window, settings);
  const previous = descendants(window).find(
    (widget) =>
      widget instanceof Adw.EntryRow && widget.title === 'Previous group shortcut (optional)',
  );
  if (!(previous instanceof Adw.EntryRow)) {
    throw new Error('Missing previous shortcut');
  }
  previous.text = '<Super><Alt>b';
  previous.emit('apply');
  await settle();
  check(
    readConfiguration(settings).previousGroupShortcut === '<Super><Alt>b',
    'Previous shortcut saves',
  );
  writeConfiguration(settings, {
    ...readConfiguration(settings),
    showSource: false,
    previousGroupShortcut: '',
  });
  await settle();
}

async function verifyIndicatorSwitches(window: Gtk.Widget, settings: Gio.Settings): Promise<void> {
  const source = descendants(window).find(
    (widget) => widget instanceof Adw.SwitchRow && widget.title === 'Show selected language',
  );
  const indicator = descendants(window).find(
    (widget) => widget instanceof Adw.SwitchRow && widget.title === 'Show group indicator',
  );
  if (!(source instanceof Adw.SwitchRow) || !(indicator instanceof Adw.SwitchRow)) {
    throw new Error('Missing indicator options');
  }
  check(!source.active, 'Selected language is off by default');
  for (const [visible, language] of [
    [false, false],
    [false, true],
    [true, true],
    [true, false],
  ] as const) {
    indicator.active = visible;
    source.active = language;
    await settle();
    const configuration = readConfiguration(settings);
    check(
      configuration.showIndicator === visible && configuration.showSource === language,
      'Rapid edits to both indicator switches must persist together',
    );
  }
}

const application = new Adw.Application({
  application_id: 'guru.bug.KSwitch.Test',
  flags: Gio.ApplicationFlags.NON_UNIQUE,
});
let failure: unknown = null;
application.connect('activate', () => {
  application.hold();
  const settings = new Gio.Settings({ schema_id: 'guru.bug.k-switch' });
  const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  desktop.set_value(
    'sources',
    new GLib.Variant('a(ss)', [
      ['xkb', 'us'],
      ['xkb', 'ru'],
      ['xkb', 'lv+tilde'],
    ]),
  );
  void verifySessionGuard(settings)
    .then(verifyPreferencesRequests)
    .then(() => runWindow(settings, desktop))
    .catch((error: unknown) => {
      failure = error;
    })
    .finally(() => {
      application.release();
      application.quit();
    });
});

async function runWindow(settings: Gio.Settings, desktop: Gio.Settings): Promise<void> {
  synchronize(settings, desktop);
  const window = new Adw.PreferencesWindow({ application, title: 'K-switch' });
  buildPreferences(window, settings);
  window.present();
  try {
    await settle();
    await verify(window, settings, desktop);
  } finally {
    window.close();
  }
}
application.run([]);
if (failure !== null) {
  throw new Error('Preferences test failed', { cause: failure });
}
console.warn('GTK group preferences interactions passed (memory backend).');
