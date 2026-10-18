// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import { guardedPreferences } from '../src/prefs/session-guard.js';
import { VERSION } from '../src/shared/release.js';
import { ShellVersionFixture } from './shell-version-fixture.js';
import { verifyDeferredTransfers } from './transfer-smoke.js';

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
  const shell = new ShellVersionFixture();
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
    await verifyActiveRuntime(window, settings, shell);
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
    shell.version = null;
    shell.changed();
    await settle();
    status(window, 'Cannot verify GNOME Shell version');
    shell.version = VERSION;
    retry(window);
    await settle();
    check(
      widgets(window).some((item) => item instanceof Gtk.CheckButton),
      'Retry restores editing after successful verification',
    );
    await verifyDeferredTransfers(window, settings, writeVersion, (version) => {
      shell.state = 1;
      shell.runtimeVersion = version;
    });
  } finally {
    window.close();
    shell.destroy();
    file.delete(null);
    GLib.rmdir(directory);
    settings.reset('configuration');
  }
}

async function verifyActiveRuntime(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
  shell: ShellVersionFixture,
): Promise<void> {
  shell.version = VERSION;
  shell.state = 1;
  for (const [runtime, title] of [
    ['0.2.1', 'Log out and sign in again'],
    [null, 'Cannot verify GNOME Shell version'],
  ] as const) {
    shell.runtimeVersion = runtime;
    retry(window);
    await settle();
    status(window, title);
    check(settings.get_string('configuration') === '', 'Active code must match before migration');
  }
  shell.runtimeVersion = VERSION;
  retry(window);
  await settle();
  check(settings.get_string('configuration') !== '', 'Matching runtime code unlocks preferences');
  shell.state = 2;
  shell.changed();
  await settle();
  check(
    widgets(window).some((item) => item instanceof Gtk.CheckButton),
    'Matching inactive extension remains configurable',
  );
}
