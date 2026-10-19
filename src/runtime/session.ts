// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { getShortcut } from '../core/config.js';
import { OptionsLease, type OptionsPort } from '../core/options.js';
import type { SignalOverride } from '../core/signal-override.js';
import { GroupBindings } from './keybindings.js';
import { GroupController } from './groups.js';
import { GroupIndicator } from './indicator.js';
import { interceptSwitching, reapplyCurrentLayout } from './keyboard.js';

export class Session {
  readonly #settings: Gio.Settings;
  readonly #desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  readonly #preferences: () => void;
  readonly #signals: { settings: Gio.Settings; id: number }[] = [];
  #controller: GroupController | null = null;
  #indicator: GroupIndicator | null = null;
  #override: SignalOverride | null = null;
  #lease: OptionsLease | null = null;
  #shortcut = '';
  #refreshing = false;
  #bindings: GroupBindings | null = null;

  constructor(settings: Gio.Settings, preferences: () => void) {
    this.#settings = settings;
    this.#preferences = preferences;
  }

  start(): void {
    this.#controller = new GroupController(this.#settings, this.#desktop, () => {
      this.#render();
    });
    this.#indicator = new GroupIndicator(this.#preferences);
    this.#override = interceptSwitching(() => this.#controller?.within());
    this.#applyOptions();
    this.#bindings = new GroupBindings(this.#settings, this.#controller);
    this.#bindings.start();
    this.#listen(this.#settings, 'changed::configuration', () => {
      this.#refresh();
    });
    this.#listen(this.#desktop, 'changed::sources', () => {
      this.#refresh();
    });
    this.#render();
  }

  destroy(): void {
    for (const signal of this.#signals.splice(0)) {
      signal.settings.disconnect(signal.id);
    }
    const bindings = this.#bindings;
    this.#bindings = null;
    bindings?.destroy();
    const controller = this.#controller;
    this.#controller = null;
    controller?.destroy();
    const indicator = this.#indicator;
    this.#indicator = null;
    indicator?.destroy();
    const override = this.#override;
    this.#override = null;
    override?.release();
    const lease = this.#lease;
    this.#lease = null;
    if (lease !== null) {
      lease.release();
      reapplyCurrentLayout();
    }
  }

  #listen(settings: Gio.Settings, signal: string, callback: () => void): void {
    this.#signals.push({ settings, id: settings.connect(signal, callback) });
  }

  #refresh(): void {
    if (this.#refreshing) {
      return;
    }
    this.#refreshing = true;
    try {
      this.#controller?.refresh();
      this.#applyOptions();
    } catch (error) {
      Main.notifyError('K-switch', String(error));
    } finally {
      this.#refreshing = false;
    }
  }

  #render(): void {
    if (this.#controller !== null) {
      this.#indicator?.refresh(this.#controller);
    }
  }

  #applyOptions(): void {
    const shortcut = this.#controller?.configuration.shortcut;
    if (shortcut === undefined || shortcut === this.#shortcut) {
      return;
    }
    this.#lease?.release();
    this.#lease = null;
    this.#shortcut = '';
    const options: OptionsPort = {
      read: (): string[] => this.#desktop.get_strv('xkb-options'),
      write: (value): void => {
        if (!this.#desktop.set_strv('xkb-options', [...value])) {
          throw new Error('GNOME keyboard settings are locked by your administrator.');
        }
      },
    };
    try {
      this.#lease = new OptionsLease(options, getShortcut(shortcut));
      this.#shortcut = shortcut;
    } finally {
      reapplyCurrentLayout();
    }
  }
}
