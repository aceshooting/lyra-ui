# RFC 0006: Lyra Markup conservative streaming profile

- **Status:** Experimental
- **Created:** 2026-10-26
- **Supersedes / superseded by:** None

## Summary

Lyra Markup is a bounded data language for catalog-reviewed views. It never parses HTML,
creates DOM nodes, evaluates expressions, fetches resources or dispatches actions. A host
supplies the catalog identity, surface identity and revision; input supplies explicit node
identities. Parsing creates an untrusted view which still requires catalog/runtime validation.

## Grammar and deterministic interpretation

The following grammar uses ASCII names, case-sensitive matching and UTF-16 source offsets.
`WS` means space, tab, carriage return or line feed. There is exactly one root.

```text
document  = WS* element WS*
element   = '<' name attribute* WS* ('/>' | '>' content '</' name WS* '>')
attribute = WS+ name WS* '=' WS* (quoted | typed)
quoted    = '"' characters-except-quote-or-less-than '"'
          | "'" characters-except-apostrophe-or-less-than "'"
typed     = '{' JSON-value '}'
content   = text-only | (WS* element)* WS*
name      = [A-Za-z][A-Za-z0-9_-]*
```

A typed object therefore has two opening braces: `options={{"mode":"compact"}}`.
JSON strings use JSON escaping; quoted attributes do not use backslash escaping. Quoted
attributes and element text decode only `amp`, `lt`, `gt`, `quot`, `apos`, decimal numeric
references and hexadecimal references beginning `#x`. References require semicolons and a
Unicode scalar other than NUL. Unknown entities, lone surrogates, NUL, control characters
except tab/CR/LF, bidi formatting/isolation controls and Unicode noncharacters reject. Raw
less-than signs begin markup; raw ampersands must be escaped. Unicode normalization is never
performed. Offsets count original UTF-16 code units before entity decoding.

Every element requires a nonempty string `id`; duplicate identities reject the whole document.
No inferred identities or implicit closing tags exist. `slot`, `text`, `bindings` and `action`
are reserved node fields. Other attributes become exact, case-sensitive property names; no
kebab/camel conversion, coercion or default insertion occurs. Boolean absence and `{false}`
remain distinct; `"false"` remains a string. Numbers must be finite. JSON duplicate keys and
prototype-sensitive keys reject. JSON values have bounded depth and entry counts.

Text-only content is preserved exactly, including whitespace. Whitespace-only bodies on
`text` and `heading` are preserved; whitespace-only bodies on other types and whitespace
between child elements are formatting and discarded. Mixed non-whitespace text and children reject rather
than change ordering; use explicit `text` elements for mixed layouts. A `text` attribute and
nonempty text body conflict. Tags must be admitted by the caller's `allowedTags` list. The
built-in structural allowlist is `stack`, `row`, `grid`, `text`, `heading`, `divider`, `form`.
Catalog types are role keys (for example `button`), independent of their trusted rendered tags
(for example `lr-button`). They are never admitted merely because a custom element was registered.

Comments, declarations, processing instructions, CDATA, HTML namespaces, spread attributes,
bare boolean attributes, event attributes, style/class/HTML properties, executable strings
and unknown tags are not language features. Unknown and forbidden tags reject the complete
island. Strings remain data: any accepted URL-like string still requires sink-specific host
policy before use. Parser success confers no capability.

## Streaming, cancellation and source maps

`parseMarkup(source, options)` and `createMarkupParser(options).finish()` use the same parser.
`push(chunk)` retains only a bounded source and reports `incomplete`, without publishing a
view. `finish()` is the sole publication point and is idempotent. All chunkings of the same
source produce the same final view, diagnostics and node/attribute ranges. Appending after
finish is a programmer error represented by a diagnostic. `cancel()` discards retained input,
never publishes a view and prevents resume; resume requires a new parser with the complete
source. A syntactically unfinished final input returns `incomplete` with a diagnostic; known
malformed input returns `error`. No repair is guessed. Diagnostics do not echo input text.

This conservative profile scans retained source only once at finalization. It does not claim
progressive node publication or delta-only catalog validation. Limits cap UTF-8 source bytes,
UTF-16 source length, nesting, nodes, attributes, JSON depth and JSON entries. Caller limits
may tighten but never enlarge the hard ceilings. Source maps cover nodes and their complete
attribute spellings, preserving original positions through entities and surrogate pairs.

