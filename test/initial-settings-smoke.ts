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
  for (const key of ['configuration', 'first-source', 'second-source', 'shortcut']) {
    settings.reset(key);
  }
}

function verifyLegacy(settings: Gio.Settings, desktop: Gio.Settings): void {
  for (const [key, value, expected] of [
    ['first-source', 'xkb:fr', ['xkb:fr', 'xkb:ru']],
    ['second-source', 'xkb:de', ['xkb:us', 'xkb:de']],
  ] as const) {
    settings.reset('configuration');
    settings.set_string(key, value);
    check(
      JSON.stringify(
        readConfiguration(settings).groups[0]?.entries.map((entry) => entry.source),
      ) === JSON.stringify(expected),
      'Partially customized legacy pairs must preserve the other schema default',
    );
    settings.reset(key);
  }
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
