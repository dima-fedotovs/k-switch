// SPDX-License-Identifier: GPL-3.0-or-later
import { _, text, errorText } from '../shared/i18n.js';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import { UUID, VERSION } from '../shared/release.js';
import { shellVersion } from '../shared/shell-version.js';
import { installedMetadata, verifyMetadata, SessionMismatch } from '../shared/metadata.js';
import { buildPreferences } from './window.js';

class SessionGuard {
  readonly #window: Adw.PreferencesWindow;
  readonly #settings: () => Gio.Settings;
  readonly #metadata: unknown;
  readonly #file: Gio.File;
  readonly #page = new Adw.PreferencesPage({
    title: _('Session update'),
    name: 'session-update',
    icon_name: 'view-refresh-symbolic',
  });
  readonly #status = new Adw.StatusPage({ icon_name: 'dialog-information-symbolic' });
  readonly #monitor: Gio.FileMonitor;
  readonly #subscription: number;
  #request: Gio.Cancellable | null = new Gio.Cancellable();
  #dispose: (() => void) | null = null;
  #added = true;
  readonly #monitorSignal: number;
  readonly #closeSignal: number;

  constructor(
    window: Adw.PreferencesWindow,
    settings: () => Gio.Settings,
    directory: Gio.File,
    metadata: unknown,
  ) {
    this.#window = window;
    this.#settings = settings;
    this.#metadata = metadata;
    this.#file = directory.get_child('metadata.json');
    const retry = new Gtk.Button({ label: _('Check again'), halign: Gtk.Align.CENTER });
    retry.connect('clicked', () => {
      void this.refresh();
    });
    this.#status.child = retry;
    const group = new Adw.PreferencesGroup();
    group.add(this.#status);
    this.#page.add(group);
    window.add(this.#page);
    this.#monitor = this.#file.monitor_file(Gio.FileMonitorFlags.NONE, null);
    this.#monitorSignal = this.#monitor.connect('changed', () => {
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
    this.#closeSignal = window.connect('close-request', () => {
      const request = this.#request;
      this.#request = null;
      request?.cancel();
      this.#monitor.disconnect(this.#monitorSignal);
      this.#monitor.cancel();
      Gio.DBus.session.signal_unsubscribe(this.#subscription);
      window.disconnect(this.#closeSignal);
      this.#disposeEditor();
      return false;
    });
  }

  async refresh(): Promise<void> {
    if (this.#request === null) {
      return;
    }
    this.#request.cancel();
    const request = new Gio.Cancellable();
    this.#request = request;
    this.#lock(
      _('Checking GNOME Shell…'),
      _('Settings remain unavailable until the version check completes.'),
    );
    try {
      await this.#verify(request);
      if (!this.#current(request)) {
        return;
      }
      this.#window.remove(this.#page);
      this.#added = false;
      this.#dispose = buildPreferences(this.#window, this.#settings(), () => this.#access(request));
    } catch (error) {
      if (this.#current(request)) {
        this.#failure(error);
      }
    }
  }

  async #verify(request: Gio.Cancellable): Promise<void> {
    const running = await shellVersion(UUID, request);
    if (!this.#current(request)) {
      return;
    }
    // Read installed metadata last, including transfer-time checks: a Shell RPC
    // must not extend the interval between the disk check and settings access.
    const installed = await installedMetadata(this.#file, request);
    if (!this.#current(request)) {
      return;
    }
    verifyMetadata(installed, this.#metadata);
    if (running !== VERSION) {
      throw new SessionMismatch(
        'GNOME Shell: %s. Preferences: %s. Installed: %s. ' +
          'The versions do not match. Start a new session before editing settings. Saved groups are preserved.',
        running,
        VERSION,
        installed['version-name'],
      );
    }
  }

  async #access(request: Gio.Cancellable): Promise<void> {
    try {
      await this.#verify(request);
    } catch (error) {
      if (this.#current(request)) {
        this.#failure(error);
      }
      throw error;
    }
  }

  #current(request: Gio.Cancellable): boolean {
    return this.#request === request && !request.is_cancelled();
  }

  #disposeEditor(): void {
    const dispose = this.#dispose;
    this.#dispose = null;
    dispose?.();
  }

  #failure(error: unknown): void {
    this.#request?.cancel();
    this.#lock(
      error instanceof SessionMismatch
        ? _('Log out and sign in again')
        : _('Cannot verify GNOME Shell version'),
      error instanceof SessionMismatch
        ? errorText(error)
        : text('%s Settings have not been changed. Try checking again.', errorText(error)),
    );
  }

  #lock(title: string, description: string): void {
    this.#disposeEditor();
    if (!this.#added) {
      this.#window.add(this.#page);
      this.#added = true;
    }
    this.#status.title = title;
    this.#status.description = GLib.markup_escape_text(description, -1);
  }
}

export async function guardedPreferences(
  window: Adw.PreferencesWindow,
  settings: () => Gio.Settings,
  directory: Gio.File,
  metadata: unknown,
): Promise<void> {
  const guard = new SessionGuard(window, settings, directory, metadata);
  await guard.refresh();
}
