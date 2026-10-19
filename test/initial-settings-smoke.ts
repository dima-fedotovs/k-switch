// SPDX-License-Identifier: GPL-3.0-or-later
import type Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { readConfiguration, synchronize } from '../src/shared/settings.js';

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

export function verifyInitialSettings(settings: Gio.Settings, desktop: Gio.Settings): void {
  check(
    ['first-source', 'second-source'].every(
      (key) => settings.get_default_value(key)?.get_string()[0] === '',
    ),
    'Legacy source keys must not assume any language by default',
  );
  const sources: [string, string][] = [
    ['ibus', 'anthy'],
    ['xkb', 'de'],
    ['xkb', 'fr'],
  ];
  for (const count of [0, 1, 2, 3]) {
    settings.reset('configuration');
    desktop.set_value('sources', new GLib.Variant('a(ss)', sources.slice(0, count)));
    const expected = sources.slice(0, count).map(([type, id], index) => ({
      source: `${type}:${id}`,
      enabled: index < 2,
    }));
    const initial = readConfiguration(settings);
    const saved = synchronize(settings, desktop);
    check(
      JSON.stringify(initial.groups[0]?.entries) === JSON.stringify(expected) &&
        JSON.stringify(saved.groups[0]?.entries) === JSON.stringify(expected),
      `Fresh settings must follow the first two configured sources (count ${String(count)})`,
    );
    desktop.set_value('sources', new GLib.Variant('a(ss)', [...sources].reverse()));
    check(
      JSON.stringify(synchronize(settings, desktop).groups[0]?.entries.slice(0, count)) ===
        JSON.stringify(expected),
      'Saved membership and order must survive subsequent source reordering',
    );
  }
  verifyLegacy(settings, desktop);
  verifyStoredNames(settings, desktop);
  for (const key of ['configuration', 'first-source', 'second-source', 'shortcut']) {
    settings.reset(key);
  }
}

function verifyStoredNames(settings: Gio.Settings, desktop: Gio.Settings): void {
  const configuration = readConfiguration(settings);
  const first = configuration.groups[0];
  if (first === undefined) {
    throw new Error('Missing saved group fixture');
  }
  settings.set_string('active-group', 'duplicate');
  settings.set_string(
    'configuration',
    JSON.stringify({
      ...configuration,
      groups: [first, { ...first, id: 'duplicate', name: first.name.toLowerCase() }],
    }),
  );
  const repaired = synchronize(settings, desktop);
  check(
    repaired.groups.length === 2 &&
      repaired.groups[1]?.name === `${first.name.toLowerCase()} (2)` &&
      repaired.groups[1].id === 'duplicate' &&
      JSON.stringify(repaired.groups[1].entries) === JSON.stringify(first.entries),
    'Repair preserves group IDs, order and memberships',
  );
  check(
    settings.get_string('active-group') === 'duplicate',
    'Repair preserves active group identity',
  );
  const stored = settings.get_string('configuration');
  check(stored === JSON.stringify(repaired), 'Repaired names are persisted');
  synchronize(settings, desktop);
  check(
    settings.get_string('configuration') === stored,
    'Repair is stable across repeated synchronization',
  );
  settings.reset('active-group');
}

function verifyLegacy(settings: Gio.Settings, desktop: Gio.Settings): void {
  for (const [key, value, expected] of [
    ['first-source', 'xkb:fr', ['xkb:fr']],
    ['second-source', 'xkb:de', ['xkb:de']],
  ] as const) {
    settings.reset('configuration');
    settings.set_string(key, value);
    check(
      JSON.stringify(
        readConfiguration(settings).groups[0]?.entries.map((entry) => entry.source),
      ) === JSON.stringify(expected),
      'Only explicitly saved legacy sources are migrated',
    );
    settings.reset(key);
  }
  settings.set_string('first-source', '');
  settings.set_string('second-source', '');
  check(
    readConfiguration(settings).groups[0]?.entries.length === 3,
    'Empty legacy values do not override saved system sources',
  );
  settings.reset('first-source');
  settings.reset('second-source');
  settings.reset('configuration');
  settings.set_string('first-source', 'xkb:fr');
  settings.set_string('second-source', 'xkb:de');
  settings.set_string('shortcut', 'menu');
  const legacy = synchronize(settings, desktop);
  check(
    legacy.shortcut === 'menu' &&
      legacy.groups[0]?.entries[0]?.source === 'xkb:fr' &&
      legacy.groups[0].entries[1]?.source === 'xkb:de',
    'Explicit legacy preferences must retain their pair, order and shortcut',
  );
}
