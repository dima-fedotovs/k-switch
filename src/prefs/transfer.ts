// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import { reconcile } from '../core/groups.js';
import { validAccelerator } from './switching.js';
import { configuredSources, readConfiguration, writeConfiguration } from '../shared/settings.js';
import { readConfigurationFile, writeConfigurationFile } from './config-files.js';

export interface TransferAccess {
  readonly cancellable: Gio.Cancellable;
  readonly verify: () => Promise<void>;
}

function showError(
  window: Adw.PreferencesWindow,
  error: unknown,
  cancellable: Gio.Cancellable,
): void {
  if (cancellable.is_cancelled()) {
    return;
  }
  if (error instanceof GLib.Error && error.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
    return;
  }
  window.add_toast(new Adw.Toast({ title: String(error), timeout: 8 }));
}

export function exportConfiguration(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
  access: TransferAccess,
): void {
  if (access.cancellable.is_cancelled()) {
    return;
  }
  const dialog = new Gtk.FileDialog({
    title: 'Export K-switch settings',
    initial_name: 'k-switch.json',
  });
  dialog.save(window, access.cancellable, (_dialog, result) => {
    try {
      const file = dialog.save_finish(result);
      void exportFile(window, settings, file, access).catch((error: unknown) => {
        showError(window, error, access.cancellable);
      });
    } catch (error) {
      showError(window, error, access.cancellable);
    }
  });
}

export function importConfiguration(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
  access: TransferAccess,
): void {
  if (access.cancellable.is_cancelled()) {
    return;
  }
  const dialog = new Gtk.FileDialog({ title: 'Import K-switch settings' });
  dialog.open(window, access.cancellable, (_dialog, result) => {
    try {
      const file = dialog.open_finish(result);
      void importFile(window, settings, file, access).catch((error: unknown) => {
        showError(window, error, access.cancellable);
      });
    } catch (error) {
      showError(window, error, access.cancellable);
    }
  });
}

async function exportFile(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
  file: Gio.File,
  access: TransferAccess,
): Promise<void> {
  if (access.cancellable.is_cancelled()) {
    return;
  }
  await access.verify();
  if (!access.cancellable.is_cancelled()) {
    writeConfigurationFile(file, readConfiguration(settings));
    window.add_toast(new Adw.Toast({ title: 'Settings exported' }));
  }
}

async function importFile(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
  file: Gio.File,
  access: TransferAccess,
): Promise<void> {
  if (access.cancellable.is_cancelled()) {
    return;
  }
  const configuration = readConfigurationFile(file);
  if (
    !validAccelerator(configuration.groupShortcut) ||
    !validAccelerator(configuration.previousGroupShortcut)
  ) {
    throw new Error('Invalid group shortcut.');
  }
  await access.verify();
  if (access.cancellable.is_cancelled()) {
    return;
  }
  const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  const available = configuredSources(desktop);
  const removed = [
    ...new Set(
      configuration.groups.flatMap((group) =>
        group.entries
          .filter((entry) => !available.includes(entry.source))
          .map((entry) => entry.source),
      ),
    ),
  ];
  writeConfiguration(settings, reconcile(configuration, available));
  const title =
    removed.length === 0
      ? 'Settings imported'
      : `Imported; unavailable sources removed: ${removed.join(', ')}`;
  window.add_toast(new Adw.Toast({ title, timeout: 8 }));
}
