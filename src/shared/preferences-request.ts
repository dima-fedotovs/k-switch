// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export function requestPreferences(
  uuid: string,
  cancellable: Gio.Cancellable,
  onError: (error: unknown) => void,
): void {
  Gio.DBus.session.call(
    'org.gnome.Shell.Extensions',
    '/org/gnome/Shell/Extensions',
    'org.gnome.Shell.Extensions',
    'OpenExtensionPrefs',
    new GLib.Variant('(ssa{sv})', [uuid, '', {}]),
    null,
    Gio.DBusCallFlags.NONE,
    5000,
    cancellable,
    (_connection, result) => {
      try {
        Gio.DBus.session.call_finish(result);
      } catch (error) {
        if (!cancellable.is_cancelled()) {
          onError(error);
        }
      }
    },
  );
}
