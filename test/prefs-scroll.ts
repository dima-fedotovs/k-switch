// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import type Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import { readConfiguration, writeConfiguration } from '../src/shared/settings.js';

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function descendants(root: Gtk.Widget): Gtk.Widget[] {
  const widgets = [root];
  for (const widget of widgets) {
    for (let child = widget.get_first_child(); child !== null; child = child.get_next_sibling()) {
      widgets.push(child);
    }
  }
  return widgets;
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

function checkbox(window: Gtk.Widget, source: string): Gtk.CheckButton {
  const widget = descendants(window).find(
    (item) => item instanceof Gtk.CheckButton && item.name === `scroll-3:${source}`,
  );
  if (!(widget instanceof Gtk.CheckButton)) {
    throw new Error('Missing third-group checkbox');
  }
  return widget;
}

function groupScroller(window: Gtk.Widget): Gtk.ScrolledWindow {
  const page = descendants(window).find(
    (widget) => widget instanceof Adw.PreferencesPage && widget.title === 'Groups',
  );
  if (page === undefined) {
    throw new Error('Missing Groups page');
  }
  const scroller = descendants(page).find((widget) => widget instanceof Gtk.ScrolledWindow);
  if (!(scroller instanceof Gtk.ScrolledWindow)) {
    throw new Error('Missing groups scroll container');
  }
  return scroller;
}

export async function verifyScrolling(window: Gtk.Window, settings: Gio.Settings): Promise<void> {
  const original = readConfiguration(settings);
  writeConfiguration(settings, {
    ...original,
    groups: [1, 2, 3].map((index) => ({
      id: `scroll-${String(index)}`,
      name: `Scroll group ${String(index)}`,
      longName: '',
      skip: false,
      entries: ['xkb:us', 'xkb:ru', 'xkb:lv+tilde'].map((source) => ({ source, enabled: false })),
    })),
  });
  await settle();
  const first = checkbox(window, 'xkb:us');
  first.grab_focus();
  await settle();
  const scroller = groupScroller(window);
  const adjustment = scroller.get_vadjustment();
  adjustment.value = adjustment.upper - adjustment.page_size;
  await settle();
  const before = adjustment.value;
  check(
    before > 200,
    `Fixture scroll: value=${String(before)}, upper=${String(adjustment.upper)}, page=${String(adjustment.page_size)}, height=${String(scroller.get_height())}, mapped=${String(scroller.get_mapped())}`,
  );
  first.active = true;
  await settle();
  check(
    Math.abs(adjustment.value - before) < 1,
    `Checkbox changed scroll from ${String(before)} to ${String(adjustment.value)}`,
  );
  check(checkbox(window, 'xkb:us') === first, 'Checkbox edits must retain existing widgets');
  const second = checkbox(window, 'xkb:ru');
  second.grab_focus();
  await settle();
  const keyboardScroll = adjustment.value;
  second.active = true;
  checkbox(window, 'xkb:lv+tilde').active = true;
  await settle();
  check(Math.abs(adjustment.value - keyboardScroll) < 1, 'Keyboard toggles must preserve scroll');
  check(window.get_focus() === second, 'Keyboard focus must stay on the same checkbox');
  check(
    readConfiguration(settings).groups[2]?.entries.every((entry) => entry.enabled) === true,
    'Rapid checkbox changes must not overwrite previous changes',
  );
  await verifyExternalRefresh(window, settings, scroller);
  writeConfiguration(settings, original);
  await settle();
}

async function verifyExternalRefresh(
  window: Gtk.Widget,
  settings: Gio.Settings,
  scroller: Gtk.ScrolledWindow,
): Promise<void> {
  const first = checkbox(window, 'xkb:us');
  const before = scroller.get_vadjustment().value;
  const configuration = readConfiguration(settings);
  writeConfiguration(settings, {
    ...configuration,
    groups: configuration.groups.map((group) =>
      group.id === 'scroll-3'
        ? {
            ...group,
            entries: group.entries.map((entry) =>
              entry.source === 'xkb:us' ? { ...entry, enabled: false } : entry,
            ),
          }
        : group,
    ),
  });
  await settle();
  check(
    checkbox(window, 'xkb:us') === first && !first.active,
    'External settings update existing controls',
  );
  const skip = descendants(window).find(
    (widget) => widget instanceof Adw.SwitchRow && widget.name === 'Skip group scroll-3',
  );
  if (!(skip instanceof Adw.SwitchRow)) {
    throw new Error('Missing third-group skip switch');
  }
  skip.active = true;
  await settle();
  const group = readConfiguration(settings).groups[2];
  check(
    group?.skip === true &&
      group.entries[0]?.enabled === false &&
      group.entries[1]?.enabled === true,
    'Skip switch must preserve the latest memberships',
  );
  check(
    Math.abs(scroller.get_vadjustment().value - before) < 1,
    'External updates and skip switch preserve scroll',
  );
}
