// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
import { repositoryEnvironment } from './git-environment.js';

export function verifyReleaseRef(tag: string, runObject: string, directory = process.cwd()): void {
  if (!/^[a-f0-9]{40}$/u.test(runObject)) {
    throw new Error('Missing or invalid immutable workflow SHA.');
  }
  const git = (args: readonly string[]): string =>
    execFileSync('git', [...args], {
      cwd: directory,
      env: repositoryEnvironment(),
      encoding: 'utf8',
      timeout: 30_000,
    }).trim();
  const reference = `refs/tags/${tag}`;
  git(['check-ref-format', reference]);
  const expected = git(['rev-parse', '--verify', `${runObject}^{commit}`]);
  const checked = git(['rev-parse', 'HEAD']);
  if (checked !== expected) {
    throw new Error('Checked checkout does not match the immutable workflow run commit.');
  }
  git(['merge-base', '--is-ancestor', checked, 'origin/main']);
  const refs = new Map(
    git(['ls-remote', '--exit-code', 'origin', reference, `${reference}^{}`])
      .split('\n')
      .map((line) => {
        const [hash, name] = line.split('\t');
        if (hash === undefined || name === undefined || !/^[a-f0-9]{40}$/u.test(hash)) {
          throw new Error('Invalid remote tag response.');
        }
        return [name, hash] as const;
      }),
  );
  if ((refs.get(`${reference}^{}`) ?? refs.get(reference)) !== checked) {
    throw new Error('Remote release tag moved away from the checked workflow commit.');
  }
}
