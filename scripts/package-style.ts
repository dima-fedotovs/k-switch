// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { check, format, resolveConfig, type Options } from 'prettier';

async function options(): Promise<Options> {
  const configuration = await resolveConfig('src/extension.ts');
  assert(configuration !== null, 'Packaged JavaScript requires the project Prettier config');
  return { ...configuration, parser: 'babel' };
}

export async function formatRuntime(directory: string): Promise<void> {
  const configuration = await options();
  for (const entry of await readdir(directory, { recursive: true })) {
    if (entry.endsWith('.js')) {
      const path = join(directory, entry);
      await writeFile(path, await format(await readFile(path, 'utf8'), configuration));
    }
  }
}

export async function checkPackagedJavaScript(
  contents: Readonly<Record<string, Uint8Array>>,
): Promise<void> {
  const configuration = await options();
  for (const [name, bytes] of Object.entries(contents)) {
    if (!name.endsWith('.js')) {
      continue;
    }
    const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assert(await check(source, configuration), `Packaged JavaScript must match Prettier: ${name}`);
    for (const [index, line] of source.split('\n').entries()) {
      assert(
        line.length <= 200,
        `Packaged JavaScript exceeds 200 characters: ${name}:${String(index + 1)}`,
      );
    }
  }
}
