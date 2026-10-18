# Security

K-switch currently targets GNOME Shell 50. Use the latest published version.
Pre-releases are explicitly marked and remain subject to native user acceptance.

Report suspected vulnerabilities privately through the repository's Security
page: https://github.com/dima-fedotovs/k-switch/security/advisories/new
Do not put credentials or private keyboard configuration into public issues.

CI checks source provenance, license notices, secrets, vulnerable dependencies,
CodeQL findings, strict code quality and isolated GNOME behavior. No scanner
proves the absence of vulnerabilities or plagiarism. Scanner outages fail the
required check rather than silently approving the source.

SCANOSS receives locally generated file/snippet fingerprints and relative paths,
not raw source text. Only tracked source/code is fingerprinted; Git history,
node_modules and generated artifacts are excluded. Findings must be reviewed
against upstream code; approvals bind the source SHA256 and the specific match.
