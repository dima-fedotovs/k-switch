// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  initialConfiguration,
  migrate,
  parseGroupConfiguration,
} from '../src/core/group-config.js';
import {
  chooseGroup,
  externalGroup,
  groupMenuName,
  indicatorText,
  members,
  reconcile,
  rotateGroup,
  validGroup,
  withinGroup,
  type GroupConfiguration,
  type LayoutGroup,
} from '../src/core/groups.js';

const sources = ['xkb:us', 'xkb:ru', 'ibus:anthy', 'xkb:de'];
const v1 = { version: 1 as const, firstSource: 'xkb:us', secondSource: 'xkb:ru', shortcut: 'caps' };
const base = migrate(v1);
const second: LayoutGroup = {
  id: 'japanese',
  name: 'jp',
  longName: 'Japanese',
  skip: true,
  entries: [
    { source: 'xkb:us', enabled: true },
    { source: 'ibus:anthy', enabled: true },
  ],
};
const config: GroupConfiguration = { ...base, groups: [...base.groups, second] };
const groups = config.groups;
const v2 = {
  version: 2,
  allSkip: true,
  shortcut: 'caps',
  groupShortcut: '',
  showIndicator: true,
  groups: [
    {
      id: 'primary',
      name: 'Primary',
      skip: false,
      entries: [
        { source: 'xkb:us', enabled: true },
        { source: 'xkb:ru', enabled: true },
      ],
    },
  ],
};

void test('fresh groups enable only the first two configured sources, without language assumptions', () => {
  assert.deepEqual(
    initialConfiguration(['ibus:anthy', 'xkb:de', 'xkb:fr'], 'caps').groups[0]?.entries,
    [
      { source: 'ibus:anthy', enabled: true },
      { source: 'xkb:de', enabled: true },
      { source: 'xkb:fr', enabled: false },
    ],
  );
  assert.deepEqual(initialConfiguration([], 'caps').groups[0]?.entries, []);
  assert.deepEqual(initialConfiguration(['xkb:fr', 'xkb:fr'], 'caps').groups[0]?.entries, [
    { source: 'xkb:fr', enabled: true },
  ]);
});

void test('v1/v2 migrate without the system group, preserving names, order and next shortcut', () => {
  assert.deepEqual(parseGroupConfiguration(JSON.stringify(v1)), base);
  assert.deepEqual(parseGroupConfiguration(JSON.stringify(v2)), base);
  assert.deepEqual(parseGroupConfiguration(JSON.stringify(config)), config);
  assert.equal(
    parseGroupConfiguration(JSON.stringify({ ...v2, groupShortcut: '<Super>g' })).groupShortcut,
    '<Super>g',
  );
  assert.equal(migrate({ ...v1, secondSource: 'xkb:us' }).groups[0]?.entries.length, 1);
  assert.equal(base.showSource, false);
  const result = reconcile(config, ['xkb:ru', 'ibus:new']);
  assert.deepEqual(result.groups[0]?.entries, [
    { source: 'xkb:ru', enabled: true },
    { source: 'ibus:new', enabled: false },
  ]);
  assert.deepEqual(reconcile(result, sources).groups[0]?.entries, [
    { source: 'xkb:ru', enabled: true },
    { source: 'xkb:us', enabled: false },
    { source: 'ibus:anthy', enabled: false },
    { source: 'xkb:de', enabled: false },
  ]);
});

void test('unassigned sources keep the last group and Caps resumes it at its first member', () => {
  assert.equal(externalGroup(groups, { group: 'primary', source: 'xkb:de' }, sources), 'primary');
  assert.deepEqual(withinGroup(groups, { group: 'primary', source: 'xkb:de' }, sources), {
    group: 'primary',
    source: 'xkb:us',
  });
  assert.equal(
    withinGroup(groups, { group: 'primary', source: 'xkb:us' }, sources).source,
    'xkb:ru',
  );
  assert.equal(
    withinGroup(groups, { group: 'primary', source: 'xkb:ru' }, sources).source,
    'xkb:us',
  );
  assert.equal(withinGroup(groups, { group: 'primary', source: null }, sources).source, 'xkb:us');
  assert.equal(
    withinGroup(groups, { group: 'primary', source: 'xkb:us' }, ['xkb:us']).source,
    'xkb:us',
  );
  assert.equal(withinGroup(groups, { group: 'primary', source: 'xkb:us' }, []).source, null);
  assert.deepEqual(withinGroup([], { group: '', source: 'xkb:us' }, sources), {
    group: '',
    source: 'xkb:us',
  });
  assert.deepEqual(
    members({ ...second, entries: [{ source: 'xkb:us', enabled: false }] }, sources),
    [],
  );
  assert.equal(validGroup(groups, 'japanese', sources), 'japanese');
  assert.equal(validGroup(groups, 'all', sources), 'primary');
  assert.equal(validGroup(groups, 'primary', []), '');
});

