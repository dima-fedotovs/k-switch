// SPDX-License-Identifier: GPL-3.0-or-later
import type Gio from 'gi://Gio';
import * as Keyboard from 'resource:///org/gnome/shell/ui/status/keyboard.js';
import {
  chooseGroup,
  externalGroup,
  rotateGroup,
  validGroup,
  withinGroup,
  type GroupConfiguration,
  type LayoutGroup,
  type Selection,
} from '../core/groups.js';
import { synchronize } from '../shared/settings.js';

export class GroupController {
  readonly #settings: Gio.Settings;
  readonly #desktop: Gio.Settings;
  readonly #manager = Keyboard.getInputSourceManager();
  #configuration: GroupConfiguration;
  #ownSource: string | null = null;
  readonly #signals: number[] = [];
  readonly changed: () => void;

  constructor(settings: Gio.Settings, desktop: Gio.Settings, changed: () => void) {
    this.#settings = settings;
    this.#desktop = desktop;
    this.changed = changed;
    this.#configuration = synchronize(settings, desktop);
    this.#signals.push(
      this.#manager.connect('current-source-changed', () => {
        this.#sourceChanged();
      }),
    );
    this.#signals.push(
      this.#manager.connect('sources-changed', () => {
        this.refresh();
      }),
    );
    this.refresh();
    this.#sourceChanged();
  }

  get configuration(): GroupConfiguration {
    return this.#configuration;
  }
  get groups(): readonly LayoutGroup[] {
    return this.#configuration.groups;
  }
  get available(): readonly string[] {
    return Object.values(this.#manager.inputSources).map((source) => `${source.type}:${source.id}`);
  }
  get currentSource(): string | null {
    const source = this.#manager.currentSource;
    return source === null ? null : `${source.type}:${source.id}`;
  }
  get state(): Selection {
    return { group: this.#settings.get_string('active-group'), source: this.currentSource };
  }
  get sourceLabel(): string {
    return this.#manager.currentSource?.shortName ?? '—';
  }

  refresh(): void {
    this.#configuration = synchronize(this.#settings, this.#desktop);
    this.#settings.set_string(
      'active-group',
      validGroup(this.groups, this.state.group, this.available),
    );
    this.changed();
  }

  within(): void {
    this.#activate(withinGroup(this.groups, this.state, this.available));
  }
  next(): void {
    this.#activate(rotateGroup(this.groups, this.state, this.available, 1));
  }
  previous(): void {
    this.#activate(rotateGroup(this.groups, this.state, this.available, -1));
  }
  choose(id: string): void {
    const group = this.groups.find((item) => item.id === id);
    if (group !== undefined) {
      this.#activate(chooseGroup(group, this.currentSource, this.available));
    }
  }

  destroy(): void {
    for (const id of this.#signals) {
      this.#manager.disconnect(id);
    }
  }

  #activate(selection: Selection): void {
    const source = Object.values(this.#manager.inputSources).find(
      (item) => `${item.type}:${item.id}` === selection.source,
    );
    if (source === undefined) {
      return;
    }
    this.#settings.set_string('active-group', selection.group);
    if (selection.source === this.currentSource) {
      this.changed();
      return;
    }
    this.#ownSource = selection.source;
    try {
      source.activate(true);
    } finally {
      this.#ownSource = null;
    }
    this.changed();
  }

  #sourceChanged(): void {
    if (this.currentSource !== this.#ownSource) {
      this.#settings.set_string(
        'active-group',
        externalGroup(this.groups, this.state, this.available),
      );
    }
    this.changed();
  }
}
