// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { requestPreferences } from './shared/preferences-request.js';
import { Session } from './runtime/session.js';

export default class KSwitch extends Extension {
  #session: Session | null = null;
  #preferencesRequest = new Gio.Cancellable();

  override enable(): void {
    this.#preferencesRequest = new Gio.Cancellable();
    const session = new Session(this.getSettings(), () => {
      requestPreferences(this.uuid, this.#preferencesRequest, (error) => {
        Main.notifyError('K-switch: Cannot open settings', String(error));
      });
    });
    this.#session = session;
    try {
      session.start();
    } catch (error) {
      this.disable();
      throw error;
    }
  }

  override disable(): void {
    this.#preferencesRequest.cancel();
    this.#session?.destroy();
    this.#session = null;
  }
}
