// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { ACTION_INTERFACE, ACTION_PATH } from '../shared/system-shortcuts.js';
import type { GroupController } from './groups.js';
import { VERSION } from '../shared/release.js';

export class GroupActions {
  readonly #exported: Gio.DBusExportedObject;

  constructor(controller: GroupController) {
    const activate = (direction: 1 | -1): void => {
      if ((Main.actionMode & (Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW)) !== 0) {
        if (direction === 1) {
          controller.next();
        } else {
          controller.previous();
        }
      }
    };
    this.#exported = Gio.DBusExportedObject.wrapJSObject(
      `<node>
        <interface name="${ACTION_INTERFACE}">
          <method name="NextGroup"/>
          <method name="PreviousGroup"/>
          <method name="GetRuntimeVersion"><arg type="s" direction="out"/></method>
        </interface>
      </node>`,
      {
        GetRuntimeVersion: (): string => VERSION,
        NextGroup: (): void => {
          activate(1);
        },
        PreviousGroup: (): void => {
          activate(-1);
        },
      },
    );
    this.#exported.export(Gio.DBus.session, ACTION_PATH);
  }

  destroy(): void {
    this.#exported.unexport();
  }
}
