// SPDX-License-Identifier: GPL-3.0-or-later
import { _, errorText } from '../shared/i18n.js';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import type { GroupConfiguration } from '../core/groups.js';
import { nextGroupName } from '../core/group-names.js';
import {
  configuredSources,
  readConfiguration,
  synchronize,
  writeConfiguration,
} from '../shared/settings.js';
import { groupEditor, type EditorContext } from './editor.js';
import { focusName, restoreFocus } from './focus.js';
import { action } from './reorder.js';
import { switchingEditor } from './switching.js';
import { exportConfiguration, importConfiguration, type TransferAccess } from './transfer.js';

function transferGroup(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
  access: TransferAccess,
): Adw.PreferencesGroup {
  const group = new Adw.PreferencesGroup({ title: _('Move settings between computers') });
  const row = new Adw.ActionRow({
    title: _('Configuration file'),
    subtitle: _('Only K-switch preferences are exported.'),
  });
  for (const [label, callback] of [
    [_('Import…'), importConfiguration],
    [_('Export…'), exportConfiguration],
  ] as const) {
    const button = new Gtk.Button({ label, valign: Gtk.Align.CENTER });
    button.connect('clicked', () => {
      callback(window, settings, access);
    });
    row.add_suffix(button);
  }
  group.add(row);
  return group;
}

function addGroup(context: EditorContext, desktop: Gio.Settings): Adw.PreferencesGroup {
  const section = new Adw.PreferencesGroup();
  const row = new Adw.ActionRow({
    title: _('New group'),
    subtitle: _('Enable layouts with checkboxes and arrange their order.'),
  });
  row.add_suffix(
    action(
      'list-add-symbolic',
      _('Add group'),
      () => {
        context.save({
          ...context.configuration,
          groups: [
            ...context.configuration.groups,
            {
              id: GLib.uuid_string_random(),
              name: nextGroupName(context.configuration.groups, _('Group %s')),
              longName: '',
              skip: false,
              entries: configuredSources(desktop).map((source) => ({ source, enabled: false })),
            },
          ],
        });
      },
      'add-group',
    ),
  );
  section.add(row);
  return section;
}

class PreferencesEditor {
  readonly #window: Adw.PreferencesWindow;
  readonly #settings: Gio.Settings;
  readonly #desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  readonly #groupsPage = new Adw.PreferencesPage({
    title: _('Groups'),
    name: 'groups',
    icon_name: 'view-list-symbolic',
  });
  readonly #switchingPage = new Adw.PreferencesPage({
    title: _('Switching'),
    name: 'switching',
    icon_name: 'input-keyboard-symbolic',
  });
  readonly #transfer: Adw.PreferencesGroup;
  readonly #signals: { settings: Gio.Settings; id: number }[];
  #sections: Adw.PreferencesGroup[] = [];
  #switching: Adw.PreferencesGroup | null = null;
  #bindings: (() => void)[] = [];
  #structure = '';
  #syncing = false;
  #pending: number | null = null;
  readonly #transfers = new Gio.Cancellable();

  constructor(window: Adw.PreferencesWindow, settings: Gio.Settings, verify: () => Promise<void>) {
    this.#window = window;
    this.#settings = settings;
    this.#transfer = transferGroup(window, settings, { cancellable: this.#transfers, verify });
    window.set_default_size(760, 850);
    window.add(this.#groupsPage);
    window.add(this.#switchingPage);
    this.#refresh();
    this.#signals = [
      {
        settings,
        id: settings.connect('changed::configuration', () => {
          this.#queue();
        }),
      },
      {
        settings: this.#desktop,
        id: this.#desktop.connect('changed::sources', () => {
          this.#queue();
        }),
      },
    ];
  }

  #queue(): void {
    this.#pending ??= GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      this.#pending = null;
      this.#refresh();
      return GLib.SOURCE_REMOVE;
    });
  }

  #refresh(): void {
    this.#syncing = true;
    try {
      const configuration = synchronize(this.#settings, this.#desktop);
      const structure = JSON.stringify([
        configuredSources(this.#desktop),
        configuration.groups.map((group) => [
          group.id,
          group.name,
          group.longName,
          group.entries.map((entry) => entry.source),
        ]),
      ]);
      if (structure !== this.#structure) {
        this.#rebuild();
        this.#structure = structure;
      }
      for (const refresh of this.#bindings) {
        refresh();
      }
    } catch (error) {
      this.#error(error);
    } finally {
      this.#syncing = false;
    }
  }

  #context(): EditorContext {
    const settings = this.#settings;
    return {
      get configuration(): GroupConfiguration {
        return readConfiguration(settings);
      },
      save: (value): boolean => {
        if (this.#syncing) {
          return false;
        }
        try {
          writeConfiguration(settings, value);
          return true;
        } catch (error) {
          this.#error(error);
          this.#queue();
          return false;
        }
      },
      bind: (refresh): void => {
        this.#bindings.push(refresh);
      },
    };
  }

  #rebuild(): void {
    const focus = focusName(this.#window);
    for (const section of this.#sections) {
      this.#groupsPage.remove(section);
    }
    if (this.#switching !== null) {
      this.#switchingPage.remove(this.#switching);
      this.#switchingPage.remove(this.#transfer);
    }
    this.#bindings = [];
    const context = this.#context();
    this.#sections = [
      ...context.configuration.groups.map((group) => groupEditor(context, group)),
      addGroup(context, this.#desktop),
    ];
    for (const section of this.#sections) {
      this.#groupsPage.add(section);
    }
    this.#switching = switchingEditor(context);
    this.#switchingPage.add(this.#switching);
    this.#switchingPage.add(this.#transfer);
    restoreFocus(this.#window, focus);
  }

  #error(error: unknown): void {
    this.#window.add_toast(new Adw.Toast({ title: errorText(error), timeout: 8 }));
  }

  destroy(): void {
    if (this.#pending !== null) {
      GLib.source_remove(this.#pending);
      this.#pending = null;
    }
    this.#transfers.cancel();
    for (const signal of this.#signals.splice(0)) {
      signal.settings.disconnect(signal.id);
    }
    this.#bindings = [];
    this.#window.remove(this.#groupsPage);
    this.#window.remove(this.#switchingPage);
  }
}

export function buildPreferences(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
  verify: () => Promise<void>,
): () => void {
  const editor = new PreferencesEditor(window, settings, verify);
  return (): void => {
    editor.destroy();
  };
}
