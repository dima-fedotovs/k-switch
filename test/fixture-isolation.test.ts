// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

void test('Shell fixture refuses each unisolated XDG path before invoking desktop tools', () => {
  const directory = mkdtempSync(join(tmpdir(), 'k-switch-isolation-control-'));
  try {
    const bin = join(directory, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'gsettings'), '#!/bin/sh\nexit 99\n', { mode: 0o700 });
    const paths = {
      XDG_CONFIG_HOME: join(directory, 'config'),
      XDG_DATA_HOME: join(directory, 'data'),
      XDG_CACHE_HOME: join(directory, 'cache'),
      XDG_STATE_HOME: join(directory, 'state'),
      XDG_RUNTIME_DIR: join(directory, 'runtime'),
    };
    for (const key of Object.keys(paths)) {
      const result = spawnSync(
        '/bin/bash',
        ['-x', resolve('scripts/shell-session.sh'), directory],
        {
          env: {
            ...process.env,
            ...paths,
            [key]: join(directory, 'wrong'),
            GSETTINGS_BACKEND: 'memory',
            PATH: `${bin}:${process.env.PATH ?? ''}`,
          },
          encoding: 'utf8',
        },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, 1, `Must refuse ${key} before executing the gsettings control`);
      assert.doesNotMatch(`${result.stdout}${result.stderr}`, /\bgsettings\b/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
