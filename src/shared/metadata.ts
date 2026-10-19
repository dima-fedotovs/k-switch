// SPDX-License-Identifier: GPL-3.0-or-later
import { MessageError } from '../core/messages.js';
import type Gio from 'gi://Gio';
import { UUID, VERSION } from './release.js';

export interface MetadataIdentity {
  readonly uuid: string;
  readonly 'version-name': string;
  readonly 'settings-schema': string;
}

export class SessionMismatch extends MessageError {}

function textField(value: Record<string, unknown>, field: string): string {
  const result = value[field];
  if (typeof result !== 'string' || result === '') {
    throw new MessageError('Extension metadata has no valid %s.', field);
  }
  return result;
}

function identity(value: unknown): MetadataIdentity {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MessageError('Extension metadata must be an object.');
  }
  const record = value as Record<string, unknown>;
  return {
    uuid: textField(record, 'uuid'),
    'version-name': textField(record, 'version-name'),
    'settings-schema': textField(record, 'settings-schema'),
  };
}

export function verifyMetadata(installed: MetadataIdentity, entryPoint: unknown): void {
  const supplied = identity(entryPoint);
  if (
    installed.uuid !== UUID ||
    supplied.uuid !== UUID ||
    installed['version-name'] !== VERSION ||
    supplied['version-name'] !== VERSION ||
    installed['settings-schema'] !== supplied['settings-schema']
  ) {
    throw new SessionMismatch(
      'K-switch metadata and running code do not match. Log out and sign in again. Saved settings are preserved.',
    );
  }
}

export function installedMetadata(
  file: Gio.File,
  cancellable: Gio.Cancellable,
): Promise<MetadataIdentity> {
  return new Promise((resolve, reject) => {
    file.load_contents_async(cancellable, (_file, result) => {
      try {
        const [, contents] = file.load_contents_finish(result);
        const value: unknown = JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(contents),
        );
        resolve(identity(value));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}
