// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { installedMetadata, verifyMetadata } from '../src/shared/metadata.js';
import { UUID, VERSION } from '../src/shared/release.js';

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

async function rejected(file: Gio.File, request = new Gio.Cancellable()): Promise<void> {
  let failed = false;
  try {
    await installedMetadata(file, request);
  } catch {
    failed = true;
  }
  check(failed, 'Invalid, missing or cancelled metadata must reject the version check');
}

export async function verifyInstalledVersion(): Promise<void> {
  const directory = GLib.dir_make_tmp('k-switch-installed-version-XXXXXX');
  const file = Gio.File.new_for_path(`${directory}/metadata.json`);
  try {
    await rejected(file);
    for (const content of ['{}', '{', '{"version-name":42}', new Uint8Array([255])]) {
      file.replace_contents(content, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
      await rejected(file);
    }
    file.replace_contents(
      JSON.stringify({ uuid: UUID, 'version-name': VERSION, 'settings-schema': 'schema.fixture' }),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
    );
    const version = installedMetadata(file, new Gio.Cancellable());
    check(version instanceof Promise, 'The installed-version check must be asynchronous');
    const metadata = await version;
    check(metadata['version-name'] === VERSION, 'Read the installed metadata asynchronously');
    verifyMetadata(metadata, metadata);
    for (const field of ['uuid', 'version-name', 'settings-schema']) {
      let failed = false;
      try {
        verifyMetadata(metadata, { ...metadata, [field]: 'wrong-value' });
      } catch {
        failed = true;
      }
      check(failed, `Metadata mismatch must block: ${field}`);
    }
    const request = new Gio.Cancellable();
    request.cancel();
    await rejected(file, request);
    const pending = new Gio.Cancellable();
    const cancelled = rejected(file, pending);
    pending.cancel();
    await cancelled;
  } finally {
    if (file.query_exists(null)) {
      file.delete(null);
    }
    GLib.rmdir(directory);
  }
}
