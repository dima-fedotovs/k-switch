// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { requestPreferences } from './shared/preferences-request.js';
import { Session } from './runtime/session.js';
import { installedVersion } from './shared/shell-version.js';
import { SCHEMA_ID, VERSION } from './shared/release.js';

export default class KSwitch extends Extension {
  #session: Session | null = null;
  #preferencesRequest: Gio.Cancellable | null = null;

  override async enable(): Promise<void> {
    this.#preferencesRequest?.cancel();
    const request = new Gio.Cancellable();
    this.#preferencesRequest = request;
    try {
      const installed = await installedVersion(this.dir.get_child('metadata.json'), request);
      if (request.is_cancelled()) {
        return;
      }
      if (installed !== VERSION) {
        throw new Error(
          'K-switch code changed on disk. Log out and sign in again before enabling.',
        );
      }
      const session = new Session(this.getSettings(SCHEMA_ID), () => {
        requestPreferences(this.uuid, request, (error) => {
          Main.notifyError('K-switch: Cannot open settings', String(error));
        });
      });
      this.#session = session;
      session.start();
    } catch (error) {
      if (request.is_cancelled()) {
        return;
      }
      this.disable();
      throw error;
    }
  }

  override disable(): void {
    this.#preferencesRequest?.cancel();
    this.#preferencesRequest = null;
    this.#session?.destroy();
    this.#session = null;
  }
}
