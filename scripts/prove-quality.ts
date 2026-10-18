// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const identity = randomUUID();
const source = `src/core/quality-probe-${identity}.ts`;
const test = `test/quality-probe-${identity}.test.ts`;
const owned = new Set<string>();
mkdirSync('artifacts', { recursive: true });

function removeProbe(path: string): void {
  if (owned.delete(path)) {
    rmSync(path);
  }
}

function writeProbe(path: string, contents: string): void {
  removeProbe(path);
  writeFileSync(path, contents, { flag: 'wx' });
  owned.add(path);
}

function reject(label: string, command: string, args: readonly string[], expected: RegExp): void {
  const log = `artifacts/quality-${label.replaceAll(' ', '-')}.log`;
  const descriptor = openSync(log, 'w');
  const result = spawnSync(command, args, { stdio: ['ignore', descriptor, descriptor] });
  closeSync(descriptor);
  assert.equal(result.error, undefined, `${label}: checker must start`);
  assert.notEqual(result.status, null, `${label}: checker must finish normally`);
  assert.notEqual(result.status, 0, `${label}: bad changes must be rejected`);
  assert.match(
    readFileSync(log, 'utf8'),
    expected,
    `${label}: must reject for the intended reason`,
  );
  process.stdout.write(`Verified rejection: ${label}\n`);
}

try {
  writeProbe(source, 'export const probe=1');
  reject('formatting', 'npm', ['exec', '--', 'prettier', '--check', source], /Code style issues/);
  writeProbe(source, 'export const probe: string = 1;\n');
  reject('type safety', 'npm', ['run', 'typecheck'], /TS2322/);
  writeProbe(source, 'export const probe: any = 1;\n');
  reject(
    'unsafe types',
    'npm',
    ['exec', '--', 'eslint', source, '--max-warnings', '0'],
    /no-explicit-any/,
  );
  writeProbe(source, '/* eslint-disable */\nexport const probe: any = 1;\n');
  reject(
    'inline lint escape',
    'npm',
    ['exec', '--', 'eslint', source, '--max-warnings', '0'],
    /no-explicit-any/,
  );
  removeProbe(source);
  writeProbe(
    test,
    "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nvoid test('deliberate failing assertion', () => { assert.equal(1, 2); });\n",
  );
  reject('failing assertions', 'npm', ['test'], /ERR_ASSERTION|AssertionError/);
  removeProbe(test);
  writeProbe(source, 'export function probe(value: boolean): number { return value ? 1 : 0; }\n');
  reject(
    'uncovered production code',
    'npm',
    ['test'],
    /Coverage .* does not meet|coverage threshold/i,
  );
} finally {
  for (const path of owned) {
    removeProbe(path);
  }
}
