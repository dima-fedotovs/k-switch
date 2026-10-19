// SPDX-License-Identifier: GPL-3.0-or-later
import type { LayoutGroup } from './groups.js';

function nameKey(value: string): string {
  return value.trim().normalize('NFC').toLowerCase();
}

export function validateGroupNames(groups: readonly LayoutGroup[]): void {
  for (const field of ['name', 'longName'] as const) {
    const names = groups.map((group) => group[field]).filter((name) => name !== '');
    if (new Set(names.map(nameKey)).size !== names.length) {
      throw new Error(`Group ${field === 'name' ? 'short' : 'long'} names must be unique.`);
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

export function nextGroupName(groups: readonly LayoutGroup[]): string {
  const names = new Set(groups.map((group) => nameKey(group.name)));
  let index = groups.length + 1;
  while (names.has(nameKey(`Group ${String(index)}`))) {
    index += 1;
  }
  return `Group ${String(index)}`;
}
