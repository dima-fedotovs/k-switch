// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

function runFixture(mode: 'full' | 'fresh'): void {
  const directory = mkdtempSync(`${tmpdir()}/k-switch-shell-${mode}-`);
  const extension = `${directory}/data/gnome-shell/extensions/k-switch@bug.guru`;
  const artifact = mode === 'full' ? 'shell-test' : 'fresh-setup-test';
  const sources =
    mode === 'full'
      ? "[('xkb','us'),('xkb','ru'),('xkb','lv+tilde')]"
      : "[('xkb','fr'),('xkb','de'),('xkb','es')]";
  mkdirSync('artifacts', { recursive: true });
  try {
    mkdirSync(extension, { recursive: true });
    mkdirSync(`${directory}/runtime`, { mode: 0o700 });
    cpSync('dist', extension, { recursive: true });
    cpSync('.build/src', `${extension}/src`, { recursive: true });
    cpSync('.build/test', `${extension}/test`, { recursive: true });
    writeFileSync(
      `${extension}/extension.js`,
      "export { default } from './test/fixture-extension.js';\n",
    );
    execFileSync(
      'dbus-run-session',
      ['--', 'bash', resolve('scripts/shell-session.sh'), directory],
      {
        env: {
          ...process.env,
          XDG_CONFIG_HOME: `${directory}/config`,
          XDG_DATA_HOME: `${directory}/data`,
          XDG_CACHE_HOME: `${directory}/cache`,
          XDG_STATE_HOME: `${directory}/state`,
          XDG_RUNTIME_DIR: `${directory}/runtime`,
          DISPLAY: undefined,
          WAYLAND_DISPLAY: undefined,
          DCONF_PROFILE: undefined,
          GSETTINGS_BACKEND: undefined,
          GIO_USE_VFS: 'local',
          K_SWITCH_FRESH_SETUP: mode === 'fresh' ? '1' : '0',
          K_SWITCH_INITIAL_SOURCES: sources,
        },
        stdio: 'inherit',
        timeout: 60_000,
      },
    );
    const result: unknown = JSON.parse(readFileSync(`${directory}/result.json`, 'utf8'));
    assert.doesNotMatch(
      readFileSync(`${directory}/shell.log`, 'utf8'),
      /(?:GNOME Shell|Gjs|GLib-GObject)-CRITICAL|JS ERROR/,
      'Native keyboard checks must not leave critical errors in GNOME Shell',
    );
    assert(typeof result === 'object' && result !== null && 'passed' in result);
    cpSync(`${directory}/result.json`, `artifacts/${artifact}.json`);
    assert.equal(
      result.passed,
      true,
      'error' in result ? String(result.error) : 'Shell checks failed',
    );
    process.stdout.write(`${JSON.stringify({ fixture: mode, result }, null, 2)}\n`);
  } finally {
    if (existsSync(`${directory}/shell.log`)) {
      cpSync(`${directory}/shell.log`, `artifacts/${artifact}.log`);
    }
    rmSync(directory, { recursive: true, force: true });
  }
}

for (const mode of ['full', 'fresh'] as const) {
  runFixture(mode);
}
