// SPDX-License-Identifier: GPL-3.0-or-later
import { cpSync } from 'node:fs';

export function prepareNativeRuntime(directory: string): void {
  // Production imports resolve to the formatted runtime verified against the ZIP.
  cpSync('dist', `${directory}/src`, { recursive: true });
  cpSync('.build/test', `${directory}/test`, { recursive: true });
}
