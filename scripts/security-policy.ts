// SPDX-License-Identifier: GPL-3.0-or-later
import { createHash } from 'node:crypto';

export function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected a report object.');
  }
  return value as Record<string, unknown>;
}

export function list(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected a report list.');
  }
  return value as unknown[];
}

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function matchHash(value: unknown): string {
  const match = object(value);
  return sha256(
    JSON.stringify(
      ['id', 'file', 'file_hash', 'lines', 'oss_lines', 'purl', 'url', 'matched'].map((key) => [
        key,
        match[key],
      ]),
    ),
  );
}

export function localProvenance(args: readonly string[], hosted: boolean): boolean {
  if (args.length === 1 && args[0] === '--ci') {
    return false;
  }
  if (args.length > 0) {
    throw new Error('Expected no arguments for local scanning or --ci for hosted checks.');
  }
  if (hosted) {
    throw new Error('SCANOSS is local-only; GitHub Actions must use security:ci.');
  }
  return true;
}

export function checkProvenance(
  report: unknown,
  files: Readonly<Record<string, string>>,
  approvals: unknown,
): void {
  const results = object(report);
  const approved = list(approvals).map(object);
  if (
    Object.keys(files).length === 0 ||
    Object.keys(files).sort().join('\n') !== Object.keys(results).sort().join('\n')
  ) {
    throw new Error('SCANOSS report is empty or incomplete.');
  }
  for (const [path, digest] of Object.entries(files)) {
    const matches = list(results[path]);
    if (matches.length === 0) {
      throw new Error(`Missing scan results for ${path}`);
    }
    for (const value of matches) {
      const match = object(value);
      if (match.id === 'none') {
        continue;
      }
      if (
        !['file', 'snippet'].includes(String(match.id)) ||
        !approved.some(
          (entry) =>
            entry.path === path &&
            entry.sourceSha256 === digest &&
            entry.matchSha256 === matchHash(match) &&
            typeof entry.reason === 'string' &&
            entry.reason.length > 0,
        )
      ) {
        throw new Error(`Unreviewed source match: ${path}`);
      }
    }
  }
}

export function checkLicenses(
  report: unknown,
  approvals: unknown = [],
  hashes: Readonly<Record<string, string>> = {},
): void {
  const data = object(report);
  const headers = list(data.headers);
  const files = list(data.files);
  if (headers.length === 0 || files.length === 0) {
    throw new Error('ScanCode report is empty.');
  }
  for (const entry of [...headers, ...files]) {
    const row = object(entry);
    const errors = row.errors ?? row.scan_errors;
    if (errors !== undefined && list(errors).length > 0) {
      throw new Error('ScanCode reported scanning errors.');
    }
  }
  for (const entry of files) {
    checkFileLicenses(object(entry), list(approvals).map(object), hashes);
  }
}

export function checkScanCodeInventory(report: unknown, expected: readonly string[]): void {
  const data = object(report);
  const headers = list(data.headers).map(object);
  if (
    expected.length === 0 ||
    headers.length !== 1 ||
    headers[0]?.tool_name !== 'scancode-toolkit'
  ) {
    throw new Error('ScanCode requires a complete report for a nonempty input.');
  }
  const header = object(headers[0]);
  if (list(header.errors).length > 0 || list(header.warnings).length > 0) {
    throw new Error('ScanCode reported incomplete analysis or diagnostics.');
  }
  const scanned = list(data.files)
    .map(object)
    .flatMap((file) => {
      if (file.type === 'directory') {
        return [];
      }
      if (file.type !== 'file' || typeof file.path !== 'string') {
        throw new Error('ScanCode returned an invalid file record.');
      }
      list(file.scan_errors);
      list(file.license_detections);
      return [file.path];
    });
  const actual = scanned.sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((path, index) => path !== wanted[index])) {
    throw new Error('ScanCode file inventory is incomplete or inconsistent.');
  }
}

