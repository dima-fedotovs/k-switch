// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkLocaleResources, checkTranslations } from '../scripts/translations.js';

void test('package gate requires both MO headers and rejects missing or corrupt catalogs', () => {
  const header = new Uint8Array(28);
  new DataView(header.buffer).setUint32(0, 0x950412de, true);
  const contents = {
    'locale/ru/LC_MESSAGES/k-switch.mo': header,
    'locale/lv/LC_MESSAGES/k-switch.mo': header,
  };
  assert.doesNotThrow(() => {
    checkLocaleResources(contents);
  });
  assert.throws(() => {
    checkLocaleResources({});
  }, /Missing compiled catalog/u);
  assert.throws(() => {
    checkLocaleResources({ ...contents, 'locale/lv/LC_MESSAGES/k-switch.mo': new Uint8Array(28) });
  }, /Invalid compiled catalog/u);
});

void test('gettext gate accepts complete catalogs and rejects stale, incomplete, fuzzy and malformed inputs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'k-switch-catalog-gate-'));
  try {
    cpSync('src', join(directory, 'src'), { recursive: true });
    cpSync('po', join(directory, 'po'), { recursive: true });
    checkTranslations(directory);
    const cases = [
      ['k-switch.pot', (value: string): string => value + '\n# Stale template.\n', /POT is stale/u],
      [
        'ru.po',
        (value: string): string => value.replace('msgstr "Caps Lock"', 'msgstr ""'),
        /msgcmp/u,
      ],
      [
        'lv.po',
        (value: string): string =>
          value.replace('msgid "Caps Lock"', '#, fuzzy\nmsgid "Caps Lock"'),
        /msgcmp/u,
      ],
      [
        'ru.po',
        (value: string): string =>
          value.replace('Неизвестное сочетание: %s', 'Неизвестное сочетание: %s %s'),
        /msgfmt/u,
      ],
      [
        'ru.po',
        (value: string): string =>
          value
            .replaceAll('#, javascript-format\n', '')
            .replace('Неизвестное сочетание: %s', 'Неизвестное сочетание: %s %s'),
        /msgfmt/u,
      ],
    ] as const;
    for (const [name, mutate, reason] of cases) {
      const path = join(directory, 'po', name);
      const original = readFileSync(path, 'utf8');
      writeFileSync(path, mutate(original));
      assert.throws(() => {
        checkTranslations(directory);
      }, reason);
      writeFileSync(path, original);
    }
    const path = process.env.PATH;
    try {
      process.env.PATH = '';
      assert.throws(() => {
        checkTranslations(directory);
      }, /Required gettext tool failed/u);
    } finally {
      if (path === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = path;
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
