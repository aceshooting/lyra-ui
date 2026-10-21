# RFC 0004: Adopt a code of conduct

- **Status:** Accepted
- **Authors:** @aceshooting
- **Created:** 2026-10-21
- **Decision:** Approved by @aceshooting on 2026-10-21
- **Supersedes / superseded by:** None

## Summary

Adopt the accompanying concise code of conduct and link it from CONTRIBUTING.md. The private
reporting contact is [info@aceshooting.com](mailto:info@aceshooting.com). Reports may request
review by an uninvolved maintainer when a conflict of interest arises.

## Motivation

Participants need clear expectations and a private way to report harmful conduct. The project needs an explicit conduct policy.

## Goals and non-goals

Set participation expectations, scope, reporting and proportionate enforcement. Do not add
contribution sign-offs, review gates, account permissions, release authority or technical rules.

## Proposed public contract

Publish CODE_OF_CONDUCT.md and its contributor-guide link. No component or package API changes.
The proposed text is original project prose and does not claim adoption of a third-party template.

## Composition and interaction

Not applicable to component behavior. Reporting is private; enforcement options range from content
removal and warnings to participation restrictions.

## Accessibility, localization, and RTL

Use readable Markdown and plain language. No UI, ARIA, keyboard, forms, locale or RTL changes.
Reports use the designated email contact.

## Platform, security, and packaging

No runtime, dependencies, support-window or packaging changes. The conduct reporting contact does
not replace the private vulnerability-reporting route in SECURITY.md. Publish no report contents,
credentials or personal contact details without authorization.

## Compatibility and migration

No API or semver change. Existing contributors receive the published expectations through the
contributor guide. Existing development and release gates remain unchanged.

## Alternatives considered

Leave expectations implicit: provides no clear reporting route. Adopt a longer standard template:
possible, but this proposal keeps the project's commitments concise and explicit.

## Test, documentation, and rollout plan

The owner approved the policy and reporting contact on 2026-10-21. Merge this accepted RFC before
publishing CODE_OF_CONDUCT.md and its contributor-guide link. Verify relative links and run the
existing documentation generation and checks. Record implementation here after publication.
No new development gate or repository permission is introduced.

## Unresolved questions

None. Reports may request review by an uninvolved maintainer; no separate reporting contact is
designated.
