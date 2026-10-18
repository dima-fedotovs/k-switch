// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { requestPreferences } from '../src/shared/preferences-request.js';
import { UUID } from '../src/shared/release.js';

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

export async function verifyPreferencesRequests(): Promise<void> {
  let fail = true;
  let calls = 0;
  const errors: unknown[] = [];
  const exported = Gio.DBusExportedObject.wrapJSObject(
    '<node><interface name="org.gnome.Shell.Extensions"><method name="OpenExtensionPrefs"><arg type="s" direction="in"/><arg type="s" direction="in"/><arg type="a{sv}" direction="in"/></method></interface></node>',
    {
      OpenExtensionPrefsAsync: (
        _parameters: unknown[],
        invocation: Gio.DBusMethodInvocation,
      ): void => {
        calls += 1;
        if (fail) {
          invocation.return_dbus_error('guru.bug.Test.Busy', 'Already showing a prefs dialog');
        } else {
          invocation.return_value(null);
        }
      },
    },
  );
  exported.export(Gio.DBus.session, '/org/gnome/Shell/Extensions');
  const owner = Gio.bus_own_name_on_connection(
    Gio.DBus.session,
    'org.gnome.Shell.Extensions',
    Gio.BusNameOwnerFlags.NONE,
    null,
    null,
  );
  try {
    await settle();
    requestPreferences(UUID, new Gio.Cancellable(), (error) => {
      errors.push(error);
    });
    await settle();
    check(
      errors.length === 1 && String(errors[0]).includes('Already showing'),
      'Preferences failures must be handled and reported',
    );
    fail = false;
    requestPreferences(UUID, new Gio.Cancellable(), (error) => {
      errors.push(error);
    });
    await settle();
    check(calls === 2 && errors.length === 1, 'Preferences can be opened after a failure');
    fail = true;
    const cancelled = new Gio.Cancellable();
    requestPreferences(UUID, cancelled, (error) => {
      errors.push(error);
    });
    cancelled.cancel();
    await settle();
    check(errors.length === 1, 'Disabling must cancel outstanding requests quietly');
  } finally {
    exported.unexport();
    Gio.bus_unown_name(owner);
  }
}
