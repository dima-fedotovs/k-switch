// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { checkLocaleResources, compileTranslations } from './translations.ts';
import { checkPackagedJavaScript, formatRuntime } from './package-style.ts';

const release: unknown = await import(
  new URL('../.build/src/shared/release.js', import.meta.url).href
);
assert(
  typeof release === 'object' &&
    release !== null &&
    'VERSION' in release &&
    typeof release.VERSION === 'string',
);
const version = release.VERSION;

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
mkdirSync('artifacts', { recursive: true });
cpSync('.build/src', 'dist', {
  recursive: true,
  filter: (path) => statSync(path).isDirectory() || path.endsWith('.js'),
});
await formatRuntime('dist');
compileTranslations('dist');
for (const path of ['metadata.json', 'LICENSE', 'NOTICE', 'schemas']) {
  cpSync(path, `dist/${path}`, { recursive: true });
}
execFileSync('glib-compile-schemas', ['--strict', 'dist/schemas'], { stdio: 'inherit' });
execFileSync(
  'gnome-extensions',
  [
    'pack',
    'dist',
    '--out-dir=artifacts',
    '--force',
    '--extra-source=core',
    '--extra-source=shared',
    '--extra-source=runtime',
    '--extra-source=prefs',
    '--extra-source=LICENSE',
    '--extra-source=NOTICE',
    '--extra-source=locale',
  ],
  { stdio: 'inherit' },
);
const metadata: unknown = JSON.parse(readFileSync('metadata.json', 'utf8'));
const manifest: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
assert(
  typeof metadata === 'object' &&
    metadata !== null &&
    'uuid' in metadata &&
    typeof metadata.uuid === 'string',
);
assert(
  'version-name' in metadata && metadata['version-name'] === version,
  'Metadata version must match code',
);
assert(
  typeof manifest === 'object' &&
    manifest !== null &&
    'version' in manifest &&
    manifest.version === version,
  'Package version must match code',
);
const archive = `artifacts/${metadata.uuid}.shell-extension.zip`;
const contents = unzipSync(readFileSync(archive));
checkLocaleResources(contents);
await checkPackagedJavaScript(contents);
const entries = Object.keys(contents)
  .filter((entry) => !entry.endsWith('/'))
  .sort();
const expected = readdirSync('dist', { recursive: true, encoding: 'utf8' })
  .filter((entry) => statSync(`dist/${entry}`).isFile() && entry !== 'schemas/gschemas.compiled')
  .sort();
assert.deepEqual(entries, expected, 'ZIP must contain exactly the required runtime files');
for (const entry of entries) {
  assert.deepEqual(
    contents[entry],
    new Uint8Array(readFileSync(`dist/${entry}`)),
    `Packaged content differs: ${entry}`,
  );
}
process.stdout.write(
  `Verified ${archive}: ${String(entries.length)} files, exact content match.\n`,
);
