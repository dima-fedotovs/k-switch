// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import type * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Keyboard from 'resource:///org/gnome/shell/ui/status/keyboard.js';
import { readConfiguration, writeConfiguration } from '../src/shared/settings.js';
import { verifyIndicatorLayout } from './indicator-layout.js';

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
  const content = button.get_first_child();
  if (!(content instanceof St.BoxLayout)) {
    throw new Error('Missing indicator content container');
  }
  const children = content.get_children();
  const label = children.find((child) => child instanceof St.Label);
  const icon = children.find((child) => child instanceof St.Icon);
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
    for (const [showIcon, showGroup, showSource, expected] of [
      [true, false, false, ''],
      [true, true, false, name],
      [true, true, true, `${name} · ${source}`],
      [true, false, true, source],
      [false, true, false, name],
      [false, true, true, `${name} · ${source}`],
      [false, false, true, source],
      [false, false, false, ''],
    ] as const) {
      writeConfiguration(settings, {
        ...configuration,
        showIcon,
        showGroup,
        showSource,
      });
      await settle();
      check(label.text === expected, 'Both labels can be configured independently');
      check(label.visible === (expected !== ''), 'Only selected labels are visible');
      check(icon.visible === showIcon, 'Icon visibility is independent of both labels');
      verifyIndicatorLayout(button, icon, label);
      check(
        button.accessible_name === (expected || 'K-switch'),
        'Every mode has an accessible name',
      );
      check(
        button.visible === (showIcon || expected !== ''),
        'The indicator is hidden only when all three elements are off',
      );
      if (button.visible) {
        menu.open();
        await settle();
        check(menu.isOpen && button.can_focus, 'Every visible combination keeps menu access');
      } else {
        check(!menu.isOpen, 'Disabling all elements closes the menu');
      }
      check(
        rows.every((row, index) => menu._getMenuItems()[index] === row),
        'Display changes retain menu actors',
      );
    }
  } finally {
    writeConfiguration(settings, configuration);
    await settle();
    verifyIndicatorLayout(button, icon, label);
  }
}
