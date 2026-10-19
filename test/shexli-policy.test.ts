// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkShexli } from '../scripts/shexli-policy.js';

const input = 'extension.zip';
const inventory = { fileCount: 3, jsFileCount: 1, targetVersions: [50] };
function clean(): {
  spec_version: string;
  summary: Record<string, unknown>;
  findings: unknown[];
  artifacts: Record<string, unknown>;
} {
  return {
    spec_version: '2026-04-02',
    summary: { input_path: input, finding_count: 0, severity_counts: {}, status: 'clean' },
    findings: [],
    artifacts: {
      root: input,
      metadata_path: `${input}:metadata.json`,
      file_count: 3,
      js_file_count: 1,
      target_versions: [50],
    },
  };
}

void test('Shexli accepts a complete clean report for the exact ZIP inventory', () => {
  assert.doesNotThrow(() => {
    checkShexli(clean(), input, inventory);
  });
});

void test('Shexli rejects every finding severity even when the scanner exits successfully', () => {
  for (const severity of ['error', 'warning', 'manual_review', 'unknown']) {
    const report = clean();
    report.findings = [{ rule_id: 'fixture', severity, message: 'controlled finding' }];
    report.summary = {
      input_path: input,
      finding_count: 1,
      severity_counts: { [severity]: 1 },
      status: 'issues_found',
    };
    assert.throws(() => {
      checkShexli(report, input, inventory);
    }, /Blocking Shexli findings/);
  }
});

void test('Shexli rejects malformed, partial, contradictory and unrelated reports', () => {
  for (const report of [
    null,
    [],
    {},
    { ...clean(), findings: null },
    { ...clean(), artifacts: {} },
  ]) {
    assert.throws(() => {
      checkShexli(report, input, inventory);
    });
  }
  const unknown = clean();
  unknown.spec_version = 'unknown';
  assert.throws(() => {
    checkShexli(unknown, input, inventory);
  }, /specification/);
  for (const update of [
    { input_path: 'other.zip' },
    { finding_count: 1 },
    { finding_count: undefined },
    { status: 'issues_found' },
    { severity_counts: { error: 1 } },
    { severity_counts: undefined },
    { severity_counts: { warning: '0' } },
  ]) {
    const report = clean();
    Object.assign(report.summary, update);
    assert.throws(() => {
      checkShexli(report, input, inventory);
    });
  }
  for (const update of [
    { root: 'other.zip' },
    { metadata_path: 'other.zip:metadata.json' },
    { file_count: 2 },
    { js_file_count: 0 },
    { target_versions: [49] },
    { target_versions: undefined },
  ]) {
    const report = clean();
    Object.assign(report.artifacts, update);
    assert.throws(() => {
      checkShexli(report, input, inventory);
    });
  }
  assert.throws(() => {
    checkShexli(clean(), input, { ...inventory, fileCount: 0 });
  });
  assert.throws(() => {
    checkShexli(clean(), input, { ...inventory, jsFileCount: 0 });
  });
});
