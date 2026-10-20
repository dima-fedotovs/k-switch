// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { runtimeVersion } from '../src/shared/shell-version.js';
import type { RuntimeExtension } from './runtime-lifecycle.js';

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

export async function verifyRepeatedLifecycle(extension: RuntimeExtension): Promise<void> {
  const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  const previous = desktop.get_strv('xkb-options').join(',');
  extension.disable();
  extension.enable();
  try {
    await new Promise<void>((resolve) => {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
      });
    });
    const indicator = Main.panel.statusArea['k-switch'];
    check(indicator !== undefined, 'Initial activation creates the indicator');
    const options = desktop.get_strv('xkb-options').join(',');
    extension.enable();
    check(
      Main.panel.statusArea['k-switch'] === indicator,
      'Repeated enable preserves the existing session and indicator',
    );
    check(
      desktop.get_strv('xkb-options').join(',') === options,
      'Repeated enable preserves acquired XKB options',
    );
  } finally {
    extension.disable();
  }
  extension.disable();
  check(Main.panel.statusArea['k-switch'] === undefined, 'Repeated disable leaves no indicator');
  check(
    desktop.get_strv('xkb-options').join(',') === previous,
    'Repeated disable preserves restored XKB options',
  );
  let exported = true;
  try {
    await runtimeVersion(new Gio.Cancellable());
  } catch {
    exported = false;
  }
  check(!exported, 'Repeated disable leaves the runtime-version service unexported');
}
