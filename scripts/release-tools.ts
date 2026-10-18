// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { VERSION, UUID } from '../src/shared/release.js';
import { object, releaseVersion, sha256, list } from './security-policy.js';
import { verifyReleaseRef } from './release-ref.js';

function json(path: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return object(value);
}

function verifyTag(): void {
  if (process.env.GITHUB_REF_TYPE !== 'tag') {
    throw new Error('Releases require a version tag.');
  }
  verifyReleaseRef(process.env.GITHUB_REF_NAME ?? '', process.env.GITHUB_SHA ?? '');
}

if (process.argv[2] === 'validate') {
  const tag = process.env.GITHUB_REF_NAME ?? '';
  const result = releaseVersion(tag, [
    String(json('package.json').version),
    String(json('metadata.json')['version-name']),
    VERSION,
  ]);
  verifyTag();
  const output = process.env.GITHUB_OUTPUT;
  if (output === undefined) {
    throw new Error('Missing workflow output destination.');
  }
  appendFileSync(output, `version=${result.version}\nprerelease=${String(result.prerelease)}\n`);
} else if (process.argv[2] === 'verify-tag') {
  verifyTag();
} else if (process.argv[2] === 'assets') {
  const bom = object(
    JSON.parse(
      execFileSync('npm', ['sbom', '--sbom-format', 'cyclonedx', '--package-lock-only'], {
        encoding: 'utf8',
      }),
    ) as unknown,
  );
  for (const entry of list(bom.components)) {
    const component = object(entry);
    if (list(component.licenses).length === 0) {
      throw new Error(`Missing dependency license: ${String(component.name)}`);
    }
    component.scope = 'optional';
    component.properties = [
      ...list(component.properties ?? []),
      {
        name: 'k-switch:dependency-purpose',
        value: 'build/development; not bundled in the extension ZIP',
      },
    ];
  }
  const sbom = `k-switch-${VERSION}.cdx.json`;
  writeFileSync(`artifacts/${sbom}`, JSON.stringify(bom, null, 2) + '\n');
  const names = [`${UUID}.shell-extension.zip`, sbom];
  writeFileSync(
    'artifacts/SHA256SUMS',
    names.map((name) => `${sha256(readFileSync(`artifacts/${name}`))}  ${name}\n`).join(''),
  );
} else {
  throw new Error('Choose validate, verify-tag or assets.');
}
