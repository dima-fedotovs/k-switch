// SPDX-License-Identifier: GPL-3.0-or-later
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { unzipSync } from 'fflate';
import { list, object } from './security-policy.js';
import { checkShexli } from './shexli-policy.js';
import { UUID } from '../src/shared/release.js';

function capturedOutput(value: unknown): string {
  // Node returns null streams when spawning fails, despite its encoding overload.
  return typeof value === 'string' ? value : '';
}

const input = process.argv[2] ?? `artifacts/${UUID}.shell-extension.zip`;
const output = process.argv[3] ?? 'artifacts/shexli/report.json';
const archive = unzipSync(readFileSync(input));
const metadata = archive['metadata.json'];
if (metadata === undefined) {
  throw new Error('Missing ZIP metadata.');
}
const metadataValue: unknown = JSON.parse(new TextDecoder().decode(metadata));
const targetVersions = list(object(metadataValue)['shell-version'])
  .map((version) => Number.parseInt(String(version), 10))
  .sort((left, right) => left - right);
const files = Object.keys(archive).filter((path) => !path.endsWith('/'));
mkdirSync(dirname(output), { recursive: true });
const result = spawnSync('shexli', ['--format', 'json', input], {
  encoding: 'utf8',
  timeout: 120_000,
  maxBuffer: 16 * 1024 * 1024,
});
writeFileSync(output, capturedOutput(result.stdout));
writeFileSync(`${output}.stderr.log`, capturedOutput(result.stderr));
if (result.error !== undefined || result.status !== 0) {
  throw new Error(`Shexli scanner failed: ${String(result.error ?? result.status)}`);
}
if (result.stderr.trim() !== '') {
  throw new Error(`Shexli scanner diagnostics: ${result.stderr.trim()}`);
}
const report: unknown = JSON.parse(result.stdout);
checkShexli(report, input, {
  fileCount: files.length,
  jsFileCount: files.filter((path) => path.endsWith('.js')).length,
  targetVersions,
});
process.stdout.write(`Shexli: clean; ${String(files.length)} ZIP files analyzed.\n`);
