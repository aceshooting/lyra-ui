# Support

Lyra UI is a community-maintained open-source project. Support is best effort; normal questions and
issues have no guaranteed response time. Security reports follow the separate response targets in
[`SECURITY.md`](SECURITY.md).

## Before opening an issue

1. Confirm the problem occurs on the latest release of the affected package. Only the latest
   published `major.minor` line receives fixes.
2. Check the live component docs and the package README for the component's current public contract.
3. Check [`docs/support-policy.md`](docs/support-policy.md) for browser, Node, and assistive-
   technology scope. A supported platform is not necessarily exercised by every CI job.
4. Reduce the problem to the smallest runnable example and remove credentials, private data, and
   proprietary code.

## Where to ask

The routes below are for people filing reports themselves. An assistant or other automation acting
on a user's behalf must instead use the feature-request API described in the packaged Lyra skill,
show the exact report first, and obtain the user's explicit agreement before sending it. That API
is the only supported automated intake path; agents must not open GitHub issues silently.

- **Reproducible defect:** use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and
  include the Lyra version, affected tag or export, browser/OS, expected behavior, actual behavior,
  and a minimal reproduction.
- **New capability or public API change:** use the
  [feature request template](.github/ISSUE_TEMPLATE/feature_request.md). Cross-cutting or breaking
  proposals may be directed to the [RFC process](docs/rfcs/process.md) before implementation.
- **Migration problem:** include the original `wa-*` or `sl-*` surface, the migration report, and
  whether the issue reproduces after following any emitted manual-action warning.
- **Security vulnerability:** do not open a public issue. Follow
  [`SECURITY.md`](SECURITY.md) for private reporting.
- **Contribution or local-build question:** start with [`CONTRIBUTING.md`](CONTRIBUTING.md) and the
  contributor contract in [`AGENTS.md`](AGENTS.md), then open a focused issue if the documented
  commands still fail.

General application architecture, framework support unrelated to Lyra's custom-element contract,
and debugging of unsupported browser versions may be closed or redirected so maintainers can focus
on the library itself.

## What a supported fix includes

A fix is complete when its behavior is covered at the appropriate layer and its public contract is
synchronized across source, tests, authored documentation, migration guidance, and generated
artifacts. Accessibility reports are treated as defects when they affect the documented contract,
including keyboard, naming, focus, form, RTL, reduced-motion, or forced-colors behavior.

Maintainers may ask for a reproduction or additional environment details before triage. Lack of an
immediate response does not change the published support window or security policy.
