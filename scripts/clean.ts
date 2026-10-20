// SPDX-License-Identifier: GPL-3.0-or-later
import { rmSync } from 'node:fs';

for (const path of ['.build', 'dist', 'artifacts', 'coverage', '.nyc_output']) {
  rmSync(path, { recursive: true, force: true });
}
