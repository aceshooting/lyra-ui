# Generated-content threat fixtures

This version 1 matrix maps the experimental native generated-view profile to specific mitigation
paths and executable fixtures. Model output, imported views, tool data and restored state are
untrusted. Catalog definitions, adapters, loaders and host callbacks are trusted application code;
the declarative boundary does not sandbox that code.

The fixture identifiers below name authored assertions. Qualification results must identify the
package source, test command and browser versions that actually ran them. A fixture inventory is
not a security certification, a complete protocol-conformance result or a measurement of browser
memory and execution time.

## Composed browser scenes

[The composed threat suite](../test/browser/threat-matrix.test.ts) uses these stable scene IDs:

| Scene | Threat and boundary | Asserted outcome |
| --- | --- | --- |
| TM-01 | Script/handler injection and ambiguous identities inside separate fenced islands; fake HTML in surrounding prose | A completed valid island keeps its DOM identity. Script, duplicate-ID and handler islands each become a visible fallback. No valid sibling inside a rejected island is salvaged. A later independent valid island renders. Fake image markup stays literal text and makes zero requests to the synthetic target. |
| TM-02 | Unsupported roles, duplicate identities and excessive property strings in a complete view | The whole affected view rejects with a localized fallback and no generated nodes. Host instructions remain available. A later valid revision recovers. |
| TM-03 | A retained old action control after its source document changes to an invalid action | The old control is inert both before the pending update settles and after rejection. A separately authorized surface still emits its declared action exactly once. |
| TM-04 | A trusted property adapter accidentally changes an admitted media URL to an unapproved destination | Final prepared properties reject before an image receives its source or enters the document. The development server counts zero target requests. A direct image load to the same synthetic target then counts one, proving the counter and target are active. |
| TM-05 | A model forges field approval, changes reviewed field presentation or reuses an approval on another surface | Forged document permissions and changed fields do not render. Only the exact host-approved node on its approved surface renders for the declared sensitive purpose. The approval cannot be reused on another surface. |

TM-01 and TM-04 use [a development-only request-counter plugin](../test/threat-plugin.mjs).
The probe is a synthetic image served by the test server. Counting requests at the server covers
native image loading, which a `fetch` spy alone would miss. These checks concern the named targets;
they do not claim that all dependency/module traffic or every possible browser effect is absent.

Run the focused source suite from the companion directory with the repository's pinned Node:

```sh
WTR_RETRIES=0 WTR_BROWSER=chromium pnpm exec web-test-runner --config web-test-runner.config.mjs --files test/browser/threat-matrix.test.ts
```

Repeat with `WTR_BROWSER=firefox` and `WTR_BROWSER=webkit` for the three-engine cohort. The normal
browser suite discovers this file, and the shared configuration enrolls the counter plugin.

## Threat-to-mitigation map

| Threat | Mitigation and named fixtures | Scope |
| --- | --- | --- |
| Script, styles and generated event handlers | Restricted Markup allowlist and forbidden attributes; parser cases `script tag`, `style tag`, `forbidden attribute onclick`, `forbidden attribute onerror`, `forbidden attribute style`; TM-01 | Rejected generated source is never passed to an HTML evaluator. Trusted catalog JavaScript is a separate host capability. |
| Entity decoding and bidirectional controls | Parser cases `entity no recursive decoding`, `bidi entity`, `escaped bidi`, `unknown named entity` and exact source-range tests | These establish the restricted language's decoding rules. They do not certify the truthfulness or visual intent of arbitrary natural-language text. |
| Fake HTML or expression-like text | TM-01 literal image-markup prose; named-function test `named functions reject expressions, invalid locales, overflowing results and malformed arguments` | Text becomes text nodes. Function names resolve only through the trusted registry; no generated expression evaluator is introduced. |
| Prototype pollution, getters and serialization hooks | Schema tests `owns and freezes admitted data without invoking getters or serialization hooks` and `rejects dangerous keys, cycles, sparse arrays, symbols and non-JSON values` | Boundary data must be bounded plain JSON. Catalog callbacks remain trusted code. |
| Deep, huge or repeated resource work | Parser corpus `source code unit ceiling`, `UTF8 byte ceiling`, `node ceiling`, `depth ceiling`, `JSON entry ceiling`, `JSON depth ceiling`; schema test `enforces every structural budget and immutable hard ceilings`; TM-02 | Per-document admission ceilings are tested. Host request rate, accumulated sessions, browser scheduling and long-session heap need their own limits and measurements. |
| Partial unsafe activation | Island tests `invalid closed island leaves surrounding prose intact` and `an unclosed fence never exposes an activatable view`; TM-01 and TM-02 | Isolation follows independent fenced boundaries. Security, resource and identity failures reject their affected boundary rather than guess which subtree is safe. |
| Invented actions and stale controls | Runtime test `action contexts carry current identity and validate authorized payloads`; TM-03; renderer test `requires host confirmation and ignores an approval after a pending document change` | The renderer emits requests only. The actual effect boundary independently checks identity, permissions and current revision. |
| Unapproved URL/media effects | Content-policy test `custom URL properties require explicit media origin policy and navigation stays action-only`; TM-04 | Direct navigation properties and undeclared sinks reject. Approved media checks apply to the assigned URL; redirect policy remains a host responsibility as described below. |
| Deceptive sensitive-data collection | Content-policy tests `sensitive collecting roles require an exact scoped trusted approval`, `general fields remain compatible; strict approval prevents unreviewed collection`, `a model cannot add purpose, approvals or URL permissions to its document`; TM-05 | Sensitive collection requires host authority. For every field's presentation to be reviewed, enable the strict approved-field registry; input-type restrictions alone cannot detect what a label asks a user to disclose. |
| Source impersonation or disclosure across viewers | Chat test `viewer source registry supplies citation labels; missing and revoked sources become inert visible text`; reference test `references use host maps, enforce freshness and budgets, and never interpret returned data` | Source IDs resolve through the current viewer's host map. A generated source label is not evidence or authorization. |
| Replay that restores authority or overwrites edits | Runtime test `dirty owned fields survive follow-ups, deleted fields disappear and snapshots restore`; repair test `repair budgets and revision preconditions prevent stale or expanded-scope writes`; TM-03 and TM-05 | Restoring content does not replay actions. Reauthorize source access and retain exact catalog/version checks before mounting a stored view. |
| Observation that leaks content | Diagnostic observer unit/property fixtures and renderer categories-only observer cases | The observer receives finite categories, not source text, values or diagnostic messages. It starts no telemetry transport; application observers retain their own obligations. |

The lexical fixtures are in [the Markup corpus](../test/fixtures/markup.ts) and executed by
[parser tests](../src/parser.test.ts). The other named tests live in
[schema](../src/schema.test.ts), [islands](../src/islands.test.ts),
[runtime](../src/runtime.test.ts), [functions](../src/functions.test.ts),
[references](../src/references.test.ts), [chat](../src/chat.test.ts),
[repair](../src/repair.test.ts), [content policy](../src/content-policy.test.ts) and
[diagnostic observer](../src/diagnostics.test.ts) suites. Renderer approval cases are in
[the form/action browser suite](../test/browser/gen-view.test.ts).

## Selecting host policy

The [field policy](security.md#field-collection-policy) distinguishes compatible general fields
from strict reviewed-field approval. The [URL policy](security.md#url-sinks-and-navigation)
describes assigned-media origin checks, native redirect limits and action-only navigation.
Choose these profiles before exposing collection or effects to generated content. The fixture
cohort covers its named targets and configured policy; it does not detect deceptive prose or
replace server authorization.
