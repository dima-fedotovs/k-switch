// SPDX-License-Identifier: GPL-3.0-or-later
import { _ } from '../shared/i18n.js';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk?version=4.0';
import { SHORTCUTS, getShortcut } from '../core/config.js';
import { control } from './focus.js';
import type { EditorContext } from './editor.js';
import { groupShortcutError } from './accelerators.js';

function shortcutRow(
  context: EditorContext,
  field: 'groupShortcut' | 'previousGroupShortcut',
  title: string,
): Adw.EntryRow {
  let stored = context.configuration[field];
  const row = new Adw.EntryRow({ title, text: stored, show_apply_button: true });
  control(row, field);
  row.connect('apply', () => {
    const value = row.text.trim();
    const configuration = { ...context.configuration, [field]: value };
    const error = groupShortcutError(configuration);
    if (error === null && context.save(configuration)) {
      row.remove_css_class('error');
      row.tooltip_text = null;
    } else {
      row.add_css_class('error');
      row.tooltip_text = error === null ? null : _(error);
    }
  });
  const refresh = (): void => {
    const error = groupShortcutError(context.configuration);
    row.tooltip_text = error === null ? null : _(error);
    if (error === null) {
      row.remove_css_class('error');
    } else {
      row.add_css_class('error');
    }
    const value = context.configuration[field];
    if (stored !== value) {
      stored = value;
      row.text = value;
    }
  };
  context.bind(refresh);
  refresh();
  return row;
}

function visibilityRow(
  context: EditorContext,
  field: 'showIcon' | 'showGroup' | 'showSource',
  title: string,
  subtitle: string,
): Adw.SwitchRow {
  const row = new Adw.SwitchRow({ title, subtitle, active: context.configuration[field] });
  control(row, field);
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
  const section = new Adw.PreferencesGroup({ title: _('Switching and indicator') });
  const shortcut = new Adw.ComboRow({
    title: _('Switch within the group'),
    model: Gtk.StringList.new(SHORTCUTS.map((item) => _(item.label))),
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
    title: _('Keyboard behavior'),
    subtitle: _(getShortcut(config.shortcut).description),
  });
  section.add(explanation);
  section.add(shortcutRow(context, 'groupShortcut', _('Next group shortcut (optional)')));
  section.add(
    shortcutRow(context, 'previousGroupShortcut', _('Previous group shortcut (optional)')),
  );
  const hint = new Adw.ActionRow({ title: _('Group shortcuts'), use_markup: false });
  hint.subtitle = _(
    'Shortcuts work globally while K-switch is enabled, in applications and the overview. Example: <Super><Alt>space. Leave empty to disable.',
  );
  section.add(hint);
  section.add(
    visibilityRow(
      context,
      'showIcon',
      _('Show icon'),
      _('Independent of the labels. Hide all three elements to hide the indicator.'),
    ),
  );
  section.add(
    visibilityRow(
      context,
      'showGroup',
      _('Show group name'),
      _("Show the group's short name in the panel."),
    ),
  );
  section.add(
    visibilityRow(
      context,
      'showSource',
      _('Show selected language'),
      _('Off by default. Show the current input source in the panel.'),
    ),
  );
  context.bind(() => {
    shortcut.selected = SHORTCUTS.findIndex((item) => item.id === context.configuration.shortcut);
    explanation.subtitle = _(getShortcut(context.configuration.shortcut).description);
  });
  return section;
}
