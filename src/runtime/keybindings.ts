// SPDX-License-Identifier: GPL-3.0-or-later
import { MessageError } from '../core/messages.js';
import type Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import type { GroupController } from './groups.js';

export class GroupBindings {
  readonly #settings: Gio.Settings;
  readonly #controller: GroupController;
  readonly #registered: string[] = [];

  constructor(settings: Gio.Settings, controller: GroupController) {
    this.#settings = settings;
    this.#controller = controller;
  }

  start(): void {
    try {
      for (const [key, callback] of [
        [
          'k-switch-next-group',
          (): void => {
            this.#controller.next();
          },
        ],
        [
          'k-switch-previous-group',
          (): void => {
            this.#controller.previous();
          },
        ],
      ] as const) {
        const action = Main.wm.addKeybinding(
          key,
          this.#settings,
          Meta.KeyBindingFlags.NONE,
          Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
          callback,
        );
        // Main.wm returns a numeric action ID; Mutter uses zero for NONE.
        if (action === 0) {
          throw new MessageError(
            'Cannot register group shortcut: %s. Choose another assignment and re-enable K-switch.',
            key,
          );
        }
        this.#registered.push(key);
      }
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  destroy(): void {
    for (const key of this.#registered.splice(0).reverse()) {
      Main.wm.removeKeybinding(key);
    }
  }
}
