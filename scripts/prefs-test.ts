// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { NATIVE_LOCALES, prepareNativeRuntime } from './native-runtime.ts';

function runPreferences(language: 'en' | 'ru' | 'lv'): void {
  const directory = mkdtempSync(`${tmpdir()}/k-switch-prefs-`);
  mkdirSync(`${directory}/runtime`, { mode: 0o700 });
  mkdirSync('artifacts', { recursive: true });
  try {
    prepareNativeRuntime(directory);
    execFileSync(
      'xvfb-run',
      [
        '-a',
        '-s',
        '-screen 0 900x900x24',
        'dbus-run-session',
        '--',
        'gjs',
        '-m',
        `${directory}/test/${language === 'en' ? 'prefs-smoke' : 'localized-prefs'}.js`,
      ],
      {
        stdio: 'inherit',
        timeout: 30_000,
        env: {
          ...process.env,
          LANGUAGE: language,
          LC_ALL: NATIVE_LOCALES[language],
          XDG_CONFIG_HOME: `${directory}/config`,
          XDG_DATA_HOME: `${directory}/data`,
          XDG_CACHE_HOME: `${directory}/cache`,
          XDG_STATE_HOME: `${directory}/state`,
          XDG_RUNTIME_DIR: `${directory}/runtime`,
          GSETTINGS_BACKEND: 'memory',
          GSETTINGS_SCHEMA_DIR: resolve('dist/schemas'),
          GDK_BACKEND: 'x11',
          GSK_RENDERER: 'cairo',
          GIO_USE_VFS: 'local',
          GI_TYPELIB_PATH: '/usr/lib/gnome-shell/girepository-1.0',
          LD_LIBRARY_PATH: '/usr/lib/gnome-shell',
          GTK_A11Y: 'none',
          GTK_USE_PORTAL: '0',
          G_DEBUG: 'fatal-criticals',
          WAYLAND_DISPLAY: undefined,
          K_SWITCH_SCREENSHOT: resolve(`artifacts/preferences-${language}.png`),
          K_SWITCH_GUARD_SCREENSHOT: resolve('artifacts/session-update.png'),
        },
      },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
for (const language of ['en', 'ru', 'lv'] as const) {
  runPreferences(language);
}
