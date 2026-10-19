# Security

K-switch currently targets GNOME Shell 50. Use the latest published version.
Pre-releases are explicitly marked and remain subject to native user acceptance.

Report suspected vulnerabilities privately through the repository's Security
page: https://github.com/dima-fedotovs/k-switch/security/advisories/new
Do not put credentials or private keyboard configuration into public issues.

CI checks license notices, secrets, vulnerable dependencies,
CodeQL findings, Shexli extension-review rules, strict code quality and isolated GNOME behavior. No scanner
proves the absence of vulnerabilities or plagiarism. Scanner outages fail the
required hosted check rather than silently approving the source.

Shexli uses a separate hash-locked Python environment. Its JSON report must be
clean and match the final ZIP's file inventory and GNOME targets. Every finding
(including warnings and manual-review items), scanner failure and incomplete
report blocks CI and release publication. Synthetic controls exercise these
failures, and the `shexli-results` Actions artifact retains the reports.

Source provenance is a separate local maintainer check before tagging a release:
`npm run build && npm run security`. SCANOSS is never invoked by GitHub Actions.
The hosted command `npm run security:ci` records provenance as
`local-only-not-run`; hosted success does not certify the manual source review.
New local matches require review; a local scanner outage is an unfinished review.

SCANOSS receives locally generated file/snippet fingerprints and relative paths,
not raw source text. Only tracked source/code is fingerprinted; Git history,
node_modules and generated artifacts are excluded. Findings must be reviewed
against upstream code; approvals bind the source SHA256 and the specific match.
