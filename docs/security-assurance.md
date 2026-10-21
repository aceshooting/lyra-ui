# Security requirements and assurance

Lyra UI provides browser-based web components. Its security controls reduce risks when components
render application data and load supported resources. They do not replace the application's
security policy, authentication, authorization, or deployment controls. Report suspected defects
through [the security policy](../SECURITY.md).

## Threat model and boundaries

An attacker may control displayed text, a document or media resource, a URL supplied to a component,
or the timing and contents of a network response. Relevant threats include script execution through
rendered markup, unsafe navigation, resource exhaustion during parsing, stale asynchronous results,
and compromised dependencies or release artifacts.

The application and its JavaScript execute with the application's origin privileges. Component
properties, event handlers, custom renderers and slotted DOM are application integration surfaces;
Shadow DOM is an encapsulation mechanism, not a security sandbox. The application must authorize
operations before performing them. A disabled button or confirmation component is not an access
control boundary.

The browser enforces origin isolation, CORS and HTTPS certificate verification. Lyra UI's URL
helpers restrict schemes for particular sinks; they are not a destination-host allowlist or a
network firewall. HTTP resources are accepted when configured by an application, so applications
requiring encrypted transport must supply HTTPS URLs and enforce suitable deployment policies.
Do not treat these browser-oriented helpers as a complete server-side request-forgery defense.

Optional rendering/parser packages are executable dependencies running with application privileges.
Loading a document does not make those dependencies trusted. Keep installed dependencies current
and apply the host application's resource and content policies.

## Requirements, controls and evidence

Source links below identify implemented helpers and checks. Links to contributor guidance state
requirements for new or changed components; they do not establish that every caller has been audited.

| Requirement | Design argument and evidence |
| --- | --- |
| Render ordinary text without interpreting it as executable markup. | Lit text bindings provide the ordinary rendering path. For fetched markup reaching `unsafeHTML()` or `unsafeSVG()`, the [remote-content rules](agents/peers-and-remote-content.md) require sanitization and a visible fallback if the sanitizer cannot load. |
| Reject executable schemes in supported URL inputs. | [Sink-specific URL allowlists](../packages/lyra-ui/src/internal/safe-url.ts) distinguish media/fetch, link, download and active-document navigation. [Tests](../packages/lyra-ui/src/internal/safe-url.test.ts) cover rejected schemes and parser normalization. |
| Bound remotely supplied data before expensive parsing. | The shared [response readers](../packages/lyra-ui/src/internal/resource-loader.ts) cap bytes; the [remote-content rules](agents/peers-and-remote-content.md) require their use for consumer-supplied `src`. Viewer-specific entry/row limits address expansion beyond input bytes. These controls reduce resource exhaustion; they do not promise constant memory or execution time for every supported format. |
| Prevent an obsolete load from replacing newer component state. | The [remote-content contract](agents/peers-and-remote-content.md) requires generation-token checks after asynchronous work. |
| Prevent links from granting an opener relationship to a new target. | [Guarded link relations](../packages/lyra-ui/src/internal/link-rel.ts) merge author tokens while removing `opener` and enforcing the target-dependent protection. |
| Detect dependency and artifact changes before publication. | [CI](../.github/workflows/ci.yml) runs dependency-security checks. The [release procedure](agents/ci-and-gates.md#release-integrity) requires exact-commit CI and browser qualification and compares rebuilt tarball bytes before protected publication; the publish workflow then attests those bytes. |

These controls apply defense in depth: typed APIs and validation constrain input, sanitization
constrains rendered markup, browser isolation constrains network/document privileges, and CI checks
source and artifact contracts. Automated tests and static analysis provide evidence about checked
behaviors, not a proof that every possible input is safe. The [contributor rules](../CONTRIBUTING.md)
require tests and documentation alongside changes to public behavior. Security fixes and supported
versions follow [SECURITY.md](../SECURITY.md).

## Application responsibilities and limits

Applications must select trusted executable dependencies, authorize backend operations, protect
credentials, enforce their own URL/destination restrictions, and configure hosting controls such
as HTTPS and Content Security Policy. Do not place secrets in displayed data or assume a component
can protect secrets from other scripts running in the same origin. Treat files and remote resources
as untrusted even when their extension or media type appears supported. Review custom renderers
and any caller-supplied DOM under the application's own security requirements.

This document describes the implementation's security argument and its limits. It is not a claim
that an independent security audit has been performed.
