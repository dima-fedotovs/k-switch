// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import { SHORTCUTS, getShortcut } from '../core/config.js';
import { control } from './focus.js';
import type { EditorContext } from './editor.js';

export function validAccelerator(value: string): boolean {
  if (value === '') {
    return true;
  }
  const [valid, key, modifiers] = Gtk.accelerator_parse(value);
  return (
    valid &&
    key !== 0 &&
    modifiers !== null &&
    (Boolean(modifiers) || (key >= Gdk.KEY_F1 && key <= Gdk.KEY_F35)) &&
    Gtk.accelerator_valid(key, modifiers)
  );
}

function shortcutRow(
  context: EditorContext,
  field: 'groupShortcut' | 'previousGroupShortcut',
  title: string,
): Adw.EntryRow {
  let stored = context.configuration[field];
  const row = new Adw.EntryRow({ title, text: stored, show_apply_button: true });
  control(row, title);
  row.connect('apply', () => {
    const value = row.text.trim();
    if (validAccelerator(value)) {
      context.save({ ...context.configuration, [field]: value });
      row.remove_css_class('error');
    } else {
      row.add_css_class('error');
    }
  });
  context.bind(() => {
    const value = context.configuration[field];
    if (stored !== value) {
      stored = value;
      row.text = value;
    }
  });
  return row;
}

function visibilityRow(
  context: EditorContext,
  field: 'showIndicator' | 'showSource',
  title: string,
  subtitle: string,
): Adw.SwitchRow {
  const row = new Adw.SwitchRow({ title, subtitle, active: context.configuration[field] });
  control(row, title);
  row.connect('notify::active', () => {
    context.save({ ...context.configuration, [field]: row.active });
  });
  context.bind(() => {
    row.active = context.configuration[field];
  });
  return row;
}

export function switchingEditor(context: EditorContext): Adw.PreferencesGroup {
  const config = context.configuration;
  const section = new Adw.PreferencesGroup({ title: 'Switching and indicator' });
  const shortcut = new Adw.ComboRow({
    title: 'Switch within the group',
    model: Gtk.StringList.new(SHORTCUTS.map((item) => item.label)),
    selected: SHORTCUTS.findIndex((item) => item.id === config.shortcut),
  });
  control(shortcut, 'Within-group shortcut');
  shortcut.connect('notify::selected', () => {
    const value = SHORTCUTS[shortcut.selected];
    if (value !== undefined) {
      context.save({ ...context.configuration, shortcut: value.id });
    }
  });
  section.add(shortcut);
  const explanation = new Adw.ActionRow({
    title: 'Keyboard behavior',
    subtitle: getShortcut(config.shortcut).description,
  });
  section.add(explanation);
  section.add(shortcutRow(context, 'groupShortcut', 'Next group shortcut (optional)'));
  section.add(shortcutRow(context, 'previousGroupShortcut', 'Previous group shortcut (optional)'));
  const hint = new Adw.ActionRow({ title: 'System shortcuts', use_markup: false });
  hint.subtitle =
    'While enabled, K-switch registers two actions in GNOME Settings → Keyboard → Custom Shortcuts. Changes there and here stay synchronized. Example: <Super><Alt>space. Leave empty to disable.';
  section.add(hint);
  section.add(
    visibilityRow(
      context,
      'showIndicator',
      'Show group indicator',
      'The standard GNOME indicator is managed separately.',
    ),
  );
  section.add(
    visibilityRow(
      context,
      'showSource',
      'Show selected language',
      'Off by default. Add the current input source after the short group name.',
    ),
  );
  context.bind(() => {
    shortcut.selected = SHORTCUTS.findIndex((item) => item.id === context.configuration.shortcut);
    explanation.subtitle = getShortcut(context.configuration.shortcut).description;
  });
  return section;
}
