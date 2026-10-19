// SPDX-License-Identifier: GPL-3.0-or-later
import type Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import { VERSION } from '../src/shared/release.js';
import { readConfiguration } from '../src/shared/settings.js';
import { writeConfigurationFile, readConfigurationFile } from '../src/prefs/config-files.js';
import { DelayedDialogs } from './delayed-dialogs.js';

interface Fixture {
  readonly window: Adw.PreferencesWindow;
  readonly settings: Gio.Settings;
  readonly dialogs: DelayedDialogs;
  readonly file: Gio.File;
  readonly update: (version: string) => void;
  readonly runtime: (version: string) => void;
}

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function click(root: Gtk.Widget, label: string): void {
  const widgets = [root];
  for (const widget of widgets) {
    if (widget instanceof Gtk.Button && widget.label === label) {
      widget.emit('clicked');
      return;
    }
    for (let child = widget.get_first_child(); child !== null; child = child.get_next_sibling()) {
      widgets.push(child);
    }
  }
  throw new Error(`Missing ${label} action`);
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

function contents(file: Gio.File): string {
  return new TextDecoder().decode(file.load_contents(null)[1]);
}

async function verifyLockedTransfers(fixture: Fixture): Promise<void> {
  const { window, settings, dialogs, file, update } = fixture;
  const saved = settings.get_string('configuration');
  const existing = contents(file);
  for (const label of ['Import…', 'Export…']) {
    click(window, label);
    update('99.0.0');
    await settle();
    check(dialogs.cancellable.is_cancelled(), 'Version lock cancels the outstanding dialog');
    dialogs.complete();
    await settle();
    check(settings.get_string('configuration') === saved, 'Locked import preserves configuration');
    check(contents(file) === existing, 'Locked export preserves the destination file');
    update(VERSION);
    await settle();
  }
}

async function verifyRuntimeChange(fixture: Fixture): Promise<void> {
  const { window, settings, dialogs, runtime, update } = fixture;
  const saved = settings.get_string('configuration');
  click(window, 'Import…');
  runtime('0.2.1');
  dialogs.complete();
  await settle();
  check(
    settings.get_string('configuration') === saved,
    'Runtime is rechecked before import writes',
  );
  runtime(VERSION);
  update(VERSION);
  await settle();
}

async function verifySuccessfulTransfers(fixture: Fixture): Promise<void> {
  const { window, settings, dialogs, file } = fixture;
  click(window, 'Import…');
  dialogs.complete();
  await settle();
  check(
    readConfiguration(settings).groups[0]?.name === 'Verified import',
    'A verified file dialog imports its configuration',
  );
  click(window, 'Export…');
  dialogs.complete();
  await settle();
  check(
    JSON.stringify(readConfigurationFile(file)) === JSON.stringify(readConfiguration(settings)),
    'A verified file dialog exports the current configuration',
  );
}

async function verifyDuplicateImport(fixture: Fixture): Promise<void> {
  const { window, settings, dialogs, file } = fixture;
  const configuration = readConfiguration(settings);
  const first = configuration.groups[0];
  if (first === undefined) {
    throw new Error('Missing import fixture group');
  }
  const existing = contents(file);
  file.replace_contents(
    new TextEncoder().encode(
      JSON.stringify({
        ...configuration,
        groups: [
          ...configuration.groups,
          { ...first, id: 'duplicate-import', name: first.name.toLowerCase() },
        ],
      }),
    ),
    null,
    false,
    Gio.FileCreateFlags.REPLACE_DESTINATION,
    null,
  );
  try {
    click(window, 'Import…');
    dialogs.complete();
    await settle();
    check(
      JSON.stringify(readConfiguration(settings)) === JSON.stringify(configuration),
      'Duplicate-name import preserves all saved preferences',
    );
  } finally {
    file.replace_contents(
      new TextEncoder().encode(existing),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
    );
  }
}

async function verifyClosedTransfer(fixture: Fixture): Promise<void> {
  const { window, dialogs, file } = fixture;
  const existing = contents(file);
  click(window, 'Export…');
  window.close();
  check(dialogs.cancellable.is_cancelled(), 'Closing preferences cancels a pending export');
  dialogs.complete();
  await settle();
  check(contents(file) === existing, 'Late completion after close cannot replace the file');
}

export async function verifyDeferredTransfers(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
  update: (version: string) => void,
  runtime: (version: string) => void,
): Promise<void> {
  const directory = GLib.dir_make_tmp('k-switch-transfer-XXXXXX');
  const file = Gio.File.new_for_path(`${directory}/settings.json`);
  const configuration = readConfiguration(settings);
  writeConfigurationFile(file, {
    ...configuration,
    groups: configuration.groups.map((group) => ({ ...group, name: 'Verified import' })),
  });
  const dialogs = new DelayedDialogs(file);
  const fixture = { window, settings, update, runtime, dialogs, file };
  try {
    await verifyLockedTransfers(fixture);
    await verifyRuntimeChange(fixture);
    await verifyDuplicateImport(fixture);
    await verifySuccessfulTransfers(fixture);
    await verifyClosedTransfer(fixture);
    console.warn('Deferred import/export cancellation and version rechecks passed.');
  } finally {
    dialogs.destroy();
    file.delete(null);
    GLib.rmdir(directory);
  }
}
