// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import { readConfiguration, writeConfiguration } from './settings.js';

const SCHEMA = 'org.gnome.settings-daemon.plugins.media-keys';
const CUSTOM_SCHEMA = `${SCHEMA}.custom-keybinding`;
export const ACTION_PATH = '/guru/bug/KSwitch';
export const ACTION_INTERFACE = 'guru.bug.KSwitch';
export const SHORTCUT_ACTIONS = [
  {
    field: 'groupShortcut',
    key: 'k-switch-next-group',
    method: 'NextGroup',
    label: 'K-switch: Next group',
    id: 'next',
  },
  {
    field: 'previousGroupShortcut',
    key: 'k-switch-previous-group',
    method: 'PreviousGroup',
    label: 'K-switch: Previous group',
    id: 'previous',
  },
] as const;

interface Binding {
  readonly action: (typeof SHORTCUT_ACTIONS)[number];
  readonly settings: Gio.Settings;
  readonly path: string;
  readonly command: string;
}

export class SystemShortcuts {
  readonly #settings: Gio.Settings;
  readonly #onError: (error: unknown) => void;
  readonly #parent = new Gio.Settings({ schema_id: SCHEMA });
  readonly #entries: readonly Binding[];
  readonly #signals: { settings: Gio.Settings; id: number }[] = [];
  #syncing = false;
  #started = false;

  constructor(settings: Gio.Settings, onError: (error: unknown) => void) {
    this.#settings = settings;
    this.#onError = onError;
    this.#entries = SHORTCUT_ACTIONS.map((action) => {
      const path = `/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/k-switch-${action.id}/`;
      return {
        action,
        path,
        settings: new Gio.Settings({ schema_id: CUSTOM_SCHEMA, path }),
        command: `gdbus call --session --dest org.gnome.Shell --object-path ${ACTION_PATH} --method ${ACTION_INTERFACE}.${action.method}`,
      };
    });
  }

  start(): boolean {
    if (
      !this.#parent.is_writable('custom-keybindings') ||
      !this.#settings.is_writable('configuration') ||
      this.#entries.some((entry) => !this.#canUse(entry))
    ) {
      return false;
    }
    this.#started = true;
    const configuration = readConfiguration(this.#settings);
    for (const entry of this.#entries) {
      if (entry.settings.get_string('command') === '') {
        this.#write(entry.settings, 'name', entry.action.label);
        this.#write(entry.settings, 'command', entry.command);
      }
      this.#write(entry.settings, 'binding', configuration[entry.action.field]);
      this.#listen(entry.settings, 'changed::binding', () => {
        this.#pull(entry);
      });
      this.#listen(entry.settings, 'changed::command', () => {
        this.#pull(entry);
      });
    }
    this.#paths([
      ...this.#parent.get_strv('custom-keybindings'),
      ...this.#entries.map((entry) => entry.path),
    ]);
    this.#listen(this.#settings, 'changed::configuration', () => {
      this.#push();
    });
    this.#listen(this.#parent, 'changed::custom-keybindings', () => {
      for (const entry of this.#entries) {
        this.#pull(entry);
      }
    });
    return true;
  }

  destroy(): void {
    for (const signal of this.#signals.splice(0)) {
      signal.settings.disconnect(signal.id);
    }
    if (this.#started) {
      try {
        this.#paths(
          this.#parent
            .get_strv('custom-keybindings')
            .filter(
              (path) => !this.#entries.some((entry) => entry.path === path && this.#owned(entry)),
            ),
        );
      } catch (error) {
        this.#onError(error);
      } finally {
        this.#started = false;
      }
    }
  }

  #canUse(entry: Binding): boolean {
    const command = entry.settings.get_string('command');
    return (
      (command === '' || command === entry.command) &&
      ['name', 'command', 'binding'].every((key) => entry.settings.is_writable(key))
    );
  }

  #owned(entry: Binding): boolean {
    return entry.settings.get_string('command') === entry.command;
  }

  #listen(settings: Gio.Settings, signal: string, callback: () => void): void {
    this.#signals.push({
      settings,
      id: settings.connect(signal, () => {
        try {
          callback();
        } catch (error) {
          this.#onError(error);
        }
      }),
    });
  }

  #paths(paths: readonly string[]): void {
    if (!this.#parent.set_strv('custom-keybindings', [...new Set(paths)])) {
      throw new Error('Cannot register GNOME custom shortcuts.');
    }
  }

  #write(settings: Gio.Settings, key: string, value: string): void {
    if (!settings.set_string(key, value)) {
      throw new Error(`Cannot write shortcut setting: ${key}`);
    }
  }

  #push(): void {
    if (this.#syncing) {
      return;
    }
    this.#syncing = true;
    try {
      const configuration = readConfiguration(this.#settings);
      const paths = this.#parent.get_strv('custom-keybindings');
      for (const entry of this.#entries) {
        this.#restore(entry, configuration[entry.action.field], paths);
        if (!this.#owned(entry)) {
          continue;
        }
        const binding = configuration[entry.action.field];
        this.#write(entry.settings, 'binding', binding);
        if (binding !== '') {
          paths.push(entry.path);
        }
      }
      this.#paths(paths);
    } finally {
      this.#syncing = false;
    }
  }

  #restore(entry: Binding, binding: string, paths: readonly string[]): void {
    if (
      binding !== '' &&
      !paths.includes(entry.path) &&
      entry.settings.get_string('command') === ''
    ) {
      this.#write(entry.settings, 'name', entry.action.label);
      this.#write(entry.settings, 'command', entry.command);
    }
  }

  #pull(entry: Binding): void {
    if (this.#syncing) {
      return;
    }
    const configuration = readConfiguration(this.#settings);
    const binding =
      this.#parent.get_strv('custom-keybindings').includes(entry.path) && this.#owned(entry)
        ? entry.settings.get_string('binding')
        : '';
    if (configuration[entry.action.field] !== binding) {
      writeConfiguration(this.#settings, { ...configuration, [entry.action.field]: binding });
    }
  }
}

export function createSystemShortcuts(
  settings: Gio.Settings,
  onError: (error: unknown) => void,
): SystemShortcuts | null {
  const source = Gio.SettingsSchemaSource.get_default();
  if (!source?.lookup(SCHEMA, true) || !source.lookup(CUSTOM_SCHEMA, true)) {
    return null;
  }
  return new SystemShortcuts(settings, onError);
}
