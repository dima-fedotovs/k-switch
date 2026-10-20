// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { repositoryEnvironment } from '../scripts/git-environment.js';

const checker = resolve('scripts/check-staged.ts');

class SnapshotFixture {
  readonly directory = mkdtempSync(join(tmpdir(), 'k-switch-staged-test-'));
  readonly npm = join(this.directory, 'npm.cjs');
  readonly probe = join(this.directory, 'snapshot-path');
  readonly env = repositoryEnvironment();

  constructor() {
    this.git(['init', '--quiet']);
    mkdirSync(join(this.directory, 'node_modules'));
    this.write('package-lock.json', '{}');
    this.write('staged.txt', 'valid');
    this.git(['add', 'package-lock.json', 'staged.txt']);
    this.write(
      'npm.cjs',
      `
const fs = require('node:fs');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
assert.deepEqual(process.argv.slice(2), ['run', 'check']);
fs.writeFileSync(process.env.SNAPSHOT_PROBE, process.cwd());
assert.equal(fs.readFileSync('staged.txt', 'utf8'), 'valid');
assert.equal(fs.existsSync('unstaged-only.txt'), false);
fs.mkdirSync('.build');
fs.writeFileSync('.build/temporary-output', 'generated');
if (process.env.CHANGE_INDEX) {
  fs.writeFileSync(process.env.CHANGE_INDEX + '/staged.txt', 'raced');
  cp.execFileSync('git', ['-C', process.env.CHANGE_INDEX, 'add', 'staged.txt']);
}
`,
    );
  }

  write(path: string, content: string): void {
    writeFileSync(join(this.directory, path), content);
  }

  git(args: string[]): string {
    return execFileSync('git', args, {
      cwd: this.directory,
      env: this.env,
      encoding: 'utf8',
    }).trim();
  }

  run(changeIndex = false): ReturnType<typeof spawnSync> {
    return spawnSync(process.execPath, [checker, this.npm], {
      cwd: this.directory,
      env: {
        ...this.env,
        SNAPSHOT_PROBE: this.probe,
        ...(changeIndex ? { CHANGE_INDEX: this.directory } : {}),
      },
      encoding: 'utf8',
    });
  }

  verifyCleanup(): void {
    assert(
      !existsSync(readFileSync(this.probe, 'utf8')),
      'Snapshot and its build outputs are removed',
    );
    assert(!existsSync(join(this.directory, '.build')), 'Working build outputs are untouched');
  }

  destroy(): void {
    rmSync(this.directory, { recursive: true, force: true });
  }
}

void test('Partial staging checks index content and leaves unstaged/untracked work untouched', () => {
  const fixture = new SnapshotFixture();
  try {
    fixture.write('staged.txt', 'invalid unstaged edit');
    fixture.write('unstaged-only.txt', 'unfinished work');
    const tree = fixture.git(['write-tree']);
    const result = fixture.run();
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, String(result.stderr));
    assert.equal(fixture.git(['write-tree']), tree);
    assert.equal(
      readFileSync(join(fixture.directory, 'staged.txt'), 'utf8'),
      'invalid unstaged edit',
    );
    assert.equal(
      readFileSync(join(fixture.directory, 'unstaged-only.txt'), 'utf8'),
      'unfinished work',
    );
    fixture.verifyCleanup();
  } finally {
    fixture.destroy();
  }
});

void test('Unstaged repairs cannot hide a failing staged snapshot', () => {
  const fixture = new SnapshotFixture();
  try {
    fixture.write('staged.txt', 'invalid staged edit');
    fixture.git(['add', 'staged.txt']);
    fixture.write('staged.txt', 'valid');
    const tree = fixture.git(['write-tree']);
    const result = fixture.run();
    assert.notEqual(result.status, 0);
    assert.match(String(result.stderr), /invalid staged edit/);
    assert.equal(fixture.git(['write-tree']), tree);
    assert.equal(readFileSync(join(fixture.directory, 'staged.txt'), 'utf8'), 'valid');
    fixture.verifyCleanup();
  } finally {
    fixture.destroy();
  }
});

void test('Staged checks reject a changed index and mismatching dependency lockfiles', () => {
  const fixture = new SnapshotFixture();
  try {
    const raced = fixture.run(true);
    assert.notEqual(raced.status, 0);
    assert.match(String(raced.stderr), /Git index changed during checks/);
    fixture.verifyCleanup();
    fixture.write('package-lock.json', '{"changed":true}');
    const lock = fixture.run();
    assert.notEqual(lock.status, 0);
    assert.match(String(lock.stderr), /Staged and working package-lock.json must match/);
  } finally {
    fixture.destroy();
  }
});
