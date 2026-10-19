// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import { createSystemShortcuts, type ShortcutAction } from '../src/shared/system-shortcuts.js';
import { readConfiguration, writeConfiguration } from '../src/shared/settings.js';

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function entry(path: string): Gio.Settings {
  return new Gio.Settings({
    schema_id: 'org.gnome.settings-daemon.plugins.media-keys.custom-keybinding',
    path,
  });
}

export function verifySystemShortcuts(settings: Gio.Settings): void {
  const errors: unknown[] = [];
  const fallbacks: (readonly ShortcutAction[])[] = [];
  const onError = (error: unknown): void => {
    errors.push(error);
  };
  const parent = new Gio.Settings({ schema_id: 'org.gnome.settings-daemon.plugins.media-keys' });
  const unrelated = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/user-owned/';
  parent.set_strv('custom-keybindings', [unrelated]);
  const shortcuts = createSystemShortcuts(settings, onError, (actions) => {
    fallbacks.push(actions);
  });
  check(shortcuts?.start() ?? false, 'System shortcuts must register on GNOME');
  const paths = parent.get_strv('custom-keybindings');
  const nextPath = paths.find((path) => path.endsWith('k-switch-next/'));
  const previousPath = paths.find((path) => path.endsWith('k-switch-previous/'));
  if (nextPath === undefined || previousPath === undefined) {
    throw new Error('Missing system actions');
  }
  const next = entry(nextPath);
  const previous = entry(previousPath);
  check(
    paths.includes(unrelated) && paths.length === 3,
    'Registration preserves unrelated shortcuts',
  );
  verifyLabels(next, previous);
  next.set_string('binding', '<Super>g');
  check(
    readConfiguration(settings).groupShortcut === '<Super>g',
    'System edits reach extension preferences',
  );
  writeConfiguration(settings, {
    ...readConfiguration(settings),
    previousGroupShortcut: '<Super><Alt>b',
  });
  check(
    previous.get_string('binding') === '<Super><Alt>b',
    'Preference edits reach system settings',
  );
  verifyResetAll(settings, parent, unrelated);
  next.reset('binding');
  next.reset('name');
  next.reset('command');
  parent.set_strv(
    'custom-keybindings',
    paths.filter((path) => path !== nextPath),
  );
  check(
    readConfiguration(settings).groupShortcut === '',
    'Deleting a system action disables its shortcut',
  );
  writeConfiguration(settings, { ...readConfiguration(settings), groupShortcut: '<Super>n' });
  check(
    parent.get_strv('custom-keybindings').includes(nextPath),
    'Assigning a new shortcut restores its action',
  );
  check(
    next.get_string('command').includes('NextGroup'),
    'Restoration rebuilds cleared action metadata',
  );
  next.set_string('command', 'user-owned-command');
  check(
    readConfiguration(settings).groupShortcut === '',
    'Repurposing a system action clears its group assignment',
  );
  verifyTakeover(settings, parent, next, fallbacks);
  shortcuts?.destroy();
  check(
    parent.get_strv('custom-keybindings').join(',') === [unrelated, nextPath].join(','),
    'Cleanup preserves unrelated and repurposed actions',
  );
  verifyRefused(settings, next, onError);
  check(errors.length === 0, 'System shortcut synchronization must not report errors');
}

function verifyLabels(next: Gio.Settings, previous: Gio.Settings): void {
  check(next.get_string('name') === 'K-switch: Next group', 'Next action has a readable label');
  check(previous.get_string('command').includes('PreviousGroup'), 'Previous invokes its method');
}

function verifyTakeover(
  settings: Gio.Settings,
  parent: Gio.Settings,
  next: Gio.Settings,
  fallbacks: readonly (readonly ShortcutAction[])[],
): void {
  check(
    fallbacks.length === 1 && fallbacks[0]?.map((action) => action.id).join(',') === 'next',
    'Losing ownership enables local switching exactly once for only the affected action',
  );
  check(
    parent.get_strv('custom-keybindings').some((path) => path.endsWith('k-switch-previous/')),
    'The other system action stays registered without keyboard grab handoff',
  );
  for (const groupShortcut of ['<Super>p', '<Super>o']) {
    writeConfiguration(settings, { ...readConfiguration(settings), groupShortcut });
  }
  check(
    next.get_string('command') === 'user-owned-command' &&
      next.get_string('binding') !== '<Super>o' &&
      readConfiguration(settings).groupShortcut === '<Super>o',
    'Local fallback assignments preserve the repurposed system action',
  );
}

function verifyResetAll(settings: Gio.Settings, parent: Gio.Settings, unrelated: string): void {
  const before = readConfiguration(settings);
  parent.set_strv('custom-keybindings', [unrelated]);
  const reset = readConfiguration(settings);
  check(
    reset.groupShortcut === '' && reset.previousGroupShortcut === '',
    'Removing both system actions clears both assignments without restoring either one',
  );
  check(
    parent.get_strv('custom-keybindings').join(',') === unrelated,
    'Resetting custom shortcuts must preserve the external path snapshot',
  );
  writeConfiguration(settings, before);
}

function verifyRefused(
  settings: Gio.Settings,
  next: Gio.Settings,
  onError: (error: unknown) => void,
): void {
  const refused = createSystemShortcuts(settings, onError, () => {
    throw new Error('A refused start must let its caller choose fallback');
  });
  check(
    refused !== null && !refused.start(),
    'A user-owned command at the reserved path is not overwritten',
  );
  refused?.destroy();
  check(
    next.get_string('command') === 'user-owned-command',
    'Collision preserves the existing command',
  );
}
