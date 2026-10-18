// SPDX-License-Identifier: GPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkSarif } from './security-policy.js';

const directory = process.argv[2];
if (directory === undefined) {
  throw new Error('Supply the CodeQL SARIF directory.');
}
const files = readdirSync(directory).filter((path) => path.endsWith('.sarif'));
if (files.length === 0) {
  throw new Error('CodeQL did not produce SARIF.');
}
for (const path of files) {
  const report: unknown = JSON.parse(readFileSync(join(directory, path), 'utf8'));
  checkSarif(report);
}
