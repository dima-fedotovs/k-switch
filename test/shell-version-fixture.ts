// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { UUID, VERSION } from '../src/shared/release.js';
import { VERSION_INTERFACE, VERSION_PATH } from '../src/shared/version-rpc.js';

export class ShellVersionFixture {
  version: string | null = '0.2.1';
  runtimeVersion: string | null = VERSION;
  state = 2;
  readonly #metadata: Gio.DBusExportedObject;
  readonly #runtime: Gio.DBusExportedObject;
  readonly #owner: number;

  constructor() {
    this.#metadata = Gio.DBusExportedObject.wrapJSObject(
      '<node><interface name="org.gnome.Shell.Extensions"><method name="GetExtensionInfo"><arg type="s" direction="in"/><arg type="a{sv}" direction="out"/></method><signal name="ExtensionStateChanged"><arg type="s"/><arg type="a{sv}"/></signal></interface></node>',
      {
        GetExtensionInfo: (): Record<string, GLib.Variant> =>
          this.version === null
            ? {}
            : {
                'version-name': new GLib.Variant('s', this.version),
                state: new GLib.Variant('d', this.state),
              },
      },
    );
    this.#runtime = Gio.DBusExportedObject.wrapJSObject(
      `<node><interface name="${VERSION_INTERFACE}"><method name="GetRuntimeVersion"><arg type="s" direction="out"/></method></interface></node>`,
      {
        GetRuntimeVersionAsync: (
          _parameters: unknown[],
          invocation: Gio.DBusMethodInvocation,
        ): void => {
          if (this.runtimeVersion === null) {
            invocation.return_dbus_error(
              'org.freedesktop.DBus.Error.UnknownMethod',
              'No runtime version',
            );
          } else {
            invocation.return_value(new GLib.Variant('(s)', [this.runtimeVersion]));
          }
        },
      },
    );
    this.#metadata.export(Gio.DBus.session, '/org/gnome/Shell');
    this.#runtime.export(Gio.DBus.session, VERSION_PATH);
    this.#owner = Gio.bus_own_name_on_connection(
      Gio.DBus.session,
      'org.gnome.Shell',
      Gio.BusNameOwnerFlags.NONE,
      null,
      null,
    );
  }

  changed(): void {
    this.#metadata.emit_signal('ExtensionStateChanged', new GLib.Variant('(sa{sv})', [UUID, {}]));
  }

  destroy(): void {
    this.#runtime.unexport();
    this.#metadata.unexport();
    Gio.bus_unown_name(this.#owner);
  }
}
