// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import {
  initialConfiguration,
  migrate,
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
    return parseStoredGroupConfiguration(stored);
  }
  if (
    settings.get_user_value('first-source') === null &&
    settings.get_user_value('second-source') === null
  ) {
    const desktop = new Gio.Settings({
      schema_id: 'org.gnome.desktop.input-sources',
      backend: settings.backend,
    });
    return initialConfiguration(configuredSources(desktop), settings.get_string('shortcut'));
  }
  return migrate({
    version: 1,
    firstSource: settings.get_string('first-source'),
    secondSource: settings.get_string('second-source'),
    shortcut: settings.get_string('shortcut'),
  });
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
    throw new Error('Cannot write locked group preferences.');
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
