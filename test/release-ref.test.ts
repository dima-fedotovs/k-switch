// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { verifyReleaseRef } from '../scripts/release-ref.js';
import { repositoryEnvironment } from '../scripts/git-environment.js';

class GitFixture {
  readonly directory = mkdtempSync(join(tmpdir(), 'k-switch-release-ref-'));
  readonly work = join(this.directory, 'work');
  readonly first: string;
  readonly later: string;

  constructor() {
    mkdirSync(this.work);
    this.git('init', '--bare', join(this.directory, 'remote.git'));
    this.git('init', '-b', 'main');
    this.git('config', 'user.name', 'Isolated release fixture');
    this.git('config', 'user.email', 'release-fixture@example.invalid');
    this.git('config', 'commit.gpgsign', 'false');
    this.git('config', 'tag.gpgsign', 'false');
    this.git('config', 'core.hooksPath', join(this.directory, 'empty-hooks'));
    this.first = this.commit('first');
    this.later = this.commit('later');
    this.git('remote', 'add', 'origin', join(this.directory, 'remote.git'));
    this.git('push', 'origin', 'main');
    this.git('checkout', '--detach', this.first);
  }

  git(...args: string[]): string {
    return execFileSync('git', args, {
      cwd: this.work,
      env: repositoryEnvironment(),
      encoding: 'utf8',
      timeout: 30_000,
    }).trim();
  }

  commit(content: string): string {
    writeFileSync(join(this.work, 'content.txt'), content);
    this.git('add', '.');
    this.git('commit', '-m', content);
    return this.git('rev-parse', 'HEAD');
  }

  destroy(): void {
    rmSync(this.directory, { recursive: true, force: true });
  }
}

void test('child repositories cannot inherit Git hook repository and index overrides', () => {
  const inherited = {
    PATH: process.env.PATH,
    GIT_DIR: '/parent/repository',
    GIT_COMMON_DIR: '/parent/common',
    GIT_WORK_TREE: '/parent/checkout',
    GIT_INDEX_FILE: '/parent/index',
    GIT_OBJECT_DIRECTORY: '/parent/objects',
    GIT_CONFIG_COUNT: '1',
  };
  const isolated = repositoryEnvironment(inherited);
  assert.deepEqual(isolated, { PATH: process.env.PATH });
  assert.equal(inherited.GIT_DIR, '/parent/repository');
});

void test('release refs reject moved/deleted/off-main tags and accept peeled annotated tags', () => {
  const fixture = new GitFixture();
  try {
    fixture.git('tag', 'v0.4.0');
    fixture.git('push', 'origin', 'v0.4.0');
    verifyReleaseRef('v0.4.0', fixture.first, fixture.work);
    assert.throws(() => {
      verifyReleaseRef('v0.4.0', fixture.later, fixture.work);
    }, /run commit/);
    assert.throws(() => {
      verifyReleaseRef('v0.4.0', '', fixture.work);
    }, /immutable workflow SHA/);
    fixture.git('tag', '-f', 'v0.4.0', fixture.later);
    fixture.git('push', '--force', 'origin', 'v0.4.0');
    assert.throws(() => {
      verifyReleaseRef('v0.4.0', fixture.first, fixture.work);
    }, /tag moved/);
    fixture.git('push', 'origin', ':refs/tags/v0.4.0');
    assert.throws(() => {
      verifyReleaseRef('v0.4.0', fixture.first, fixture.work);
    });
    fixture.git('tag', '-a', 'v0.4.0-rc.1', '-m', 'Annotated fixture');
    fixture.git('push', 'origin', 'v0.4.0-rc.1');
    verifyReleaseRef('v0.4.0-rc.1', fixture.first, fixture.work);
    verifyReleaseRef('v0.4.0-rc.1', fixture.git('rev-parse', 'v0.4.0-rc.1'), fixture.work);
    const outside = fixture.commit('not on main');
    fixture.git('tag', 'v0.4.0-rc.2');
    fixture.git('push', 'origin', 'v0.4.0-rc.2');
    assert.throws(() => {
      verifyReleaseRef('v0.4.0-rc.2', outside, fixture.work);
    });
  } finally {
    fixture.destroy();
  }
});
