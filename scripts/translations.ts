// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const languages = ['ru', 'lv'] as const;
const header = `# SPDX-License-Identifier: GPL-3.0-or-later
# K-switch messages.
msgid ""
msgstr ""
"Project-Id-Version: K-switch\\n"
"Report-Msgid-Bugs-To: https://github.com/dima-fedotovs/k-switch/issues\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"

`;

function run(root: string, command: string, args: readonly string[]): string {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C.UTF-8', LANGUAGE: 'C' },
  });
  assert(
    result.error === undefined,
    `Required gettext tool failed: ${command}: ${String(result.error)}`,
  );
  assert(
    result.status === 0 && result.stderr.trim() === '',
    `Gettext validation failed: ${command}: ${result.stderr}`,
  );
  return result.stdout;
}

export function extractTranslations(root: string): string {
  const files = readdirSync(resolve(root, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts'))
    .sort()
    .map((file) => `src/${file}`);
  assert(files.length > 0, 'Translation extraction requires source files');
  const extracted = run(root, 'xgettext', [
    '--language=JavaScript',
    '--from-code=UTF-8',
    '--keyword',
    '--keyword=_',
    '--keyword=N_',
    '--keyword=text:1',
    '--keyword=MessageError:1',
    '--keyword=SessionMismatch:1',
    '--add-comments=Translators:',
    '--no-location',
    '--output=-',
    ...files,
  ]);
  // Keep xgettext's UTF-8 header during extraction, then replace its timestamps.
  // --omit-header loses the output charset in gettext 0.23.2.
  const boundary = extracted.indexOf('\n\n');
  assert(boundary >= 0, 'Extraction must contain a complete header');
  const body = extracted.slice(boundary + 2);
  assert(body.includes('msgid '), 'Extraction must discover application messages');
  return header + body;
}

function checkCatalogFormats(root: string, catalog: string, template: string): void {
  const directory = mkdtempSync(`${tmpdir()}/k-switch-format-catalog-`);
  try {
    const merged = `${directory}/validated.po`;
    // Validate with source-derived format flags even if a PO editor removed them.
    run(root, 'msgmerge', [
      '--no-fuzzy-matching',
      '--quiet',
      `--output-file=${merged}`,
      catalog,
      template,
    ]);
    // msgmerge may mark a restored format flag fuzzy. Validate that temporary
    // entry too; original fuzzy entries are rejected separately below.
    run(root, 'msgfmt', [
      '--check',
      '--check-format',
      '--use-fuzzy',
      '--output-file=/dev/null',
      merged,
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function checkTranslations(root = process.cwd()): void {
  const template = 'po/k-switch.pot';
  assert.equal(
    readFileSync(resolve(root, template), 'utf8'),
    extractTranslations(root),
    'POT is stale; run npm run translations:update',
  );
  for (const language of languages) {
    const catalog = `po/${language}.po`;
    run(root, 'msgfmt', ['--check', '--check-format', '--output-file=/dev/null', catalog]);
    run(root, 'msgcmp', ['--no-fuzzy-matching', catalog, template]);
    checkCatalogFormats(root, catalog, template);
    for (const filter of ['--untranslated', '--only-fuzzy', '--only-obsolete']) {
      assert.equal(
        run(root, 'msgattrib', [filter, catalog]).trim(),
        '',
        `${catalog}: ${filter} entries are forbidden`,
      );
    }
  }
}

export function compileTranslations(directory: string): void {
  checkTranslations();
  for (const language of languages) {
    const destination = `${directory}/locale/${language}/LC_MESSAGES`;
    mkdirSync(destination, { recursive: true });
    run(process.cwd(), 'msgfmt', [
      '--check',
      '--check-format',
      `--output-file=${destination}/k-switch.mo`,
      `po/${language}.po`,
    ]);
  }
}

export function checkLocaleResources(contents: Readonly<Record<string, Uint8Array>>): void {
  for (const language of languages) {
    const name = `locale/${language}/LC_MESSAGES/k-switch.mo`;
    const bytes = contents[name];
    assert(bytes !== undefined && bytes.length >= 28, `Missing compiled catalog: ${name}`);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    assert(
      view.getUint32(0, true) === 0x950412de || view.getUint32(0, false) === 0x950412de,
      `Invalid compiled catalog: ${name}`,
    );
  }
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  if (process.argv[2] === 'update') {
    mkdirSync('po', { recursive: true });
    writeFileSync('po/k-switch.pot', extractTranslations(process.cwd()));
  } else {
    checkTranslations();
    process.stdout.write('Gettext: current POT; complete Russian and Latvian catalogs.\n');
  }
}
