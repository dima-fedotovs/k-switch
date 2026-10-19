// SPDX-License-Identifier: GPL-3.0-or-later
import { MessageError, N_ } from './messages.js';
import type { LayoutGroup } from './groups.js';

function nameKey(value: string): string {
  return value.trim().normalize('NFC').toLowerCase();
}

export function validateGroupNames(groups: readonly LayoutGroup[]): void {
  for (const field of ['name', 'longName'] as const) {
    const names = groups.map((group) => group[field]).filter((name) => name !== '');
    if (new Set(names.map(nameKey)).size !== names.length) {
      const template =
        field === 'name'
          ? N_('Group short names must be unique.')
          : N_('Group long names must be unique.');
      throw new MessageError(template);
    }
  }
}

class Names {
  readonly #reserved: ReadonlySet<string>;
  readonly #used = new Set<string>();

  constructor(values: readonly string[]) {
    this.#reserved = new Set(values.map(nameKey));
  }

  claim(value: string): string {
    if (value === '') {
      return '';
    }
    let candidate = value;
    if (this.#used.has(nameKey(candidate))) {
      let suffix = 2;
      do {
        candidate = `${value} (${String(suffix)})`;
        suffix += 1;
      } while (this.#used.has(nameKey(candidate)) || this.#reserved.has(nameKey(candidate)));
    }
    this.#used.add(nameKey(candidate));
    return candidate;
  }
}

export function restoreGroupNames(groups: readonly LayoutGroup[]): readonly LayoutGroup[] {
  const short = new Names(groups.map((group) => group.name));
  const long = new Names(groups.map((group) => group.longName));
  return groups.map((group) => ({
    ...group,
    name: short.claim(group.name),
    longName: long.claim(group.longName),
  }));
}

// Translators: %s is the sequence number of a newly created group.
export function nextGroupName(groups: readonly LayoutGroup[], template = N_('Group %s')): string {
  const names = new Set(groups.map((group) => nameKey(group.name)));
  let index = groups.length + 1;
  while (names.has(nameKey(template.replace('%s', String(index))))) {
    index += 1;
  }
  return template.replace('%s', String(index));
}
