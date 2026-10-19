// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { prepareNativeRuntime } from './native-runtime.ts';

const directory = mkdtempSync(`${tmpdir()}/k-switch-gjs-`);
try {
  prepareNativeRuntime(directory);
  execFileSync('gjs', ['-m', `${directory}/test/gjs-smoke.js`], {
    stdio: 'inherit',
    env: {
      ...process.env,
      GSETTINGS_BACKEND: 'memory',
      GSETTINGS_SCHEMA_DIR: resolve('dist/schemas'),
    },
  });
} finally {
  rmSync(directory, { recursive: true, force: true });
}
