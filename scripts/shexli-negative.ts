// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { zipSync, strToU8 } from 'fflate';

const directory = mkdtempSync(join(tmpdir(), 'k-switch-shexli-controls-'));
const gate = resolve('.build/scripts/shexli-check.js');
const logs = 'artifacts/shexli/controls';
mkdirSync(logs, { recursive: true });

function fixture(mode: 'clean' | 'schema' | 'sync'): string {
  const schema = mode === 'schema' ? 'guru.bug.probe' : 'org.gnome.shell.extensions.guru.bug.probe';
  const path =
    mode === 'schema' ? '/guru/bug/probe/' : '/org/gnome/shell/extensions/guru/bug/probe/';
  const body =
    mode === 'sync' ? "Gio.File.new_for_path('/tmp/controlled-probe').load_contents(null);" : '';
  const files = {
    'metadata.json': strToU8(
      JSON.stringify({
        uuid: 'review-probe@bug.guru',
        name: 'Review probe',
        description: 'Controlled analyzer fixture',
        'shell-version': ['50'],
        'settings-schema': schema,
      }),
    ),
    'extension.js': strToU8(
      "import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';\n" +
        "import Gio from 'gi://Gio';\n" +
        `export default class Probe extends Extension {enable() {${body}} disable() {}}\n`,
    ),
    [`schemas/${schema}.gschema.xml`]: strToU8(
      `<schemalist><schema id="${schema}" path="${path}"><key name="enabled" type="b"><default>false</default></key></schema></schemalist>`,
    ),
  };
  const archive = join(directory, `${mode}.zip`);
  writeFileSync(archive, zipSync(files));
  return archive;
}

function run(input: string, label: string, env = process.env): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [gate, input, `${logs}/${label}.json`], {
    env,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

function reject(input: string, label: string, expected: RegExp, env = process.env): void {
  const result = run(input, label, env);
  assert.equal(result.error, undefined, `${label}: checker must start`);
  assert.notEqual(result.status, null, `${label}: checker must finish`);
  assert.notEqual(result.status, 0, `${label}: checker must reject`);
  const output = `${result.stdout}\n${result.stderr}`;
  writeFileSync(`${logs}/${label}.log`, output);
  assert.match(output, expected);
  process.stdout.write(`Verified Shexli rejection: ${label}\n`);
}

try {
  const clean = fixture('clean');
  const accepted = run(clean, 'clean');
  assert.equal(accepted.error, undefined);
  assert.equal(accepted.status, 0, `${accepted.stdout}\n${accepted.stderr}`);
  reject(fixture('schema'), 'schema', /EGO-P-001.*EGO-P-002/su);
  reject(fixture('sync'), 'warning', /EGO-X-004/u);
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  const environment = { ...process.env, PATH: bin };
  reject(clean, 'unavailable', /Shexli scanner failed/u, environment);
  for (const [label, command, expected] of [
    ['failure', 'exit 7', /Shexli scanner failed: 7/u],
    ['malformed', "printf 'not-json'", /SyntaxError/u],
    ['partial', "printf '{}'", /Expected a report object/u],
    [
      'diagnostic',
      "/bin/cat artifacts/shexli/controls/clean.json; printf 'analysis incomplete' >&2",
      /Shexli scanner diagnostics/u,
    ],
  ] as const) {
    writeFileSync(join(bin, 'shexli'), `#!/bin/sh\n${command}\n`, { mode: 0o700 });
    reject(clean, label, expected, environment);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
