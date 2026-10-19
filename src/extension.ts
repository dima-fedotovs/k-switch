// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import { GETTEXT_DOMAIN } from './shared/release.js';
import { _, text, errorText } from './shared/i18n.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { requestPreferences } from './shared/preferences-request.js';
import { Session } from './runtime/session.js';
import { RuntimeVersionService } from './runtime/version-service.js';
import { installedMetadata, verifyMetadata } from './shared/metadata.js';

export default class KSwitch extends Extension {
  #session: Session | null = null;
  #request: Gio.Cancellable | null = null;
  #versionService: RuntimeVersionService | null = null;

  override enable(): void {
    this.initTranslations(GETTEXT_DOMAIN);
    const request = new Gio.Cancellable();
    this.#request = request;
    this.#versionService = new RuntimeVersionService();
    void this.#initialize(request);
  }

  async #initialize(request: Gio.Cancellable): Promise<void> {
    try {
      const installed = await installedMetadata(this.dir.get_child('metadata.json'), request);
      if (!this.#current(request)) {
        return;
      }
      verifyMetadata(installed, this.metadata);
      const session = new Session(this.getSettings(), () => {
        requestPreferences(this.uuid, request, (error) => {
          Main.notifyError(_('K-switch: Cannot open settings'), errorText(error));
        });
      });
      this.#session = session;
      session.start();
    } catch (error) {
      if (!this.#current(request)) {
        return;
      }
      this.#stopSession();
      Main.notifyError(
        _('K-switch: Cannot start'),
        text('%s Correct the problem, then disable and re-enable K-switch.', errorText(error)),
      );
    }
  }

  #current(request: Gio.Cancellable): boolean {
    return this.#request === request && !request.is_cancelled();
  }

  #stopSession(): void {
    const session = this.#session;
    this.#session = null;
    session?.destroy();
  }

  override disable(): void {
    const request = this.#request;
    this.#request = null;
    request?.cancel();
    const versionService = this.#versionService;
    this.#versionService = null;
    try {
      this.#stopSession();
    } finally {
      versionService?.destroy();
    }
  }
}
