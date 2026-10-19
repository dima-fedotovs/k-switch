// SPDX-License-Identifier: GPL-3.0-or-later
import { cpSync } from 'node:fs';

export const NATIVE_LOCALES = { en: 'en_US.UTF-8', ru: 'ru_RU.UTF-8', lv: 'lv_LV.UTF-8' } as const;

export function prepareNativeRuntime(directory: string): void {
  // Production imports resolve to the formatted runtime verified against the ZIP.
  cpSync('dist', `${directory}/src`, { recursive: true });
  cpSync('.build/test', `${directory}/test`, { recursive: true });
}
