// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { VERSION_INTERFACE, VERSION_PATH } from './version-rpc.js';

export async function shellVersion(uuid: string, cancellable: Gio.Cancellable): Promise<string> {
  const metadata = await extensionInfo(uuid, cancellable);
  const version = versionName(metadata);
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    !('state' in metadata) ||
    typeof metadata.state !== 'number'
  ) {
    throw new Error('GNOME Shell did not report the extension state.');
  }
  // GNOME Shell 50 ExtensionState: ACTIVE=1; stable inactive states=2,3,4,6.
  if (metadata.state === 1) {
    return runtimeVersion(cancellable);
  }
  if (![2, 3, 4, 6].includes(metadata.state)) {
    throw new Error('GNOME Shell is changing extension state. Try checking again.');
  }
  return version;
}

function extensionInfo(uuid: string, cancellable: Gio.Cancellable): Promise<unknown> {
  return new Promise((resolve, reject) => {
    Gio.DBus.session.call(
      'org.gnome.Shell',
      '/org/gnome/Shell',
      'org.gnome.Shell.Extensions',
      'GetExtensionInfo',
      new GLib.Variant('(s)', [uuid]),
      new GLib.VariantType('(a{sv})'),
      Gio.DBusCallFlags.NO_AUTO_START,
      5000,
      cancellable,
      (_connection, result) => {
        try {
          const reply = Gio.DBus.session.call_finish(result);
          const metadata: unknown = reply.get_child_value(0).recursiveUnpack();
          resolve(metadata);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
    );
  });
}

export function runtimeVersion(cancellable: Gio.Cancellable): Promise<string> {
  return new Promise((resolve, reject) => {
    Gio.DBus.session.call(
      'org.gnome.Shell',
      VERSION_PATH,
      VERSION_INTERFACE,
      'GetRuntimeVersion',
      null,
      new GLib.VariantType('(s)'),
      Gio.DBusCallFlags.NO_AUTO_START,
      5000,
      cancellable,
      (_connection, result) => {
        try {
          const reply = Gio.DBus.session.call_finish(result);
          resolve(reply.get_child_value(0).get_string()[0]);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
    );
  });
}

function versionName(value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version-name' in value) ||
    typeof value['version-name'] !== 'string'
  ) {
    throw new Error('Extension metadata does not contain a version name.');
  }
  return value['version-name'];
}
