// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const directory = mkdtempSync(`${tmpdir()}/k-switch-secret-control-`);
try {
  const secret = 'ghp_' + 'Ab9De8Fg7Hi6Jk5Lm4No3Pq2Rs1Tu0Vw9Xy8';
  writeFileSync(`${directory}/fixture.txt`, `token=${secret}\n`);
  const result = spawnSync('gitleaks', ['dir', '--redact=100', directory], { encoding: 'utf8' });
  assert.equal(result.status, 1, 'Real secret scanner must reject a synthetic credential');
  assert(!`${result.stdout}${result.stderr}`.includes(secret), 'Reports must redact credentials');
  assert.throws(() => execFileSync(process.execPath, ['-e', 'process.exit(7)'], { stdio: 'pipe' }));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