void test('next/previous rotate circularly, skip excluded or ineffective groups and otherwise do nothing', () => {
  const state = { group: 'primary', source: 'xkb:us' };
  assert.deepEqual(rotateGroup(groups, state, sources, 1), state);
  const enabled = groups.map((group) => ({ ...group, skip: false }));
  assert.deepEqual(rotateGroup(enabled, state, sources, 1), {
    group: 'japanese',
    source: 'ibus:anthy',
  });
  assert.deepEqual(rotateGroup(enabled, { group: 'japanese', source: 'ibus:anthy' }, sources, 1), {
    group: 'primary',
    source: 'xkb:us',
  });
  assert.equal(
    rotateGroup(enabled, { group: 'primary', source: null }, sources, -1).group,
    'japanese',
  );
  assert.equal(
    rotateGroup(enabled, { group: 'japanese', source: null }, sources, -1).group,
    'primary',
  );
  assert.equal(
    rotateGroup(enabled, { group: 'missing', source: null }, sources, -1).group,
    'japanese',
  );
  assert.deepEqual(rotateGroup(enabled, state, ['xkb:us'], 1), state);
  assert.deepEqual(rotateGroup([], state, [], -1), state);
});

void test('three groups distinguish forward and backward rotation, including wraparound', () => {
  const german: LayoutGroup = {
    id: 'german',
    name: 'de',
    longName: 'German',
    skip: false,
    entries: [{ source: 'xkb:de', enabled: true }],
  };
  const three = [...groups.map((group) => ({ ...group, skip: false })), german];
  const start = { group: 'primary', source: 'xkb:us' };
  assert.equal(rotateGroup(three, start, sources, 1).group, 'japanese');
  assert.deepEqual(rotateGroup(three, start, sources, -1), { group: 'german', source: 'xkb:de' });
  assert.equal(
    rotateGroup(three, { group: 'german', source: 'xkb:de' }, sources, 1).group,
    'primary',
  );
  assert.equal(
    rotateGroup(
      three.map((group) => ({ ...group, skip: group.id === 'german' })),
      start,
      sources,
      -1,
    ).group,
    'japanese',
  );
});

void test('external selection retains overlapping membership and searches all groups including excluded ones', () => {
  assert.equal(externalGroup(groups, { group: 'primary', source: 'xkb:us' }, sources), 'primary');
  assert.equal(
    externalGroup(groups, { group: 'primary', source: 'ibus:anthy' }, sources),
    'japanese',
  );
  assert.equal(externalGroup(groups, { group: 'japanese', source: 'xkb:ru' }, sources), 'primary');
  assert.equal(externalGroup(groups, { group: 'primary', source: null }, sources), 'primary');
  assert.equal(externalGroup(groups, { group: 'missing', source: 'xkb:ru' }, sources), 'primary');
  assert.equal(externalGroup([], { group: '', source: 'xkb:de' }, sources), '');
});

void test('menu names prefer optional long names; panel defaults to the short group label', () => {
  assert.equal(groupMenuName(second), 'Japanese');
  assert.equal(groupMenuName({ ...second, longName: '' }), 'jp');
  assert.equal(indicatorText(second, 'us', false), 'jp');
  assert.equal(indicatorText(second, 'us', true), 'jp · us');
  assert.equal(indicatorText(undefined, 'us', false), '—');
  assert.deepEqual(chooseGroup(second, 'xkb:us', sources), {
    group: 'japanese',
    source: 'ibus:anthy',
  });
  assert.equal(chooseGroup(second, 'xkb:us', ['xkb:us']).source, 'xkb:us');
  assert.equal(chooseGroup(second, null, []).source, null);
});

void test('rejects invalid v3 and legacy configurations before applying anything', () => {
  const invalid: unknown[] = [
    null,
    [],
    3,
    {},
    { ...config, version: 4 },
    { ...config, extra: true },
    { ...config, shortcut: '' },
    { ...config, shortcut: 1 },
    { ...config, shortcut: '\n' },
    { ...config, shortcut: 'bad' },
    { ...config, groupShortcut: null },
    { ...config, previousGroupShortcut: 1 },
    { ...config, showSource: null },
    { ...config, showIndicator: null },
    { ...config, groups: null },
    { ...config, groups: [second, second] },
    { ...v2, allSkip: 1 },
    ...[
      null,
      { ...second, id: 'all' },
      { ...second, id: 1 },
      { ...second, name: '' },
      { ...second, name: 'bad\nname' },
      { ...second, longName: 1 },
      { ...second, longName: '\n' },
      { ...second, skip: 1 },
      { ...second, entries: 1 },
      { ...second, entries: [null] },
      { ...second, entries: [{ source: 'unknown:us', enabled: true }] },
      { ...second, entries: [{ source: '', enabled: true }] },
      { ...second, entries: [{ source: 'xkb:us', enabled: 1 }] },
      { ...second, entries: [second.entries[0], second.entries[0]] },
    ].map((group) => ({ ...config, groups: [group] })),
  ];
  for (const value of invalid) {
    assert.throws(() => parseGroupConfiguration(JSON.stringify(value)));
  }
  assert.throws(() => parseGroupConfiguration('{'));
});
