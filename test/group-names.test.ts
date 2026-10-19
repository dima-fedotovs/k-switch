// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  initialConfiguration,
  parseGroupConfiguration,
  parseStoredGroupConfiguration,
} from '../src/core/group-config.js';
import { nextGroupName } from '../src/core/group-names.js';
import type { LayoutGroup } from '../src/core/groups.js';

function group(id: string, name: string, longName = ''): LayoutGroup {
  return { id, name, longName, skip: false, entries: [] };
}

void test('short and nonempty long group names are unique after trimming, case and Unicode normalization', () => {
  for (const groups of [
    [group('a', 'Daily'), group('b', ' daily ')],
    [group('a', 'Café'), group('b', 'Cafe\u0301')],
    [group('a', 'a', 'Work'), group('b', 'b', ' work ')],
  ]) {
    assert.throws(
      () =>
        parseGroupConfiguration(JSON.stringify({ ...initialConfiguration([], 'caps'), groups })),
      /names must be unique/u,
    );
  }
});

void test('names are trimmed, empty optional names can repeat, and distinct names remain unchanged', () => {
  const groups = [group('a', ' Daily ', ' Work '), group('b', 'Other'), group('c', 'Third')];
  const parsed = parseGroupConfiguration(
    JSON.stringify({ ...initialConfiguration([], 'caps'), groups }),
  );
  assert.deepEqual(parsed.groups, [
    group('a', 'Daily', 'Work'),
    group('b', 'Other'),
    group('c', 'Third'),
  ]);
});

void test('stored duplicate names receive stable suffixes without renaming reserved names or losing groups', () => {
  const groups = [
    group('a', 'Daily', 'Long'),
    group('b', 'daily', 'long'),
    group('c', 'Daily (2)', 'Long (2)'),
    group('d', 'Daily', 'LONG'),
    group('e', 'Other'),
  ];
  const original = { ...initialConfiguration([], 'caps'), groups };
  const repaired = parseStoredGroupConfiguration(JSON.stringify(original));
  assert.deepEqual(repaired.groups, [
    group('a', 'Daily', 'Long'),
    group('b', 'daily (3)', 'long (3)'),
    group('c', 'Daily (2)', 'Long (2)'),
    group('d', 'Daily (4)', 'LONG (4)'),
    group('e', 'Other'),
  ]);
  assert.deepEqual(parseStoredGroupConfiguration(JSON.stringify(repaired)), repaired);
  assert.deepEqual(parseGroupConfiguration(JSON.stringify(repaired)), repaired);
  assert.deepEqual(original.groups, groups);
});

void test('legacy stored names are repaired while duplicate imports are rejected', () => {
  const legacy = {
    version: 2,
    allSkip: true,
    groups: [group('a', 'Daily'), group('b', 'DAILY')].map(({ id, name, entries, skip }) => ({
      id,
      name,
      entries,
      skip,
    })),
    shortcut: 'caps',
    groupShortcut: '',
    showIndicator: true,
  };
  assert.throws(
    () => parseGroupConfiguration(JSON.stringify(legacy)),
    /short names must be unique/u,
  );
  assert.deepEqual(
    parseStoredGroupConfiguration(JSON.stringify(legacy)).groups.map((item) => item.name),
    ['Daily', 'DAILY (2)'],
  );
});

void test('new groups skip occupied default names after deletions and case changes', () => {
  assert.equal(nextGroupName([]), 'Group 1');
  assert.equal(nextGroupName([group('a', 'Primary')]), 'Group 2');
  assert.equal(nextGroupName([group('a', ' group 3 '), group('b', 'Group 4')]), 'Group 5');
});
