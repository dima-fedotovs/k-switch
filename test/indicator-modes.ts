// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import type * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Keyboard from 'resource:///org/gnome/shell/ui/status/keyboard.js';
import { readConfiguration, writeConfiguration } from '../src/shared/settings.js';

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

function indicatorWidgets(button: PanelMenu.Button): {
  icon: St.Icon;
  label: St.Label;
  menu: PopupMenu.PopupMenu;
} {
  const label = button.get_children().find((child) => child instanceof St.Label);
  const icon = button.get_children().find((child) => child instanceof St.Icon);
  const menu = button.menu;
  if (
    !(icon instanceof St.Icon) ||
    !(label instanceof St.Label) ||
    !(menu instanceof PopupMenu.PopupMenu)
  ) {
    throw new Error('Missing real indicator widgets');
  }
  const gicon = icon.gicon;
  check(
    gicon instanceof Gio.FileIcon &&
      gicon.file.get_basename() === 'k-switch-symbolic.svg' &&
      gicon.file.query_exists(null),
    'The indicator loads the SVG from the packaged extension',
  );
  return { icon, label, menu };
}

export async function verifyIndicatorModes(
  button: PanelMenu.Button,
  settings: Gio.Settings,
): Promise<void> {
  const configuration = readConfiguration(settings);
  const group = configuration.groups.find(
    (item) => item.id === settings.get_string('active-group'),
  );
  const name = group?.name ?? '—';
  const source = Keyboard.getInputSourceManager().currentSource?.shortName ?? '—';
  const { icon, label, menu } = indicatorWidgets(button);
  const rows = menu._getMenuItems();
  try {
    for (const [showGroup, showSource, expected] of [
      [true, false, name],
      [true, true, `${name} · ${source}`],
      [false, true, source],
      [false, false, ''],
    ] as const) {
      writeConfiguration(settings, {
        ...configuration,
        showIndicator: true,
        showGroup,
        showSource,
      });
      await settle();
      check(label.text === expected, 'Both labels can be configured independently');
      check(label.visible === (expected !== ''), 'Text is hidden in icon-only mode');
      check(
        icon.visible === (expected === ''),
        'The icon appears only when both labels are hidden',
      );
      check(
        button.accessible_name === (expected || 'K-switch'),
        'Every mode has an accessible name',
      );
      menu.open();
      await settle();
      check(
        menu.isOpen && button.visible && button.can_focus,
        'Every indicator mode keeps menu access',
      );
      check(
        rows.every((row, index) => menu._getMenuItems()[index] === row),
        'Display changes retain menu actors',
      );
    }
    writeConfiguration(settings, { ...readConfiguration(settings), showIndicator: false });
    await settle();
    check(
      !button.visible && !menu.isOpen,
      'The global switch also hides the icon and closes its menu',
    );
  } finally {
    writeConfiguration(settings, configuration);
    await settle();
  }
}
