// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decodeSources,
  getShortcut,
  parseConfiguration,
  SHORTCUTS,
  type Configuration,
} from '../src/core/config.js';

const configuration: Configuration = {
  version: 1,
  firstSource: 'xkb:us',
  secondSource: 'xkb:ru',
  shortcut: 'caps',
};

void test('configuration round trips all supported shortcuts and XKB variants', () => {
  for (const shortcut of SHORTCUTS) {
    const value = { ...configuration, secondSource: 'xkb:lv+tilde', shortcut: shortcut.id };
    assert.deepEqual(parseConfiguration(JSON.stringify(value)), value);
    assert.equal(getShortcut(shortcut.id), shortcut);
  }
});

void test('rejects malformed, incomplete and future configuration without applying it', () => {
  const invalid: unknown[] = [
    null,
    [],
    1,
    'text',
    {},
    { ...configuration, extra: true },
    { ...configuration, version: 2 },
    { ...configuration, firstSource: 42 },
    { ...configuration, secondSource: 'ibus:engine' },
    { ...configuration, firstSource: 'xkb:' },
    { ...configuration, firstSource: 'xkb:../../file' },
    { ...configuration, secondSource: 'xkb:us' },
    { ...configuration, shortcut: 42 },
    { ...configuration, shortcut: 'unknown' },
  ];
  for (const value of invalid) {
    assert.throws(() => parseConfiguration(JSON.stringify(value)));
  }
  assert.throws(() => parseConfiguration('{'));
});

void test('reads native sources, keeping variants and IBus engines', () => {
  assert.deepEqual(
    decodeSources([
      ['xkb', 'us'],
      ['ibus', 'anthy'],
      ['xkb', 'lv+tilde'],
    ]),
    ['xkb:us', 'ibus:anthy', 'xkb:lv+tilde'],
  );
  assert.deepEqual(decodeSources([]), []);
});

void test('rejects malformed native source values at the GSettings boundary', () => {
  for (const value of [null, [null], [[]], [['xkb', 1]], [[1, 'us']]]) {
    assert.throws(() => decodeSources(value));
  }
});
