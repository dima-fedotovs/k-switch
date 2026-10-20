// SPDX-License-Identifier: GPL-3.0-or-later
import { MessageError, N_ } from './messages.js';
import { getShortcut, parseConfiguration, type Configuration } from './config.js';
import { type GroupConfiguration, type GroupEntry, type LayoutGroup } from './groups.js';
import { restoreGroupNames, validateGroupNames } from './group-names.js';

function record(value: unknown, fields: string): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== fields
  ) {
    throw new MessageError('Expected an object containing exactly: %s', fields);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    Array.from(value).some((character) => character < ' ')
  ) {
    throw new MessageError('Expected nonempty text without control characters.');
  }
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new MessageError('Expected a boolean.');
  }
  return value;
}

function unique<T>(values: readonly T[], key: (value: T) => string): readonly T[] {
  if (new Set(values.map(key)).size !== values.length) {
    throw new MessageError('Duplicate identifiers are not allowed.');
  }
  return values;
}

function list<T>(value: unknown, parse: (item: unknown) => T): readonly T[] {
  if (!Array.isArray(value)) {
    throw new MessageError('Expected a list.');
  }
  return (value as unknown[]).map(parse);
}

function entry(value: unknown): GroupEntry {
  const item = record(value, 'enabled,source');
  const source = text(item.source);
  if (!/^(xkb|ibus):.+$/u.test(source)) {
    throw new MessageError('Expected a GNOME input source identifier.');
  }
  return { source, enabled: boolean(item.enabled) };
}

function group(value: unknown, legacy: boolean): LayoutGroup {
  const item = record(value, legacy ? 'entries,id,name,skip' : 'entries,id,longName,name,skip');
  const id = text(item.id);
  if (id === 'all') {
    throw new MessageError('The system group cannot be overridden.');
  }
  return {
    id,
    name: text(item.name).trim(),
    longName: legacy ? '' : optionalText(item.longName),
    skip: boolean(item.skip),
    entries: unique(list(item.entries, entry), (value) => value.source),
  };
}

export function migrate(
  configuration: Configuration,
  primaryName = N_('Primary'),
): GroupConfiguration {
  return initialConfiguration(
    [configuration.firstSource, configuration.secondSource],
    configuration.shortcut,
    primaryName,
  );
}

export function initialConfiguration(
  sources: readonly string[],
  shortcut: string,
  primaryName = N_('Primary'),
): GroupConfiguration {
  return {
    version: 5,
    shortcut,
    groupShortcut: '',
    previousGroupShortcut: '',
    showSource: false,
    showIcon: false,
    showGroup: true,
    groups: [
      {
        id: 'primary',
        name: primaryName,
        longName: '',
        skip: false,
        entries: [...new Set(sources)].map((source, index) => ({
          source,
          enabled: index < 2,
        })),
      },
    ],
  };
}

function optionalText(value: unknown): string {
  return value === '' ? '' : text(value).trim();
}

function shortcutText(value: unknown): string {
  if (typeof value !== 'string') {
    throw new MessageError('Expected a shortcut string.');
  }
  return value;
}

function parseGroups(value: unknown, legacy: boolean): readonly LayoutGroup[] {
  return unique(
    list(value, (item) => group(item, legacy)),
    (item) => item.id,
  );
}

function versionedRecord(value: unknown): {
  version: 2 | 3 | 4 | 5;
  item: Record<string, unknown>;
} {
  const version =
    typeof value === 'object' && value !== null && 'version' in value ? value.version : null;
  if (version !== 2 && version !== 3 && version !== 4 && version !== 5) {
    throw new MessageError('Unsupported configuration version.');
  }
  const fields = {
    2: 'allSkip,groupShortcut,groups,shortcut,showIndicator,version',
    3: 'groupShortcut,groups,previousGroupShortcut,shortcut,showIndicator,showSource,version',
    4: 'groupShortcut,groups,previousGroupShortcut,shortcut,showGroup,showIndicator,showSource,version',
    5: 'groupShortcut,groups,previousGroupShortcut,shortcut,showGroup,showIcon,showSource,version',
  };
  return { version, item: record(value, fields[version]) };
}

function displayOptions(
  item: Record<string, unknown>,
  version: 2 | 3 | 4 | 5,
): Pick<GroupConfiguration, 'showIcon' | 'showGroup' | 'showSource'> {
  if (version === 5) {
    return {
      showIcon: boolean(item.showIcon),
      showGroup: boolean(item.showGroup),
      showSource: boolean(item.showSource),
    };
  }
  const visible = boolean(item.showIndicator);
  const group = version === 4 ? boolean(item.showGroup) : true;
  const source = version === 2 ? false : boolean(item.showSource);
  return {
    showIcon: visible && !group && !source,
    showGroup: visible && group,
    showSource: visible && source,
  };
}

function parseVersion(value: unknown): GroupConfiguration {
  const { version, item } = versionedRecord(value);
  const legacy = version === 2;
  const shortcut = text(item.shortcut);
  getShortcut(shortcut);
  if (legacy) {
    boolean(item.allSkip);
  }
  return {
    version: 5,
    groups: parseGroups(item.groups, legacy),
    shortcut,
    groupShortcut: shortcutText(item.groupShortcut),
    previousGroupShortcut: legacy ? '' : shortcutText(item.previousGroupShortcut),
    ...displayOptions(item, version),
  };
}

function parse(json: string, restoreNames: boolean, primaryName: string): GroupConfiguration {
  const value: unknown = JSON.parse(json);
  const configuration =
    typeof value === 'object' && value !== null && 'version' in value && value.version === 1
      ? migrate(parseConfiguration(json), primaryName)
      : parseVersion(value);
  const groups = restoreNames ? restoreGroupNames(configuration.groups) : configuration.groups;
  validateGroupNames(groups);
  return { ...configuration, groups };
}

export function parseGroupConfiguration(
  json: string,
  primaryName = N_('Primary'),
): GroupConfiguration {
  return parse(json, false, primaryName);
}

export function parseStoredGroupConfiguration(
  json: string,
  primaryName = N_('Primary'),
): GroupConfiguration {
  return parse(json, true, primaryName);
}
