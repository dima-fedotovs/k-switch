// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import type Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { guardedPreferences } from './prefs/session-guard.js';
import { SCHEMA_ID } from './shared/release.js';

export default class Preferences extends ExtensionPreferences {
  override fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    return guardedPreferences(window, this.getSettings(SCHEMA_ID), this.dir);
  }
}
