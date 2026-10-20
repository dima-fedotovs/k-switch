// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repositoryEnvironment } from './git-environment.ts';

function exportTree(tree: string, repository: string, directory: string): void {
  const entries = execFileSync('git', ['ls-tree', '-r', '-z', tree], {
    cwd: repository,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
  for (const entry of entries) {
    const match = /^(100644|100755|120000) blob ([a-f0-9]+)\t(.+)$/s.exec(entry);
    assert(match, 'Staged snapshot must contain regular files or symbolic links, not submodules.');
    const [, mode, hash, name] = match;
    assert(mode && hash && name);
    const path = resolve(directory, name);
    assert(path.startsWith(`${directory}/`), 'Staged path must stay inside the snapshot.');
    mkdirSync(dirname(path), { recursive: true });
    const content = execFileSync('git', ['cat-file', 'blob', hash], { cwd: repository });
    if (mode === '120000') {
      symlinkSync(content.toString('utf8'), path);
    } else {
      writeFileSync(path, content, { mode: mode === '100755' ? 0o755 : 0o644 });
    }
  }
}

function linkDependencies(repository: string, snapshot: string): void {
  assert.deepEqual(
    readFileSync(join(snapshot, 'package-lock.json')),
    readFileSync(join(repository, 'package-lock.json')),
    'Staged and working package-lock.json must match before sharing installed dependencies.',
  );
  symlinkSync(join(repository, 'node_modules'), join(snapshot, 'node_modules'), 'dir');
}

export function checkStaged(npm: string, repository = process.cwd()): void {
  const tree = (): string =>
    execFileSync('git', ['write-tree'], {
      cwd: repository,
      encoding: 'utf8',
    }).trim();
  const initial = tree();
  const directory = mkdtempSync(join(tmpdir(), 'k-switch-staged-'));
  try {
    exportTree(initial, repository, directory);
    linkDependencies(repository, directory);
    process.stdout.write(
      'Checking the staged snapshot; unstaged and untracked files are excluded.\n',
    );
    execFileSync(process.execPath, [npm, 'run', 'check'], {
      cwd: directory,
      env: repositoryEnvironment(),
      stdio: 'inherit',
    });
    assert.equal(tree(), initial, 'Git index changed during checks. Retry the commit.');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const npm = process.argv[2];
  assert(npm, 'Pass the configured npm CLI path.');
  checkStaged(npm);
}
