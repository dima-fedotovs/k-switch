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

function widgets(root: Gtk.Widget): Gtk.Widget[] {
  const result = [root];
  for (const widget of result) {
    for (let child = widget.get_first_child(); child !== null; child = child.get_next_sibling()) {
      result.push(child);
    }
  }
  return result;
}

function entry(window: Gtk.Window, id: string, long = false): Adw.EntryRow {
  const name = `${long ? 'Long name' : 'Name'} of group ${id}`;
  const row = widgets(window).find(
    (widget) => widget instanceof Adw.EntryRow && widget.name === name,
  );
  if (!(row instanceof Adw.EntryRow)) {
    throw new Error(`Missing ${name}`);
  }
  return row;
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

export async function verifyGroupNames(window: Gtk.Window, settings: Gio.Settings): Promise<void> {
  const original = readConfiguration(settings);
  const first = original.groups[0];
  if (first === undefined) {
    throw new Error('Missing fixture group');
  }
  try {
    settings.set_string(
      'configuration',
      JSON.stringify({
        ...original,
        groups: ['a', 'b', 'c'].map((id) => ({ ...first, id, name: 'Daily', longName: '' })),
      }),
    );
    await settle();
    check(
      readConfiguration(settings)
        .groups.map((group) => group.name)
        .join(',') === 'Daily,Daily (2),Daily (3)',
      'Saved duplicate names are repaired without dropping groups',
    );
    const duplicate = entry(window, 'b');
    duplicate.text = ' daily ';
    duplicate.emit('apply');
    await settle();
    check(duplicate.has_css_class('error'), 'Duplicate short names show a field error');
    check(
      readConfiguration(settings).groups[1]?.name === 'Daily (2)',
      'Rejected names preserve saved data',
    );
    await verifyLongNames(window, settings);
    await verifyPlainTitle(window, settings);
    await verifyStableFocus(window, settings);
  } finally {
    writeConfiguration(settings, original);
    await settle();
  }
}

async function verifyLongNames(window: Gtk.Window, settings: Gio.Settings): Promise<void> {
  entry(window, 'a', true).text = 'Work';
  entry(window, 'a', true).emit('apply');
  await settle();
  const duplicate = entry(window, 'b', true);
  duplicate.text = ' work ';
  duplicate.emit('apply');
  await settle();
  check(duplicate.has_css_class('error'), 'Duplicate long names show a field error');
  check(
    readConfiguration(settings).groups[1]?.longName === '',
    'Rejected long names do not overwrite settings',
  );
  duplicate.text = '';
  duplicate.emit('apply');
  await settle();
  check(!duplicate.has_css_class('error'), 'Empty optional names can repeat');
}

async function verifyPlainTitle(window: Gtk.Window, settings: Gio.Settings): Promise<void> {
  const literal = '<b> & "test"';
  entry(window, 'c').text = literal;
  entry(window, 'c').emit('apply');
  await settle();
  const section = widgets(window).find(
    (widget) =>
      widget instanceof Adw.PreferencesGroup &&
      widget.title === GLib.markup_escape_text(literal, -1),
  );
  check(
    section !== undefined &&
      widgets(section).some(
        (widget) => widget instanceof Gtk.Label && widget.get_text() === literal,
      ),
    'Group titles show literal characters instead of parsing user markup',
  );
  check(readConfiguration(settings).groups[2]?.name === literal, 'Escaping is presentation-only');
}

async function verifyStableFocus(window: Gtk.Window, settings: Gio.Settings): Promise<void> {
  const identity = JSON.stringify(['group', 'a', 'down']);
  let button = widgets(window).find(
    (widget) => widget instanceof Gtk.Button && widget.name === identity,
  );
  if (!(button instanceof Gtk.Button)) {
    throw new Error('Missing stable group action');
  }
  button.grab_focus();
  button.emit('clicked');
  await settle();
  check(window.get_focus()?.name === identity, 'Moving a group retains its own action focus');
  entry(window, 'a').text = 'Renamed';
  entry(window, 'a').emit('apply');
  await settle();
  check(
    window.get_focus()?.name === identity,
    'Renaming keeps the control identity independent of its label',
  );
  button = window.get_focus() ?? undefined;
  if (!(button instanceof Gtk.Button)) {
    throw new Error('Missing restored focus');
  }
  button.emit('clicked');
  await settle();
  check(
    readConfiguration(settings)
      .groups.map((group) => group.id)
      .join(',') === 'b,c,a',
    'Repeated activation moves the original group',
  );
}