function checkFileLicenses(
  file: Record<string, unknown>,
  approvals: readonly Record<string, unknown>[],
  hashes: Readonly<Record<string, string>>,
): void {
  const raw = String(file.path);
  const path = raw.includes('/') ? raw.slice(raw.indexOf('/') + 1) : raw;
  // This declarative policy contains license names as data, not imported code.
  if (path === 'security/licenses.json') {
    return;
  }
  for (const detection of list(file.license_detections ?? [])) {
    const license = object(detection).license_expression_spdx;
    if (
      license !== 'GPL-3.0-or-later' &&
      !(String(file.path).endsWith('/LICENSE') && license === 'GPL-3.0-only') &&
      !approvals.some(
        (entry) =>
          entry.path === path &&
          entry.sourceSha256 === hashes[String(file.path)] &&
          entry.expression === license &&
          typeof entry.reason === 'string' &&
          entry.reason.length > 0,
      )
    ) {
      throw new Error(`Review license ${String(license)} in ${String(file.path)}`);
    }
  }
}

export function checkSarif(value: unknown): void {
  const runs = list(object(value).runs);
  if (runs.length === 0) {
    throw new Error('CodeQL returned no analysis runs.');
  }
  for (const entry of runs) {
    checkRun(object(entry));
  }
}

function checkRun(run: Record<string, unknown>): void {
  const tool = object(run.tool);
  const components = [object(tool.driver), ...list(tool.extensions ?? []).map(object)];
  for (const invocation of list(run.invocations ?? [])) {
    checkInvocation(object(invocation));
  }
  for (const entry of list(run.results ?? [])) {
    checkResult(object(entry), components);
  }
}

function checkInvocation(invocation: Record<string, unknown>): void {
  const notifications = [
    ...list(invocation.toolExecutionNotifications ?? []),
    ...list(invocation.toolConfigurationNotifications ?? []),
  ];
  if (
    invocation.executionSuccessful === false ||
    notifications.some((value) => object(value).level === 'error')
  ) {
    throw new Error('CodeQL analysis did not complete.');
  }
}

function checkResult(
  result: Record<string, unknown>,
  components: readonly Record<string, unknown>[],
): void {
  const rule = resolveRule(result, components);
  const score = Number(object(rule.properties ?? {})['security-severity'] ?? 0);
  const level = result.level ?? object(rule.defaultConfiguration ?? {}).level;
  if (!Number.isFinite(score) || score >= 4 || level === 'error') {
    throw new Error(`Blocking CodeQL result: ${String(rule.id)}`);
  }
}

function resolveRule(
  result: Record<string, unknown>,
  components: readonly Record<string, unknown>[],
): Record<string, unknown> {
  const reference = object(result.rule ?? {});
  const componentReference = object(reference.toolComponent ?? {});
  const componentIndex = componentReference.index;
  if (
    componentIndex !== undefined &&
    (!Number.isInteger(componentIndex) || Number(componentIndex) < 0)
  ) {
    throw new Error('Invalid SARIF tool component index.');
  }
  const selected =
    componentIndex === undefined
      ? components
      : components.slice(Number(componentIndex) + 1, Number(componentIndex) + 2);
  const id = result.ruleId ?? reference.id;
  const rules = selected.flatMap((component) => list(component.rules ?? []).map(object));
  const matches = rules.filter((rule) => rule.id === id);
  if (typeof id !== 'string' || matches.length !== 1) {
    throw new Error(`CodeQL result references an unknown or ambiguous rule: ${String(id)}`);
  }
  return object(matches[0]);
}

export function releaseVersion(
  tag: string,
  versions: readonly string[],
): { version: string; prerelease: boolean } {
  const match = /^v((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?)$/u.exec(tag);
  const version = match?.[1];
  if (version === undefined || versions.length !== 3 || versions.some((item) => item !== version)) {
    throw new Error('Release tag must match all three project versions.');
  }
  return { version, prerelease: version.startsWith('0.') || version.includes('-') };
}
