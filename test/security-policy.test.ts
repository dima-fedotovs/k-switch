// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkLicenses,
  checkProvenance,
  checkSarif,
  matchHash,
  releaseVersion,
} from '../scripts/security-policy.js';

void test('source matches require exact file and match approval; partial or malformed reports fail', () => {
  const match = { id: 'snippet', lines: '1-9', url: 'https://example.org/code' };
  const report = { 'src/a.ts': [match] };
  const approval = [
    {
      path: 'src/a.ts',
      sourceSha256: 'filehash',
      matchSha256: matchHash(match),
      reason: 'Reviewed fixture',
    },
  ];
  checkProvenance({ 'src/a.ts': [{ id: 'none' }] }, { 'src/a.ts': 'filehash' }, []);
  checkProvenance(report, { 'src/a.ts': 'filehash' }, approval);
  for (const value of [{}, null, { 'src/a.ts': [] }, { 'src/a.ts': [{ id: 'error' }] }]) {
    assert.throws(() => {
      checkProvenance(value, { 'src/a.ts': 'filehash' }, []);
    });
  }
  assert.throws(() => {
    checkProvenance(report, { 'src/a.ts': 'changed' }, approval);
  });
  assert.throws(() => {
    checkProvenance(report, { 'src/a.ts': 'filehash' }, []);
  });
});

void test('license scanning must complete and unknown license detections require review', () => {
  const report = (license: string): unknown => ({
    headers: [{ errors: [] }],
    files: [
      {
        path: 'src/a.ts',
        scan_errors: [],
        license_detections: [{ license_expression_spdx: license }],
      },
    ],
  });
  checkLicenses(report('GPL-3.0-or-later'));
  checkLicenses(
    report('MIT'),
    [
      {
        path: 'a.ts',
        sourceSha256: 'exact',
        expression: 'MIT',
        reason: 'Fixture license metadata',
      },
    ],
    { 'src/a.ts': 'exact' },
  );
  assert.throws(() => {
    checkLicenses(
      report('MIT'),
      [{ path: 'a.ts', sourceSha256: 'exact', expression: 'MIT', reason: 'Fixture' }],
      { 'src/a.ts': 'changed' },
    );
  });
  assert.throws(() => {
    checkLicenses(report('LicenseRef-unknown'));
  });
  assert.throws(() => {
    checkLicenses({ headers: [{ errors: ['failure'] }], files: [{}] });
  });
  assert.throws(() => {
    checkLicenses({ headers: [], files: [] });
  });
});

void test('CodeQL upload success cannot mask vulnerability, diagnostic or scanner errors', () => {
  const report = (score: string, level = 'warning'): unknown => ({
    runs: [
      {
        tool: {
          driver: { rules: [{ id: 'test/rule', properties: { 'security-severity': score } }] },
        },
        invocations: [{ executionSuccessful: true }],
        results: [{ ruleId: 'test/rule', level }],
      },
    ],
  });
  checkSarif(report('3.9'));
  assert.throws(() => {
    checkSarif(report('4.0'));
  });
  assert.throws(() => {
    checkSarif(report('0', 'error'));
  });
  assert.throws(() => {
    checkSarif(report('invalid'));
  });
  assert.throws(() => {
    checkSarif({ runs: [] });
  });
  assert.throws(() => {
    checkSarif({
      runs: [{ tool: { driver: { rules: [] } }, invocations: [{ executionSuccessful: false }] }],
    });
  });
});

void test('only matching semantic release tags are accepted and development releases stay preliminary', () => {
  assert.deepEqual(releaseVersion('v0.4.0', ['0.4.0', '0.4.0', '0.4.0']), {
    version: '0.4.0',
    prerelease: true,
  });
  assert.equal(releaseVersion('v1.0.0', ['1.0.0', '1.0.0', '1.0.0']).prerelease, false);
  assert.equal(releaseVersion('v1.0.0-rc.1', Array<string>(3).fill('1.0.0-rc.1')).prerelease, true);
  for (const tag of ['main', '0.4.0', 'v01.0.0', 'v0.4.1']) {
    assert.throws(() => releaseVersion(tag, ['0.4.0', '0.4.0', '0.4.0']));
  }
});
