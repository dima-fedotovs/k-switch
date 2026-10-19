// SPDX-License-Identifier: GPL-3.0-or-later
import { MessageError } from './messages.js';
import type { Shortcut } from './config.js';

export interface OptionsPort {
  read(): string[];
  write(options: readonly string[]): void;
}

export function groupOptions(options: readonly string[]): string[] {
  return options.filter((option) => option.startsWith('grp:'));
}

function withoutGroupOptions(options: readonly string[]): string[] {
  return options.filter((option) => !option.startsWith('grp:'));
}

export function sameOptions(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function findCapsConflict(
  options: readonly string[],
  shortcut: Shortcut,
): string | undefined {
  if (!shortcut.usesCaps) {
    return undefined;
  }
  return options.find(
    (option) =>
      option.startsWith('caps:') ||
      option === 'ctrl:nocaps' ||
      option === 'ctrl:swapcaps' ||
      option === 'ctrl:grouptoggle_capscontrol' ||
      option === 'ctrl:hyper_capscontrol' ||
      option.startsWith('compose:caps') ||
      /^lv[35]:caps/.test(option),
  );
}

export class OptionsLease {
  readonly #port: OptionsPort;
  readonly #previous: readonly string[];
  readonly #applied: readonly string[];

  constructor(port: OptionsPort, shortcut: Shortcut) {
    this.#port = port;
    const previous = port.read();
    const conflict = findCapsConflict(previous, shortcut);
    if (conflict !== undefined) {
      throw new MessageError(
        'Caps Lock is already assigned by %s. Remove that assignment first.',
        conflict,
      );
    }
    this.#previous = groupOptions(previous);
    this.#applied = [shortcut.option];
    const applied = [...withoutGroupOptions(previous), ...this.#applied];
    if (!sameOptions(previous, applied)) {
      port.write(applied);
    }
  }

  release(): void {
    const current = this.#port.read();
    if (!sameOptions(groupOptions(current), this.#applied)) {
      return;
    }
    const restored = [...withoutGroupOptions(current), ...this.#previous];
    if (!sameOptions(current, restored)) {
      this.#port.write(restored);
    }
  }
}
