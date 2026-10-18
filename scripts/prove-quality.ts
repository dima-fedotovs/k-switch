// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

const source = 'src/core/quality-probe.ts';
const test = 'test/quality-probe.test.ts';
assert(!existsSync(source) && !existsSync(test), 'Quality probe paths must be unused');
mkdirSync('artifacts', { recursive: true });

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
  writeFileSync(source, 'export const probe=1');
  reject('formatting', 'npm', ['exec', '--', 'prettier', '--check', source], /Code style issues/);
  writeFileSync(source, 'export const probe: string = 1;\n');
  reject('type safety', 'npm', ['run', 'typecheck'], /TS2322/);
  writeFileSync(source, 'export const probe: any = 1;\n');
  reject(
    'unsafe types',
    'npm',
    ['exec', '--', 'eslint', source, '--max-warnings', '0'],
    /no-explicit-any/,
  );
  writeFileSync(source, '/* eslint-disable */\nexport const probe: any = 1;\n');
  reject(
    'inline lint escape',
    'npm',
    ['exec', '--', 'eslint', source, '--max-warnings', '0'],
    /no-explicit-any/,
  );
  rmSync(source);
  writeFileSync(
    test,
    "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nvoid test('deliberate failing assertion', () => { assert.equal(1, 2); });\n",
  );
  reject('failing assertions', 'npm', ['test'], /ERR_ASSERTION|AssertionError/);
  rmSync(test);
  writeFileSync(
    source,
    'export function probe(value: boolean): number { return value ? 1 : 0; }\n',
  );
  reject(
    'uncovered production code',
    'npm',
    ['test'],
    /Coverage .* does not meet|coverage threshold/i,
  );
} finally {
  rmSync(source, { force: true });
  rmSync(test, { force: true });
}
