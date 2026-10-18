// SPDX-License-Identifier: GPL-3.0-or-later
export interface Configuration {
  readonly version: 1;
  readonly firstSource: string;
  readonly secondSource: string;
  readonly shortcut: string;
}

export interface Shortcut {
  readonly id: string;
  readonly label: string;
  readonly option: string;
  readonly usesCaps: boolean;
  readonly description: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  {
    id: 'caps',
    label: 'Caps Lock',
    option: 'grp:caps_toggle',
    usesCaps: true,
    description: 'Shift+Caps Lock toggles normal Caps Lock.',
  },
  {
    id: 'shift-caps',
    label: 'Shift + Caps Lock',
    option: 'grp:shift_caps_toggle',
    usesCaps: true,
    description: 'Caps Lock keeps its normal function.',
  },
  {
    id: 'alt-caps',
    label: 'Alt + Caps Lock',
    option: 'grp:alt_caps_toggle',
    usesCaps: true,
    description: 'Caps Lock keeps its normal function.',
  },
  {
    id: 'menu',
    label: 'Menu',
    option: 'grp:menu_toggle',
    usesCaps: false,
    description: 'Shift+Menu opens the context menu.',
  },
  {
    id: 'scroll-lock',
    label: 'Scroll Lock',
    option: 'grp:sclk_toggle',
    usesCaps: false,
    description: 'Requires a Scroll Lock key.',
  },
  {
    id: 'both-shifts',
    label: 'Both Shift keys',
    option: 'grp:shifts_toggle',
    usesCaps: false,
    description: 'Press the left and right Shift keys together.',
  },
  {
    id: 'alt-shift',
    label: 'Alt + Shift',
    option: 'grp:alt_shift_toggle',
    usesCaps: false,
    description: 'May interfere with application shortcuts containing Alt+Shift.',
  },
  {
    id: 'ctrl-shift',
    label: 'Ctrl + Shift',
    option: 'grp:ctrl_shift_toggle',
    usesCaps: false,
    description: 'May interfere with Ctrl+Shift+C/V and other application shortcuts.',
  },
];

export function getShortcut(id: string): Shortcut {
  const shortcut = SHORTCUTS.find((item) => item.id === id);
  if (shortcut === undefined) {
    throw new Error(`Unknown shortcut: ${id}`);
  }
  return shortcut;
}

function isSource(value: unknown): value is string {
  return typeof value === 'string' && /^xkb:[a-zA-Z0-9_+-]+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseConfiguration(text: string): Configuration {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) {
    throw new Error('Configuration must be a JSON object.');
  }
  const fields = Object.keys(value).sort();
  if (fields.join(',') !== 'firstSource,secondSource,shortcut,version') {
    throw new Error(
      'Configuration must contain exactly version, firstSource, secondSource, shortcut.',
    );
  }
  if (value.version !== 1) {
    throw new Error('Unsupported configuration version.');
  }
  if (!isSource(value.firstSource) || !isSource(value.secondSource)) {
    throw new Error('Choose two valid XKB layout identifiers.');
  }
  if (value.firstSource === value.secondSource) {
    throw new Error('Choose two different layouts.');
  }
  if (typeof value.shortcut !== 'string') {
    throw new Error('Shortcut must be a string.');
  }
  getShortcut(value.shortcut);
  return {
    version: 1,
    firstSource: value.firstSource,
    secondSource: value.secondSource,
    shortcut: value.shortcut,
  };
}

export function decodeSources(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error('GNOME input sources must be an array.');
  }
  return value.map((entry: unknown) => {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'string' ||
      typeof entry[1] !== 'string'
    ) {
      throw new Error('Invalid GNOME input source.');
    }
    return `${entry[0]}:${entry[1]}`;
  });
}
