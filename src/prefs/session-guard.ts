// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import { UUID, VERSION } from '../shared/release.js';
import { installedVersion, shellVersion } from '../shared/shell-version.js';
import { buildPreferences } from './window.js';

class VersionMismatch extends Error {}

class SessionGuard {
  readonly #window: Adw.PreferencesWindow;
  readonly #settings: Gio.Settings;
  readonly #file: Gio.File;
  readonly #page = new Adw.PreferencesPage({
    title: 'Session update',
    icon_name: 'view-refresh-symbolic',
  });
  readonly #status = new Adw.StatusPage({ icon_name: 'dialog-information-symbolic' });
  readonly #monitor: Gio.FileMonitor;
  readonly #subscription: number;
  #request = new Gio.Cancellable();
  #dispose: (() => void) | null = null;
  #added = true;
  #closed = false;

  constructor(window: Adw.PreferencesWindow, settings: Gio.Settings, directory: Gio.File) {
    this.#window = window;
    this.#settings = settings;
    this.#file = directory.get_child('metadata.json');
    const retry = new Gtk.Button({ label: 'Check again', halign: Gtk.Align.CENTER });
    retry.connect('clicked', () => {
      void this.refresh();
    });
    this.#status.child = retry;
    const group = new Adw.PreferencesGroup();
    group.add(this.#status);
    this.#page.add(group);
    window.add(this.#page);
    this.#monitor = this.#file.monitor_file(Gio.FileMonitorFlags.NONE, null);
    this.#monitor.connect('changed', () => {
      void this.refresh();
    });
    this.#subscription = Gio.DBus.session.signal_subscribe(
      'org.gnome.Shell',
      'org.gnome.Shell.Extensions',
      'ExtensionStateChanged',
      '/org/gnome/Shell',
      UUID,
      Gio.DBusSignalFlags.NONE,
      () => {
        void this.refresh();
      },
    );
    window.connect('close-request', () => {
      this.#closed = true;
      this.#request.cancel();
      this.#monitor.cancel();
      Gio.DBus.session.signal_unsubscribe(this.#subscription);
      this.#dispose?.();
      this.#dispose = null;
      return false;
    });
  }

  async refresh(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#request.cancel();
    const request = new Gio.Cancellable();
    this.#request = request;
    this.#lock(
      'Checking GNOME Shell…',
      'Settings remain unavailable until the version check completes.',
    );
    try {
      await this.#verify(request);
      if (request.is_cancelled()) {
        return;
      }
      this.#window.remove(this.#page);
      this.#added = false;
      this.#dispose = buildPreferences(this.#window, this.#settings, () => this.#access(request));
    } catch (error) {
      if (!request.is_cancelled()) {
        this.#failure(error);
      }
    }
  }

  async #verify(request: Gio.Cancellable): Promise<void> {
    const running = await shellVersion(UUID, request);
    const installed = await installedVersion(this.#file, request);
    if (running !== VERSION || installed !== VERSION) {
      throw new VersionMismatch(
        `GNOME Shell: ${running}. Preferences: ${VERSION}. Installed: ${installed}. ` +
          'The versions do not match. Start a new session before editing settings. Saved groups are preserved.',
      );
    }
  }

  async #access(request: Gio.Cancellable): Promise<void> {
    try {
      await this.#verify(request);
    } catch (error) {
      if (!request.is_cancelled()) {
        this.#failure(error);
      }
      throw error;
    }
  }

  #failure(error: unknown): void {
    this.#request.cancel();
    this.#lock(
      error instanceof VersionMismatch
        ? 'Log out and sign in again'
        : 'Cannot verify GNOME Shell version',
      error instanceof VersionMismatch
        ? error.message
        : `${String(error)} Settings have not been changed. Try checking again.`,
    );
  }

  #lock(title: string, description: string): void {
    this.#dispose?.();
    this.#dispose = null;
    if (!this.#added) {
      this.#window.add(this.#page);
      this.#added = true;
    }
    this.#status.title = title;
    this.#status.description = description;
  }
}

export async function guardedPreferences(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
  directory: Gio.File,
): Promise<void> {
  const guard = new SessionGuard(window, settings, directory);
  await guard.refresh();
}
