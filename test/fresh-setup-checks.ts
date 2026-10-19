// SPDX-License-Identifier: GPL-3.0-or-later
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { _ } from '../src/shared/i18n.js';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Keyboard from 'resource:///org/gnome/shell/ui/status/keyboard.js';
import { configuredSources, readConfiguration } from '../src/shared/settings.js';

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

export async function runFreshSetupChecks(settings: Gio.Settings): Promise<string[]> {
  const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  const configured = configuredSources(desktop);
  const configuration = readConfiguration(settings);
  const group = configuration.groups[0];
  if (group === undefined || configured.length < 2) {
    throw new Error('Fresh fixture needs a group and at least two configured sources');
  }
  check(
    JSON.stringify(group.entries) ===
      JSON.stringify(
        configured.map((source, index) => ({
          source,
          enabled: index < 2,
        })),
      ),
    'Fresh membership follows saved source IDs and order',
  );
  check(group.name === _('Primary'), 'Fresh automatic name follows the GNOME language');
  const indicator = Main.panel.statusArea['k-switch'];
  check(indicator instanceof PanelMenu.Button, 'Fresh runtime has a group indicator');
  if (
    !(indicator instanceof PanelMenu.Button) ||
    !(indicator.menu instanceof PopupMenu.PopupMenu)
  ) {
    throw new Error('Missing real indicator menu');
  }
  check(
    indicator.menu
      ._getMenuItems()
      .some(
        (item) => item instanceof PopupMenu.PopupMenuItem && item.label.text === _('Settings…'),
      ),
    'Panel menu loads the packaged translation',
  );
  const manager = Keyboard.getInputSourceManager();
  const first = Object.values(manager.inputSources).find(
    (source) => `${source.type}:${source.id}` === configured[0],
  );
  if (first === undefined) {
    throw new Error('First configured source must be available');
  }
  first.activate(true);
  await settle();
  const seat = Shell.Global.get().get_stage().get_context().get_backend().get_default_seat();
  const keyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
  for (const expected of [configured[1], configured[0]]) {
    keyboard.notify_key(GLib.get_monotonic_time(), 58, Clutter.KeyState.PRESSED);
    keyboard.notify_key(GLib.get_monotonic_time(), 58, Clutter.KeyState.RELEASED);
    await settle();
    const source = manager.currentSource;
    check(
      source !== null && `${source.type}:${source.id}` === expected,
      'Caps cycles the first two configured sources without fixed language assumptions',
    );
  }
  return [
    'Fresh native setup and real Caps cycling follow configured IDs without fixed source or group names',
  ];
}
