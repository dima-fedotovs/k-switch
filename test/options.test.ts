// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getShortcut } from '../src/core/config.js';
import {
  findCapsConflict,
  OptionsLease,
  sameOptions,
  type OptionsPort,
} from '../src/core/options.js';

class MemoryOptions implements OptionsPort {
  options: string[];
  writes = 0;
  constructor(options: string[]) {
    this.options = options;
  }
  read(): string[] {
    return [...this.options];
  }
  write(options: readonly string[]): void {
    this.options = [...options];
    this.writes += 1;
  }
}

void test('temporarily replaces group switching and restores the original shortcuts', () => {
  const port = new MemoryOptions(['compose:ralt', 'grp:alt_shift_toggle', 'grp:menu_toggle']);
  const lease = new OptionsLease(port, getShortcut('caps'));
  assert.deepEqual(port.options, ['compose:ralt', 'grp:caps_toggle']);
  lease.release();
  assert.deepEqual(port.options, ['compose:ralt', 'grp:alt_shift_toggle', 'grp:menu_toggle']);
});

void test('does not rewrite an already matching configuration', () => {
  const port = new MemoryOptions(['grp:caps_toggle']);
  const lease = new OptionsLease(port, getShortcut('caps'));
  lease.release();
  assert.equal(port.writes, 0);
});

void test('preserves unrelated settings changed while the extension was running', () => {
  const port = new MemoryOptions([]);
  const lease = new OptionsLease(port, getShortcut('caps'));
  port.options.push('compose:ralt');
  lease.release();
  assert.deepEqual(port.options, ['compose:ralt']);
});

void test('does not overwrite a newer group shortcut chosen by the user', () => {
  const port = new MemoryOptions([]);
  const lease = new OptionsLease(port, getShortcut('caps'));
  port.options = ['grp:menu_toggle'];
  lease.release();
  assert.deepEqual(port.options, ['grp:menu_toggle']);
});

void test('identifies Caps remaps without confusing unrelated options', () => {
  const conflicts = [
    'caps:escape',
    'ctrl:nocaps',
    'ctrl:swapcaps',
    'ctrl:grouptoggle_capscontrol',
    'ctrl:hyper_capscontrol',
    'compose:caps',
    'compose:caps-altgr',
    'lv3:caps_switch',
    'lv5:caps_switch',
  ];
  for (const option of conflicts) {
    assert.equal(findCapsConflict([option], getShortcut('caps')), option);
    assert.throws(() => new OptionsLease(new MemoryOptions([option]), getShortcut('caps')));
    assert.equal(findCapsConflict([option], getShortcut('menu')), undefined);
  }
  assert.equal(
    findCapsConflict(['compose:ralt', 'grp_led:caps', 'lv3:ralt_switch'], getShortcut('caps')),
    undefined,
  );
});

void test('option comparison accounts for length and individual entries', () => {
  assert.equal(sameOptions([], []), true);
  assert.equal(sameOptions(['a'], []), false);
  assert.equal(sameOptions(['a'], ['b']), false);
});
