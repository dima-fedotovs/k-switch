// SPDX-License-Identifier: GPL-3.0-or-later
export interface GroupEntry {
  readonly source: string;
  readonly enabled: boolean;
}

export interface LayoutGroup {
  readonly id: string;
  readonly name: string;
  readonly longName: string;
  readonly skip: boolean;
  readonly entries: readonly GroupEntry[];
}

export interface GroupConfiguration {
  readonly version: 5;
  readonly groups: readonly LayoutGroup[];
  readonly shortcut: string;
  readonly groupShortcut: string;
  readonly previousGroupShortcut: string;
  readonly showIcon: boolean;
  readonly showGroup: boolean;
  readonly showSource: boolean;
}

export interface Selection {
  readonly group: string;
  readonly source: string | null;
}

export function reconcile(
  configuration: GroupConfiguration,
  sources: readonly string[],
): GroupConfiguration {
  return {
    ...configuration,
    groups: configuration.groups.map((group) => ({
      ...group,
      entries: [
        ...group.entries.filter((entry) => sources.includes(entry.source)),
        ...sources
          .filter((source) => !group.entries.some((entry) => entry.source === source))
          .map((source) => ({ source, enabled: false })),
      ],
    })),
  };
}

export function members(group: LayoutGroup, available: readonly string[]): readonly string[] {
  return group.entries
    .filter((entry) => entry.enabled && available.includes(entry.source))
    .map((entry) => entry.source);
}

export function validGroup(
  groups: readonly LayoutGroup[],
  active: string,
  available: readonly string[],
): string {
  const usable = groups.filter((group) => members(group, available).length > 0);
  return usable.find((group) => group.id === active)?.id ?? usable[0]?.id ?? '';
}

export function withinGroup(
  groups: readonly LayoutGroup[],
  state: Selection,
  available: readonly string[],
): Selection {
  const group = groups.find((item) => item.id === state.group);
  if (group === undefined) {
    return state;
  }
  const sources = members(group, available);
  const index = state.source === null ? -1 : sources.indexOf(state.source);
  return { group: state.group, source: sources[index + 1] ?? sources[0] ?? null };
}

function following(
  groups: readonly LayoutGroup[],
  active: string,
  direction: 1 | -1,
): readonly LayoutGroup[] {
  const ordered = direction === 1 ? groups : [...groups].reverse();
  const index = ordered.findIndex((group) => group.id === active);
  return [...ordered.slice(index + 1), ...ordered.slice(0, index + 1)];
}

export function rotateGroup(
  groups: readonly LayoutGroup[],
  state: Selection,
  available: readonly string[],
  direction: 1 | -1,
): Selection {
  for (const group of following(groups, state.group, direction)) {
    const source = members(group, available).find((id) => id !== state.source);
    if (group.id !== state.group && !group.skip && source !== undefined) {
      return { group: group.id, source };
    }
  }
  return state;
}

export function externalGroup(
  groups: readonly LayoutGroup[],
  state: Selection,
  available: readonly string[],
): string {
  const current = groups.find((group) => group.id === state.group);
  const contains = (group: LayoutGroup): boolean =>
    state.source !== null && members(group, available).includes(state.source);
  if (current !== undefined && contains(current)) {
    return current.id;
  }
  return following(groups, state.group, 1).find(contains)?.id ?? state.group;
}

export function chooseGroup(
  group: LayoutGroup,
  current: string | null,
  available: readonly string[],
): Selection {
  const sources = members(group, available);
  return { group: group.id, source: sources.find((id) => id !== current) ?? sources[0] ?? null };
}

export function groupMenuName(group: LayoutGroup): string {
  return group.longName === '' ? group.name : group.longName;
}

export function indicatorText(
  group: LayoutGroup | undefined,
  source: string,
  showGroup: boolean,
  showSource: boolean,
): string {
  const labels = [];
  if (showGroup) {
    labels.push(group?.name ?? '—');
  }
  if (showSource) {
    labels.push(source);
  }
  return labels.join(' · ');
}
