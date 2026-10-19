// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import { VERSION_INTERFACE, VERSION_PATH } from '../shared/version-rpc.js';
import { VERSION } from '../shared/release.js';

export class RuntimeVersionService {
  readonly #exported: Gio.DBusExportedObject;

  constructor() {
    this.#exported = Gio.DBusExportedObject.wrapJSObject(
      `<node>
        <interface name="${VERSION_INTERFACE}">
          <method name="GetRuntimeVersion"><arg type="s" direction="out"/></method>
        </interface>
      </node>`,
      {
        GetRuntimeVersion: (): string => VERSION,
      },
    );
    this.#exported.export(Gio.DBus.session, VERSION_PATH);
  }

  destroy(): void {
    this.#exported.unexport();
  }
}
