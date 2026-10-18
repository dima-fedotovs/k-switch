// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const scripts = readdirSync('scripts').filter((file) => file.endsWith('.sh'));
for (const path of [
  ...scripts.map((file) => `scripts/${file}`),
  '.githooks/pre-commit',
  '.githooks/pre-push',
]) {
  execFileSync('bash', ['-n', path], { stdio: 'inherit' });
}
