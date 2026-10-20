// SPDX-License-Identifier: GPL-3.0-or-later
import { GETTEXT_DOMAIN } from './shared/release.js';
import type Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { guardedPreferences } from './prefs/session-guard.js';

export default class Preferences extends ExtensionPreferences {
  override fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    // Cached host metadata may predate gettext-domain. Use GNOME's supported
    // initializer before constructing even the blocked-session interface.
    this.initTranslations(GETTEXT_DOMAIN);
    return guardedPreferences(window, () => this.getSettings(), this.dir, this.metadata);
  }
}
