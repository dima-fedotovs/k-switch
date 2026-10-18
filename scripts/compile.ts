// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

rmSync('.build', { recursive: true, force: true });
execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { stdio: 'inherit' });
