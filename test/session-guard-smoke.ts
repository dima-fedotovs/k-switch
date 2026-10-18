// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import { guardedPreferences } from '../src/prefs/session-guard.js';
import { UUID, VERSION } from '../src/shared/release.js';

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

function status(window: Gtk.Widget, title: string): void {
  check(
    widgets(window).some((item) => item instanceof Adw.StatusPage && item.title === title),
    title,
  );
  check(
    !widgets(window).some((item) => item instanceof Gtk.CheckButton),
    'Blocked preferences must have no editable group controls',
  );
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

function retry(window: Gtk.Widget): void {
  const button = widgets(window).find(
    (item) => item instanceof Gtk.Button && item.label === 'Check again',
  );
  if (!(button instanceof Gtk.Button)) {
    throw new Error('Missing retry button');
  }
  button.emit('clicked');
}

function captureGuard(): void {
  const path = GLib.getenv('K_SWITCH_GUARD_SCREENSHOT');
  if (path !== null) {
    const capture = Gio.Subprocess.new(
      ['import', '-window', 'Session guard test', path],
      Gio.SubprocessFlags.NONE,
    );
    check(capture.wait_check(null), 'Guard screenshot must be saved');
  }
}

export async function verifySessionGuard(settings: Gio.Settings): Promise<void> {
  let running: string | null = '0.2.1';
  const exported = Gio.DBusExportedObject.wrapJSObject(
    '<node><interface name="org.gnome.Shell.Extensions"><method name="GetExtensionInfo"><arg type="s" direction="in"/><arg type="a{sv}" direction="out"/></method><signal name="ExtensionStateChanged"><arg type="s"/><arg type="a{sv}"/></signal></interface></node>',
    {
      GetExtensionInfo: (): Record<string, GLib.Variant> =>
        running === null
          ? {}
          : { 'version-name': new GLib.Variant('s', running), state: new GLib.Variant('d', 2) },
    },
  );
  exported.export(Gio.DBus.session, '/org/gnome/Shell');
  const owner = Gio.bus_own_name_on_connection(
    Gio.DBus.session,
    'org.gnome.Shell',
    Gio.BusNameOwnerFlags.NONE,
    null,
    null,
  );
  const directory = GLib.dir_make_tmp('k-switch-guard-XXXXXX');
  const file = Gio.File.new_for_path(`${directory}/metadata.json`);
  const writeVersion = (version: string): void => {
    file.replace_contents(
      new TextEncoder().encode(JSON.stringify({ 'version-name': version })),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
    );
  };
  const window = new Adw.PreferencesWindow({ title: 'Session guard test' });
  try {
    writeVersion(VERSION);
    await settle();
    await guardedPreferences(window, settings, Gio.File.new_for_path(directory));
    window.present();
    await settle();
    captureGuard();
    status(window, 'Log out and sign in again');
    check(
      settings.get_string('configuration') === '',
      'Version check must precede migration and writes',
    );
    running = VERSION;
    retry(window);
    await settle();
    check(settings.get_string('configuration') !== '', 'Matching versions unlock preferences');
    const saved = settings.get_string('configuration');
    writeVersion('99.0.0');
    await settle();
    status(window, 'Log out and sign in again');
    check(
      settings.get_string('configuration') === saved,
      'Updating open preferences must preserve settings',
    );
    writeVersion(VERSION);
    await settle();
    running = null;
    exported.emit_signal('ExtensionStateChanged', new GLib.Variant('(sa{sv})', [UUID, {}]));
    await settle();
    status(window, 'Cannot verify GNOME Shell version');
    running = VERSION;
    retry(window);
    await settle();
    check(
      widgets(window).some((item) => item instanceof Gtk.CheckButton),
      'Retry restores editing after successful verification',
    );
  } finally {
    window.close();
    exported.unexport();
    Gio.bus_unown_name(owner);
    file.delete(null);
    GLib.rmdir(directory);
    settings.reset('configuration');
  }
}
