# Security Policy

## Supported Versions

Lyra UI follows semantic versioning. Only the latest published `major.minor` release of each
package receives security fixes.

| Package                  | Supported          |
| ------------------------ | ------------------- |
| `@aceshooting/lyra-ui`    | Latest release only |
| `@aceshooting/lyra-flags` | Latest release only |

Older versions will not receive backported patches. Please upgrade to the latest release before
reporting an issue.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately using [GitHub Private Vulnerability Reporting](https://github.com/aceshooting/lyra-ui/security/advisories/new)
(Security tab → "Report a vulnerability"). This opens a private advisory visible only to maintainers
until a fix is ready.

If you're unable to use GitHub's private reporting, email **info@aceshooting.com** instead.

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce (a minimal repro, e.g. a StackBlitz/CodeSandbox or code snippet, is ideal)
- Affected package name and version
- Any suggested mitigation, if known

## What to Expect

- **Acknowledgment** within 3 business days.
- **Initial assessment** (validity, severity, affected versions) within 7 days.
- We'll keep you updated as a fix is developed and coordinate a disclosure timeline with you.
- Once a patch is released, we'll publish a GitHub Security Advisory and credit the reporter
  (unless you prefer to remain anonymous).

## Scope

Lyra UI is a client-side web component library (Lit-based custom elements) with no server-side
runtime, database, or authentication layer of its own. In-scope concerns include:

- Cross-site scripting (XSS) via component rendering, slots, or property/attribute binding
  (e.g. unsafe `innerHTML`/`unsafeHTML` usage, insufficient sanitization of user-supplied content)
- Server-side request forgery (SSRF) via a consumer-supplied `src`/URL fetched by a document
  viewer or `<lr-map>` — e.g. a scheme/host that bypasses the library's `safeFetchUrl()` gate
- Prototype pollution or supply-chain issues in published npm artifacts
- ReDoS or other resource-exhaustion bugs in bundled utilities (e.g. localization, validation)
- Build/publish pipeline compromise (npm package tampering, dependency confusion)

Out of scope: vulnerabilities requiring physical access, social engineering, issues only
reproducible in unsupported/end-of-life versions, and vulnerabilities in third-party dependencies
that should be reported upstream (though we appreciate a heads-up so we can update).

## Disclosure Policy

We ask for a **90-day coordinated disclosure window** (or sooner once a fix ships) before public
details are shared, to give downstream consumers time to upgrade.
