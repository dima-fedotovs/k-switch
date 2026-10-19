// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import Gettext from 'gettext';
import { buildPreferences } from '../src/prefs/window.js';
import { focusName } from '../src/prefs/focus.js';
import {
  configuredSources,
  readConfiguration,
  writeConfiguration,
} from '../src/shared/settings.js';
import { _, text, errorText } from '../src/shared/i18n.js';
import { MessageError } from '../src/core/messages.js';

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function widgets(root: Gtk.Widget): Gtk.Widget[] {
  const result = [root];
  for (const widget of result) {
    for (let child = widget.get_first_child(); child !== null; child = child.get_next_sibling()) {
      result.push(child);
    }
  }
  return result;
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

async function verify(window: Adw.PreferencesWindow, settings: Gio.Settings): Promise<void> {
  await settle();
  check(_('Groups') !== 'Groups', 'A shipped non-English catalog must be loaded');
  check(
    widgets(window).some(
      (item) => item instanceof Adw.EntryRow && item.title === _('Group short name'),
    ),
    'Group editor labels are translated',
  );
  check(
    readConfiguration(settings).groups[0]?.name === _('Primary'),
    'Fresh automatic name is localized once',
  );
  const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  check(
    JSON.stringify(readConfiguration(settings).groups[0]?.entries) ===
      JSON.stringify(
        configuredSources(desktop).map((source, index) => ({ source, enabled: index < 2 })),
      ),
    'UI language does not prescribe keyboard sources',
  );
  const name = widgets(window).find(
    (item) => item instanceof Adw.EntryRow && item.name === 'Name of group primary',
  );
  if (!(name instanceof Adw.EntryRow)) {
    throw new Error('Missing stable name editor');
  }
  name.grab_focus();
  name.text = '<User & 100%>';
  name.emit('apply');
  await settle();
  check(
    focusName(window) === 'Name of group primary',
    'Translated UI preserves focus by stable identity',
  );
  check(
    readConfiguration(settings).groups[0]?.name === '<User & 100%>',
    'User text is stored literally',
  );
  check(
    text('Delete group %s', '<User & 100%>').includes('<User & 100%>'),
    'Parameters are literal, including percent/markup',
  );
  const add = widgets(window).find(
    (item) => item instanceof Gtk.Button && item.name === 'add-group',
  );
  if (!(add instanceof Gtk.Button)) {
    throw new Error('Missing stable add control');
  }
  check(
    add.focusable && add.tooltip_text === _('Add group'),
    'Keyboard action has a translated description',
  );
  add.emit('clicked');
  await settle();
  const configuration = readConfiguration(settings);
  check(
    configuration.groups[1]?.name === text('Group %s', '2'),
    'New groups receive localized names',
  );
  writeConfiguration(settings, configuration);
  await settle();
  check(
    readConfiguration(settings).groups[0]?.name === '<User & 100%>',
    'Stored user names are never translated',
  );
  await verifySwitching(window);
}

async function verifySwitching(window: Adw.PreferencesWindow): Promise<void> {
  check(
    errorText(new MessageError('Group short names must be unique.')) ===
      _('Group short names must be unique.'),
    'Core errors are translated at the UI boundary',
  );
  check(
    errorText(new Error('library diagnostic')).includes('library diagnostic'),
    'External diagnostics remain available',
  );
  check(window.child_focus(Gtk.DirectionType.TAB_FORWARD), 'Keyboard navigation remains usable');
  await settle();
  check(
    widgets(window).some(
      (item) => item instanceof Adw.SwitchRow && item.title === _('Show group indicator'),
    ),
    'Switching page is translated',
  );
  const screenshot = GLib.getenv('K_SWITCH_SCREENSHOT');
  if (screenshot !== null) {
    check(
      Gio.Subprocess.new(
        ['import', '-window', window.title ?? 'K-switch', screenshot],
        Gio.SubprocessFlags.NONE,
      ).wait_check(null),
      'Localized screenshot is saved',
    );
  }
}

Gettext.bindtextdomain('k-switch', `${GLib.get_current_dir()}/dist/locale`);
const application = new Adw.Application({
  application_id: 'guru.bug.KSwitch.LocalizedTest',
  flags: Gio.ApplicationFlags.NON_UNIQUE,
});
let failure: unknown = null;
application.connect('activate', () => {
  application.hold();
  const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  desktop.set_value(
    'sources',
    new GLib.Variant('a(ss)', [
      ['xkb', 'fr'],
      ['xkb', 'de'],
      ['xkb', 'es'],
    ]),
  );
  const settings = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.guru.bug.k-switch' });
  const window = new Adw.PreferencesWindow({ application, title: 'K-switch' });
  const dispose = buildPreferences(window, settings, (): Promise<void> => Promise.resolve());
  window.present();
  void verify(window, settings)
    .catch((error: unknown) => {
      failure = error;
    })
    .finally(() => {
      dispose();
      window.close();
      application.release();
      application.quit();
    });
});
application.run([]);
if (failure !== null) {
  throw new Error('Localized preferences test failed', { cause: failure });
}
console.warn(`Localized GTK checks passed: ${GLib.getenv('LANGUAGE') ?? 'unknown'}`);
