// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { getShortcut } from '../src/core/config.js';
import { parseGroupConfiguration } from '../src/core/group-config.js';
import { OptionsLease } from '../src/core/options.js';
import { readConfiguration, writeConfiguration } from '../src/shared/settings.js';
import { verifyInitialSettings } from './initial-settings-smoke.js';
import { verifyInstalledVersion } from './installed-version-smoke.js';
import { readConfigurationFile, writeConfigurationFile } from '../src/prefs/config-files.js';

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

const settings = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.guru.bug.k-switch' });
const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
verifyInitialSettings(settings, desktop);
const imported = parseGroupConfiguration(
  '{"version":1,"firstSource":"xkb:ru","secondSource":"xkb:us","shortcut":"menu"}',
);
writeConfiguration(settings, imported);
check(
  readConfiguration(settings).groups[0]?.entries[0]?.source === 'xkb:ru',
  'Configuration must round trip through GSettings',
);
const peer = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.guru.bug.k-switch' });
writeConfiguration(settings, { ...imported, showIndicator: false });
check(
  !readConfiguration(peer).showIndicator,
  'Import must not leave the live settings object in delayed-write mode',
);
desktop.set_strv('xkb-options', ['compose:ralt']);
const lease = new OptionsLease(
  {
    read: (): string[] => desktop.get_strv('xkb-options'),
    write: (options): void => {
      desktop.set_strv('xkb-options', [...options]);
    },
  },
  getShortcut('caps'),
);
check(desktop.get_strv('xkb-options').includes('grp:caps_toggle'), 'Shortcut must be applied');
lease.release();
check(
  desktop.get_strv('xkb-options').join(',') === 'compose:ralt',
  'Original options must be restored',
);
const directory = GLib.dir_make_tmp('k-switch-config-XXXXXX');
const file = Gio.File.new_for_path(`${directory}/settings.json`);
try {
  writeConfigurationFile(file, imported);
  check(
    readConfigurationFile(file).groups[0]?.entries[0]?.source === 'xkb:ru',
    'Configuration file must round trip',
  );
  let oversizedExportRejected = false;
  try {
    writeConfigurationFile(file, {
      ...imported,
      groups: imported.groups.map((group) => ({ ...group, name: 'x'.repeat(16_385) })),
    });
  } catch {
    oversizedExportRejected = true;
  }
  check(
    oversizedExportRejected && readConfigurationFile(file).groups[0]?.name === 'Primary',
    'Oversized export must preserve the existing file',
  );
  for (const contents of [
    new Uint8Array(16_385),
    new Uint8Array([0xff]),
    new TextEncoder().encode('{}'),
  ]) {
    file.replace_contents(contents, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    let rejected = false;
    try {
      readConfigurationFile(file);
    } catch {
      rejected = true;
    }
    check(rejected, 'Oversized, invalid UTF-8 and invalid configuration must be rejected');
  }
} finally {
  if (file.query_exists(null)) {
    file.delete(null);
  }
  GLib.rmdir(directory);
}
await verifyInstalledVersion();
console.warn('GJS + real GSettings and bounded configuration-file checks passed (memory backend).');
