// SPDX-License-Identifier: GPL-3.0-or-later
import { list, object } from './security-policy.js';

export interface ShexliInventory {
  readonly fileCount: number;
  readonly jsFileCount: number;
  readonly targetVersions: readonly number[];
}

export function checkShexli(value: unknown, input: string, inventory: ShexliInventory): void {
  const report = object(value);
  const summary = object(report.summary);
  const findings = list(report.findings);
  if (report.spec_version !== '2026-04-02') {
    throw new Error('Unsupported Shexli report specification.');
  }
  if (summary.input_path !== input || summary.finding_count !== findings.length) {
    throw new Error('Shexli summary is incomplete or inconsistent.');
  }
  if (findings.length > 0) {
    const details = findings.map((finding) => {
      const entry = object(finding);
      return `${String(entry.rule_id)}: ${String(entry.message)}`;
    });
    throw new Error(`Blocking Shexli findings: ${details.join('; ')}`);
  }
  if (
    summary.status !== 'clean' ||
    Object.values(object(summary.severity_counts)).some((count) => count !== 0)
  ) {
    throw new Error('Shexli did not report a clean analysis.');
  }
  checkInventory(object(report.artifacts), input, inventory);
}

function checkInventory(
  artifacts: Record<string, unknown>,
  input: string,
  inventory: ShexliInventory,
): void {
  if (inventory.fileCount < 2 || inventory.jsFileCount < 1) {
    throw new Error('Shexli requires an extension ZIP with JavaScript and metadata.');
  }
  if (artifacts.root !== input || artifacts.metadata_path !== `${input}:metadata.json`) {
    throw new Error('Shexli analyzed a different package.');
  }
  if (
    artifacts.file_count !== inventory.fileCount ||
    artifacts.js_file_count !== inventory.jsFileCount
  ) {
    throw new Error('Shexli file inventory is incomplete.');
  }
  if (
    JSON.stringify(list(artifacts.target_versions)) !== JSON.stringify(inventory.targetVersions)
  ) {
    throw new Error('Shexli target versions do not match the ZIP metadata.');
  }
}
