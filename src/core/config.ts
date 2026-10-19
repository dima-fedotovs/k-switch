// SPDX-License-Identifier: GPL-3.0-or-later
import { MessageError, N_ } from './messages.js';
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
    label: N_('Caps Lock'),
    option: 'grp:caps_toggle',
    usesCaps: true,
    description: N_('Shift+Caps Lock toggles normal Caps Lock.'),
  },
  {
    id: 'shift-caps',
    label: N_('Shift + Caps Lock'),
    option: 'grp:shift_caps_toggle',
    usesCaps: true,
    description: N_('Caps Lock keeps its normal function.'),
  },
  {
    id: 'alt-caps',
    label: N_('Alt + Caps Lock'),
    option: 'grp:alt_caps_toggle',
    usesCaps: true,
    description: N_('Caps Lock keeps its normal function.'),
  },
  {
    id: 'menu',
    label: N_('Menu'),
    option: 'grp:menu_toggle',
    usesCaps: false,
    description: N_('Shift+Menu opens the context menu.'),
  },
  {
    id: 'scroll-lock',
    label: N_('Scroll Lock'),
    option: 'grp:sclk_toggle',
    usesCaps: false,
    description: N_('Requires a Scroll Lock key.'),
  },
  {
    id: 'both-shifts',
    label: N_('Both Shift keys'),
    option: 'grp:shifts_toggle',
    usesCaps: false,
    description: N_('Press the left and right Shift keys together.'),
  },
  {
    id: 'alt-shift',
    label: N_('Alt + Shift'),
    option: 'grp:alt_shift_toggle',
    usesCaps: false,
    description: N_('May interfere with application shortcuts containing Alt+Shift.'),
  },
  {
    id: 'ctrl-shift',
    label: N_('Ctrl + Shift'),
    option: 'grp:ctrl_shift_toggle',
    usesCaps: false,
    description: N_('May interfere with Ctrl+Shift+C/V and other application shortcuts.'),
  },
];

export function getShortcut(id: string): Shortcut {
  const shortcut = SHORTCUTS.find((item) => item.id === id);
  if (shortcut === undefined) {
    throw new MessageError('Unknown shortcut: %s', id);
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
    throw new MessageError('Configuration must be a JSON object.');
  }
  const fields = Object.keys(value).sort();
  if (fields.join(',') !== 'firstSource,secondSource,shortcut,version') {
    throw new MessageError(
      'Configuration must contain exactly version, firstSource, secondSource, shortcut.',
    );
  }
  if (value.version !== 1) {
    throw new MessageError('Unsupported configuration version.');
  }
  if (!isSource(value.firstSource) || !isSource(value.secondSource)) {
    throw new MessageError('Choose two valid XKB layout identifiers.');
  }
  if (value.firstSource === value.secondSource) {
    throw new MessageError('Choose two different layouts.');
  }
  if (typeof value.shortcut !== 'string') {
    throw new MessageError('Shortcut must be a string.');
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
    throw new MessageError('GNOME input sources must be an array.');
  }
  return value.map((entry: unknown) => {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'string' ||
      typeof entry[1] !== 'string'
    ) {
      throw new MessageError('Invalid GNOME input source.');
    }
    return `${entry[0]}:${entry[1]}`;
  });
}
