// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import { parseGroupConfiguration } from '../core/group-config.js';
import type { GroupConfiguration } from '../core/groups.js';

const MAX_IMPORT_BYTES = 16_384;

export function readConfigurationFile(file: Gio.File): GroupConfiguration {
  const stream = file.read(null);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = stream.read_bytes(MAX_IMPORT_BYTES + 1 - length, null).get_data();
      if (chunk === null || chunk.length === 0) {
        break;
      }
      length += chunk.length;
      if (length > MAX_IMPORT_BYTES) {
        throw new Error('Configuration exceeds 16 KiB.');
      }
      chunks.push(chunk);
    }
  } finally {
    stream.close(null);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return parseGroupConfiguration(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export function writeConfigurationFile(file: Gio.File, configuration: GroupConfiguration): void {
  const validated = parseGroupConfiguration(JSON.stringify(configuration));
  const text = `${JSON.stringify(validated, null, 2)}\n`;
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_IMPORT_BYTES) {
    throw new Error('Configuration exceeds 16 KiB; reduce group count before exporting.');
  }
  file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
}
