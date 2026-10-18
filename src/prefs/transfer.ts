// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import { reconcile } from '../core/groups.js';
import { validAccelerator } from './switching.js';
import { configuredSources, readConfiguration, writeConfiguration } from '../shared/settings.js';
import { readConfigurationFile, writeConfigurationFile } from './config-files.js';

function showError(window: Adw.PreferencesWindow, error: unknown): void {
  if (error instanceof GLib.Error && error.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
    return;
  }
  window.add_toast(new Adw.Toast({ title: String(error), timeout: 8 }));
}

export function exportConfiguration(window: Adw.PreferencesWindow, settings: Gio.Settings): void {
  const dialog = new Gtk.FileDialog({
    title: 'Export K-switch settings',
    initial_name: 'k-switch.json',
  });
  dialog.save(window, null, (_dialog, result) => {
    try {
      const file = dialog.save_finish(result);
      writeConfigurationFile(file, readConfiguration(settings));
      window.add_toast(new Adw.Toast({ title: 'Settings exported' }));
    } catch (error) {
      showError(window, error);
    }
  });
}

export function importConfiguration(window: Adw.PreferencesWindow, settings: Gio.Settings): void {
  const dialog = new Gtk.FileDialog({ title: 'Import K-switch settings' });
  dialog.open(window, null, (_dialog, result) => {
    try {
      const file = dialog.open_finish(result);
      const configuration = readConfigurationFile(file);
      const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
      if (
        !validAccelerator(configuration.groupShortcut) ||
        !validAccelerator(configuration.previousGroupShortcut)
      ) {
        throw new Error('Invalid group shortcut.');
      }
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
    } catch (error) {
      showError(window, error);
    }
  });
}
