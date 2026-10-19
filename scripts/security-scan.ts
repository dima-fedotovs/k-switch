// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  checkLicenses,
  checkScanCodeInventory,
  checkProvenance,
  localProvenance,
  object,
  sha256,
  list,
} from './security-policy.js';

const provenance = localProvenance(process.argv.slice(2), process.env.GITHUB_ACTIONS === 'true');
const root = 'artifacts/security';
const source = `${root}/source`;
const code = `${root}/code`;
rmSync(root, { recursive: true, force: true });
mkdirSync(source, { recursive: true });
const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
for (const path of paths) {
  mkdirSync(join(source, path, '..'), { recursive: true });
  cpSync(path, join(source, path));
  if (provenance && /^(src|test|scripts)\/.*\.(ts|js|sh)$/u.test(path)) {
    mkdirSync(join(code, path, '..'), { recursive: true });
    cpSync(path, join(code, path));
  }
}
function run(command: string, args: string[]): void {
  execFileSync(command, args, { stdio: 'inherit', timeout: 600_000 });
}
function json(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}
run('gitleaks', [
  'git',
  '--redact=100',
  '--log-opts=HEAD',
  '--report-path',
  `${root}/history-secrets.json`,
  '.',
]);
run('gitleaks', ['dir', '--redact=100', '--report-path', `${root}/source-secrets.json`, source]);
run('gitleaks', ['dir', '--redact=100', '--report-path', `${root}/zip-secrets.json`, 'dist']);
function scanLicenses(input: string, output: string): void {
  run('scancode', ['-cl', '--quiet', '--processes', '2', '--json-pp', output, input]);
}
scanLicenses(source, `${root}/source-licenses.json`);
// ScanCode's directory walker always skips .gitignore as VCS metadata. Explicit
// single-file mode scans its exact bytes instead of excluding it from review.
scanLicenses(`${source}/.gitignore`, `${root}/vcs-licenses.json`);
scanLicenses('dist', `${root}/zip-licenses.json`);
function licenses(path: string, base: string, expected: readonly string[]): void {
  const report = object(json(path));
  // Check the trusted input inventory before using any reported path to read a file.
  checkScanCodeInventory(report, expected);
  const hashes = Object.fromEntries(
    list(report.files)
      .map(object)
      .filter((file) => file.type === 'file')
      .map((file) => [String(file.path), sha256(readFileSync(join(base, String(file.path))))]),
  );
  checkLicenses(report, json('security/licenses.json'), hashes);
}
licenses(
  `${root}/source-licenses.json`,
  root,
  paths.filter((path) => path !== '.gitignore').map((path) => `source/${path}`),
);
licenses(`${root}/vcs-licenses.json`, source, ['.gitignore']);
licenses(
  `${root}/zip-licenses.json`,
  '.',
  readdirSync('dist', { recursive: true, encoding: 'utf8' })
    .filter((path) => statSync(join('dist', path)).isFile())
    .map((path) => `dist/${path}`),
);
function scanProvenance(): number {
  // The only network scan consumes this WFP, never a source folder or dependency tree.
  run('scanoss-py', ['wfp', '-o', `${root}/source.wfp`, code]);
  run('scanoss-py', ['scan', '-w', `${root}/source.wfp`, '-o', `${root}/provenance.json`]);
  const files = Object.fromEntries(
    [...readFileSync(`${root}/source.wfp`, 'utf8').matchAll(/^file=[^,]+,[^,]+,(.+)$/gmu)].map(
      (match) => {
        const path = match[1];
        if (path === undefined || path.startsWith('/') || path.split('/').includes('..')) {
          throw new Error('Unexpected fingerprint path.');
        }
        return [path, sha256(readFileSync(join(source, path)))];
      },
    ),
  );
  checkProvenance(
    json(`${root}/provenance.json`),
    files,
    object(json('security/provenance.json')).approvals,
  );
  return Object.keys(files).length;
}
const fingerprintedFiles = provenance ? scanProvenance() : 0;
writeFileSync(
  `${root}/summary.json`,
  JSON.stringify(
    {
      files: paths.length,
      fingerprintedFiles,
      provenance: provenance ? 'reviewed' : 'local-only-not-run',
      licenses: 'reviewed',
      secrets: 'none',
    },
    null,
    2,
  ) + '\n',
);
