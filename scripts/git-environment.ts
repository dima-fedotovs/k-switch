// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';

export function repositoryEnvironment(environment = process.env): NodeJS.ProcessEnv {
  // Hooks export repository-local variables. Explicit cwd alone does not stop a
  // child Git process from using the hook's repository, index or object store.
  const local = new Set(
    execFileSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' }).trim().split('\n'),
  );
  return Object.fromEntries(Object.entries(environment).filter(([name]) => !local.has(name)));
}
