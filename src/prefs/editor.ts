// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk?version=4.0';
import type { GroupConfiguration, GroupEntry, LayoutGroup } from '../core/groups.js';
import { control } from './focus.js';
import { sourceLabel } from './choices.js';
import { action, dragHandle, dropTarget, moved } from './reorder.js';

export interface EditorContext {
  readonly configuration: GroupConfiguration;
  readonly save: (value: GroupConfiguration) => void;
  readonly bind: (refresh: () => void) => void;
}

function update(
  context: EditorContext,
  id: string,
  transform: (group: LayoutGroup) => LayoutGroup,
): void {
  const configuration = context.configuration;
  context.save({
    ...configuration,
    groups: configuration.groups.map((group) => (group.id === id ? transform(group) : group)),
  });
}

function skipRow(
  context: EditorContext,
  id: string,
  active: boolean,
  save: (value: boolean) => void,
): Adw.SwitchRow {
  const row = new Adw.SwitchRow({
    title: 'Skip when cycling groups',
    active,
    subtitle: 'The group still participates when a layout is selected externally.',
  });
  control(row, `Skip group ${id}`);
  row.connect('notify::active', () => {
    save(row.active);
  });
  context.bind(() => {
    const configuration = context.configuration;
    row.active = configuration.groups.find((group) => group.id === id)?.skip ?? false;
  });
  return row;
}

function moveGroup(context: EditorContext, from: number, to: number): void {
  context.save({ ...context.configuration, groups: moved(context.configuration.groups, from, to) });
}

function groupHeader(context: EditorContext, group: LayoutGroup): Adw.EntryRow {
  const index = context.configuration.groups.findIndex((item) => item.id === group.id);
  const row = new Adw.EntryRow({
    title: 'Group short name',
    text: group.name,
    show_apply_button: true,
  });
  control(row, `Name of group ${group.id}`);
  row.connect('apply', () => {
    const name = row.text.trim();
    if (name !== '' && !Array.from(name).some((character) => character < ' ')) {
      update(context, group.id, (current) => ({ ...current, name }));
    }
  });
  row.add_prefix(dragHandle(`group:${group.id}`, 'Drag to reorder groups'));
  const up = action('go-up-symbolic', `Move group ${group.name} up`, () => {
    moveGroup(context, index, index - 1);
  });
  const down = action('go-down-symbolic', `Move group ${group.name} down`, () => {
    moveGroup(context, index, index + 1);
  });
  up.sensitive = index > 0;
  down.sensitive = index < context.configuration.groups.length - 1;
  row.add_suffix(up);
  row.add_suffix(down);
  row.add_suffix(
    action('user-trash-symbolic', `Delete group ${group.name}`, () => {
      context.save({
        ...context.configuration,
        groups: context.configuration.groups.filter((item) => item.id !== group.id),
      });
    }),
  );
  dropTarget(row, (token) => {
    const from = context.configuration.groups.findIndex((item) => `group:${item.id}` === token);
    if (from < 0) {
      return false;
    }
    moveGroup(context, from, index);
    return true;
  });
  return row;
}

function membership(context: EditorContext, id: string, entry: GroupEntry): Gtk.CheckButton {
  const check = new Gtk.CheckButton({
    active: entry.enabled,
    valign: Gtk.Align.CENTER,
    tooltip_text: `Include ${sourceLabel(entry.source)}`,
  });
  control(check, `${id}:${entry.source}`);
  check.connect('toggled', () => {
    update(context, id, (group) => ({
      ...group,
      entries: group.entries.map((item) =>
        item.source === entry.source ? { ...item, enabled: check.active } : item,
      ),
    }));
  });
  context.bind(() => {
    const group = context.configuration.groups.find((item) => item.id === id);
    check.active = group?.entries.find((item) => item.source === entry.source)?.enabled ?? false;
  });
  return check;
}

function sourceRow(context: EditorContext, group: LayoutGroup, index: number): Adw.ActionRow {
  const entry = group.entries[index];
  if (entry === undefined) {
    throw new Error('Missing source row.');
  }
  const row = new Adw.ActionRow({
    title: sourceLabel(entry.source),
    subtitle: entry.source,
    use_markup: false,
  });
  const check = membership(context, group.id, entry);
  row.add_prefix(check);
  row.activatable_widget = check;
  const move = (from: number, to: number): void => {
    update(context, group.id, (current) => ({
      ...current,
      entries: moved(current.entries, from, to),
    }));
  };
  row.add_prefix(dragHandle(`source:${group.id}:${entry.source}`, 'Drag to reorder layouts'));
  const up = action('go-up-symbolic', `Move ${entry.source} up in ${group.name}`, () => {
    move(index, index - 1);
  });
  const down = action('go-down-symbolic', `Move ${entry.source} down in ${group.name}`, () => {
    move(index, index + 1);
  });
  up.sensitive = index > 0;
  down.sensitive = index < group.entries.length - 1;
  row.add_suffix(up);
  row.add_suffix(down);
  dropTarget(row, (token) => {
    const from = group.entries.findIndex((item) => `source:${group.id}:${item.source}` === token);
    if (from < 0) {
      return false;
    }
    move(from, index);
    return true;
  });
  return row;
}

function longNameRow(context: EditorContext, group: LayoutGroup): Adw.EntryRow {
  const row = new Adw.EntryRow({
    title: 'Long name (optional)',
    text: group.longName,
    show_apply_button: true,
  });
  control(row, `Long name of group ${group.id}`);
  row.connect('apply', () => {
    const longName = row.text.trim();
    if (!Array.from(longName).some((character) => character < ' ')) {
      update(context, group.id, (current) => ({ ...current, longName }));
    }
  });
  return row;
}

export function groupEditor(context: EditorContext, group: LayoutGroup): Adw.PreferencesGroup {
  const section = new Adw.PreferencesGroup({ title: group.name });
  section.add(groupHeader(context, group));
  section.add(longNameRow(context, group));
  section.add(
    skipRow(context, group.id, group.skip, (skip) => {
      update(context, group.id, (current) => ({ ...current, skip }));
    }),
  );
  group.entries.forEach((_entry, index) => {
    section.add(sourceRow(context, group, index));
  });
  return section;
}
