// SPDX-License-Identifier: GPL-3.0-or-later
import { MessageError } from '../core/messages.js';
import { _ } from './i18n.js';
import Gio from 'gi://Gio';
import {
  initialConfiguration,
  parseGroupConfiguration,
  parseStoredGroupConfiguration,
} from '../core/group-config.js';
import { decodeSources } from '../core/config.js';
import { reconcile, type GroupConfiguration } from '../core/groups.js';

export function configuredSources(desktop: Gio.Settings): string[] {
  return decodeSources(desktop.get_value('sources').deepUnpack());
}

export function readConfiguration(settings: Gio.Settings): GroupConfiguration {
  const stored = settings.get_string('configuration');
  if (stored !== '') {
    return parseStoredGroupConfiguration(stored, _('Primary'));
  }
  const legacy = ['first-source', 'second-source'].flatMap((key) => {
    const source = settings.get_user_value(key)?.get_string()[0] ?? '';
    return source === '' ? [] : [source];
  });
  const desktop = new Gio.Settings({
    schema_id: 'org.gnome.desktop.input-sources',
    backend: settings.backend,
  });
  return initialConfiguration(
    legacy.length > 0 ? legacy : configuredSources(desktop),
    settings.get_string('shortcut'),
    // Translators: Default group name, created once; unrelated to keyboard languages.
    _('Primary'),
  );
}

export function writeConfiguration(
  settings: Gio.Settings,
  configuration: GroupConfiguration,
): void {
  const validated = parseGroupConfiguration(JSON.stringify(configuration));
  const transaction = new Gio.Settings({
    settings_schema: settings.settings_schema,
    path: settings.path,
    backend: settings.backend,
  });
  transaction.delay();
  const written = transaction.set_string('configuration', JSON.stringify(validated));
  const bound = transaction.set_strv(
    'k-switch-next-group',
    validated.groupShortcut === '' ? [] : [validated.groupShortcut],
  );
  const previous = transaction.set_strv(
    'k-switch-previous-group',
    validated.previousGroupShortcut === '' ? [] : [validated.previousGroupShortcut],
  );
  if (!written || !bound || !previous) {
    transaction.revert();
    throw new MessageError('Cannot write locked group preferences.');
  }
  transaction.apply();
}

export function synchronize(settings: Gio.Settings, desktop: Gio.Settings): GroupConfiguration {
  const configuration = reconcile(readConfiguration(settings), configuredSources(desktop));
  if (JSON.stringify(configuration) !== settings.get_string('configuration')) {
    writeConfiguration(settings, configuration);
  }
  return configuration;
}