## Markdown islands

Only a fence whose complete opening line is zero to three spaces followed by at least three
backticks or tildes, then `lyra` and optional horizontal whitespace starts an island. The closing
fence uses the same character and at least the opening length, with optional indentation up
to three spaces and trailing horizontal whitespace. Other fenced blocks remain prose, including
nested-looking Lyra fences inside them. Four-space indentation, escaped fences, inline fences
and raw markup remain prose. Prose is copied verbatim; island records retain original source,
body and absolute offsets. An unclosed Lyra fence is an incomplete inert island. This small
scanner is not a Markdown renderer; hosts retain their existing Markdown renderer for prose.
The island scanner bounds its entire input and never activates or renders any record.
`createIslandParser(options).push(chunk)` scans only newly arrived lines and publishes each
complete island when a closing fence line arrives. Later prose and partial islands cannot alter
an already published island. At end of input, `finish()` also recognizes a closing fence without
a trailing newline. `cancel()` preserves completed islands and leaves the remaining fragment
inert. The host supplies a stable surface prefix; each completed island receives
`<prefix>:island-<zero-based-index>`, preventing neighboring islands from sharing state or action
identity. Hosts must keep the resulting identity within the shared view's length limit. The
scanner enforces UTF-8 byte limits before publishing, including split surrogate pairs. A stream
which later exceeds a global budget reports an error and publishes no further islands; callers
must honor that terminal diagnostic rather than treating cached content as a newly accepted view.

## References, actions and forms

`bindings` and `action` carry typed JSON data, then pass through the shared schema validator.
References identify host-declared data and JSON Pointers; parsing cannot grant data access.
Actions name host-declared capabilities, never JavaScript or callback URLs. Form controls use
catalog properties and explicit identities; state ownership and dirty-value preservation belong
to the runtime. Schema validation, authorization, revision checks, URL policy and payload
validation remain mandatory after parsing, including when JSON is the input frontend.

## Dependency comparison and decision

| Approach | Contract fit | Costs and decision |
| --- | --- | --- |
| Browser HTML parser | Implicit closing, case folding, entities and executable DOM are incompatible | Rejected; neither DOM construction nor HTML error recovery is needed. |
| General XML parser | Quoted attributes fit, but typed JSON attributes, mixed-content rules and streaming commit points differ | Would require a preprocessing language and another offset map; not selected for this profile. |
| General JavaScript/JSX parser | Accepts expressions far beyond this grammar | Rejecting expressions after parsing adds a larger grammar and attack surface; not selected. |
| Restricted scanner plus native JSON decoding | Direct grammar, offsets, fixed limits and no DOM dependency | Selected provisionally; JSON tokens are lexically checked before native decoding. |

This is a bounded contract-fit spike, not a comparative package performance benchmark. The
selected parser adds no runtime dependency, telemetry or network code. Repository fixtures and
seeded properties qualify the stated subset; broader dependency/license and production bundle
measurements remain release evidence, not claims made by this RFC.

## Threat boundaries and qualification

Script/style/event injection rejects lexically; HTML-looking text must be escaped and remains
text. Credentials, phishing links, deceptive labels, exfiltration, stale actions and malicious
host extensions cannot be resolved by syntax alone: reviewed catalogs, visible destinations,
host authorization and revision checks own those boundaries. Default incomplete/error states
are inert. Limits address source, depth, width and JSON expansion denial of service.

The conformance suite covers valid scalar/structured attributes, escaping, identities, nesting,
source positions, malformed inputs, forbidden surfaces, budgets, interruption, Markdown fences
and every split point of representative documents. Seeded property tests exercise arbitrary
text and chunking. This experimental syntax is version 1; changing the grammar requires new
fixtures and an explicit compatibility decision. Accessibility and localized loading/error
presentation belong to the host renderer and require browser qualification separately.

## Authoring helper

`emitMarkup(view, catalog)` validates a structured view against a host-provided catalog, emits
stable property ordering and escaped text/JSON, then parses and validates the result. It never
registers a generated catalog, adds permissions or infers an action. Unsupported attribute names,
reserved-property collisions, source expansion over limits and values outside this grammar
return diagnostics. `escapeMarkupText` is a literal-escaping primitive, not a validation or
authorization boundary. Empty optional property/child collections normalize to absence.
