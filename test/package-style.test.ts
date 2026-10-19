// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { format, resolveConfig } from 'prettier';
import { unzipSync, zipSync } from 'fflate';
import { checkPackagedJavaScript } from '../scripts/package-style.js';

function archive(source: string): Record<string, Uint8Array> {
  return unzipSync(zipSync({ 'runtime/example.js': new TextEncoder().encode(source) }));
}

void test('final ZIP style check accepts readable JavaScript with preserved comments', async () => {
  await checkPackagedJavaScript(archive('// Preserved comment.\nexport const example = 1;\n'));
});

void test('final ZIP gate rejects short unformatted JavaScript despite ignored artifact paths', async () => {
  await assert.rejects(checkPackagedJavaScript(archive('export const example=1;\n')), /Prettier/);
});

void test('final ZIP gate independently rejects formatted literals exceeding 200 characters', async () => {
  const configuration = await resolveConfig('src/extension.ts');
  const source = await format(`export const example = '${'x'.repeat(201)}';`, {
    ...configuration,
    parser: 'babel',
  });
  await assert.rejects(checkPackagedJavaScript(archive(source)), /exceeds 200 characters/);
});
