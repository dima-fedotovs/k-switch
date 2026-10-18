// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const directory = mkdtempSync(`${tmpdir()}/k-switch-shell-`);
const extension = `${directory}/data/gnome-shell/extensions/k-switch@bug.guru`;
mkdirSync(extension, { recursive: true });
mkdirSync(`${directory}/runtime`, { mode: 0o700 });
mkdirSync('artifacts', { recursive: true });
cpSync('dist', extension, { recursive: true });
cpSync('.build/src', `${extension}/src`, { recursive: true });
cpSync('.build/test', `${extension}/test`, { recursive: true });
writeFileSync(
  `${extension}/extension.js`,
  "export { default } from './test/fixture-extension.js';\n",
);
try {
  execFileSync('dbus-run-session', ['--', 'bash', resolve('scripts/shell-session.sh'), directory], {
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
    },
    stdio: 'inherit',
    timeout: 60_000,
  });
  const result: unknown = JSON.parse(readFileSync(`${directory}/result.json`, 'utf8'));
  assert.doesNotMatch(
    readFileSync(`${directory}/shell.log`, 'utf8'),
    /(?:GNOME Shell|Gjs|GLib-GObject)-CRITICAL|JS ERROR/,
    'Native keyboard checks must not leave critical errors in GNOME Shell',
  );
  assert(typeof result === 'object' && result !== null && 'passed' in result);
  cpSync(`${directory}/result.json`, 'artifacts/shell-test.json');
  assert.equal(
    result.passed,
    true,
    'error' in result ? String(result.error) : 'Shell checks failed',
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  cpSync(`${directory}/shell.log`, 'artifacts/shell-test.log');
  rmSync(directory, { recursive: true, force: true });
}
