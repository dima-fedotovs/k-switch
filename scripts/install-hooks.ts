// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';

const npm = process.env.npm_execpath;
assert(npm, 'Run npm run hooks:install so the npm CLI path is available.');
accessSync(npm, constants.R_OK);
execFileSync('git', ['config', '--local', 'kswitch.nodePath', process.execPath]);
execFileSync('git', ['config', '--local', 'kswitch.npmPath', npm]);
execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks']);
process.stdout.write(
  `Git hooks configured with Node ${process.versions.node}: ${process.execPath}\n`,
);
