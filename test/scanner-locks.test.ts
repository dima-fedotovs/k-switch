// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

void test('scanner root pins stay synchronized with Dependabot-updated hash locks', () => {
  for (const name of ['requirements', 'shexli-requirements']) {
    const roots = readFileSync(`security/${name}.in`, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
    const locked = new Set(
      readFileSync(`security/${name}.txt`, 'utf8')
        .split('\n')
        .map((line) => line.replace(/ \\$/u, '')),
    );
    assert(roots.length > 0, `${name}.in must declare scanner roots`);
    for (const root of roots) {
      assert.match(root, /^[a-z0-9-]+==\S+$/u, 'Scanner roots must use exact versions');
      assert(locked.has(root), `Synchronize ${root} in ${name}.in and ${name}.txt`);
    }
  }
});
