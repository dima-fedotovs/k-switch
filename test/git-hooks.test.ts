// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { repositoryEnvironment } from '../scripts/git-environment.js';

const runner = resolve('scripts/git-check.sh');
const installer = resolve('scripts/install-hooks.ts');

class HookFixture {
  readonly directory = mkdtempSync(join(tmpdir(), 'k-switch-hook tools-'));
  readonly bin = join(this.directory, 'node tools');
  readonly npm = join(this.bin, 'npm-cli.js');
  readonly env = { ...repositoryEnvironment(), PATH: '/usr/bin:/bin' };

  constructor() {
    this.git(['init', '--quiet']);
    mkdirSync(this.bin);
    mkdirSync(join(this.directory, '.venv/bin'), { recursive: true });
    writeFileSync(this.npm, '', { mode: 0o600 });
    writeFileSync(join(this.directory, '.venv/bin/shexli'), '', { mode: 0o700 });
    writeFileSync(
      join(this.bin, 'node'),
      '#!/bin/sh\nprintf "%s\\n" "$@" "$(command -v node)" "$(command -v shexli)"\nexit 23\n',
      { mode: 0o700 },
    );
  }

  git(args: string[]): string {
    return execFileSync('git', args, {
      cwd: this.directory,
      env: this.env,
      encoding: 'utf8',
    }).trim();
  }

  run(): ReturnType<typeof spawnSync> {
    return spawnSync('/bin/bash', [runner], {
      cwd: this.directory,
      env: this.env,
      encoding: 'utf8',
    });
  }

  destroy(): void {
    rmSync(this.directory, { recursive: true, force: true });
  }
}

void test('Git hooks resolve recorded tools and project Shexli with an IDE-style PATH', () => {
  const fixture = new HookFixture();
  try {
    fixture.git(['config', '--local', 'kswitch.nodePath', join(fixture.bin, 'node')]);
    fixture.git(['config', '--local', 'kswitch.npmPath', fixture.npm]);
    const result = fixture.run();
    assert.equal(result.error, undefined);
    assert.equal(result.status, 23, 'Propagate the check failure instead of bypassing it');
    assert.equal(
      result.stdout,
      [
        fixture.npm,
        'run',
        'check',
        join(fixture.bin, 'node'),
        join(fixture.directory, '.venv/bin/shexli'),
        '',
      ].join('\n'),
    );
  } finally {
    fixture.destroy();
  }
});

void test('Git hooks reject absent or removed tools with actionable setup instructions', () => {
  const fixture = new HookFixture();
  try {
    const missing = fixture.run();
    assert.equal(missing.status, 1);
    assert.match(String(missing.stderr), /npm run hooks:install/);
    fixture.git(['config', '--local', 'kswitch.nodePath', join(fixture.bin, 'missing-node')]);
    fixture.git(['config', '--local', 'kswitch.npmPath', fixture.npm]);
    const removed = fixture.run();
    assert.equal(removed.status, 1);
    assert.match(String(removed.stderr), /unavailable.*npm run hooks:install/);
    assert.equal(removed.stdout, '');
  } finally {
    fixture.destroy();
  }
});

void test('Hook installation records the actual runtime without modifying another repository', () => {
  const fixture = new HookFixture();
  try {
    execFileSync(process.execPath, [installer], {
      cwd: fixture.directory,
      env: { ...fixture.env, npm_execpath: fixture.npm },
    });
    assert.equal(fixture.git(['config', '--local', 'kswitch.nodePath']), process.execPath);
    assert.equal(fixture.git(['config', '--local', 'kswitch.npmPath']), fixture.npm);
    assert.equal(fixture.git(['config', '--local', 'core.hooksPath']), '.githooks');
  } finally {
    fixture.destroy();
  }
});
