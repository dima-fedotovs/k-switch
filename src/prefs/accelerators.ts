// SPDX-License-Identifier: GPL-3.0-or-later
import { N_ } from '../core/messages.js';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import type { GroupConfiguration } from '../core/groups.js';

export function validAccelerator(value: string): boolean {
  if (value === '') {
    return true;
  }
  const [valid, key, modifiers] = Gtk.accelerator_parse(value);
  return (
    valid &&
    key !== 0 &&
    modifiers !== null &&
    (Boolean(modifiers) || (key >= Gdk.KEY_F1 && key <= Gdk.KEY_F35)) &&
    Gtk.accelerator_valid(key, modifiers)
  );
}

export function groupShortcutError(
  configuration: Pick<GroupConfiguration, 'groupShortcut' | 'previousGroupShortcut'>,
): string | null {
  const { groupShortcut: next, previousGroupShortcut: previous } = configuration;
  if (!validAccelerator(next) || !validAccelerator(previous)) {
    return N_('Invalid group shortcut. Use a key with modifiers or a function key.');
  }
  if (next !== '' && previous !== '') {
    const [, nextKey, nextModifiers] = Gtk.accelerator_parse(next);
    const [, previousKey, previousModifiers] = Gtk.accelerator_parse(previous);
    if (nextKey === previousKey && nextModifiers === previousModifiers) {
      return N_('Next and previous group shortcuts must be different.');
    }
  }
  return null;
}
