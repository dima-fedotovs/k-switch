// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export function shellVersion(uuid: string, cancellable: Gio.Cancellable): Promise<string> {
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
          resolve(versionName(metadata));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
    );
  });
}

export function installedVersion(file: Gio.File): string {
  const [, contents] = file.load_contents(null);
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(contents));
  return versionName(value);
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
