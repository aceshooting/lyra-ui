# Lyra Lines: an opt-in compact output profile

Lyra Lines is a compact text syntax a model can return instead of a JSON `LyraGenView`. It is a
**wire profile only**: `parseLines()` turns it into an ordinary JSON v1 view, which you then pass to
`validateView()` and store exactly like JSON output. There is no Lines storage format, no Lines
renderer and no Lines-specific validation path.

> **Status: opt in, pending a real-model evaluation.** The size and streaming numbers below come from
> an offline, synthetic benchmark with no model in the loop. They say nothing about how reliably any
> model writes this syntax. Keep JSON (or Markup) as the default until you have evaluated Lines with
> the model you deploy.

```ts
import { createLinesParser, encodeLines, parseLines } from '@aceshooting/lyra-gen/lines.js';
import { buildLinesPrompt } from '@aceshooting/lyra-gen/prompts-lines.js';
import { validateView } from '@aceshooting/lyra-gen/runtime.js';

const system = buildLinesPrompt(catalog);            // ask the model for Lines
const parsed = parseLines(modelText, catalog, { surfaceId: 'main', revision: 1 });
if (parsed.ok) {
  const checked = validateView(parsed.value, catalog); // always validate before rendering or storing
  if (checked.ok) render(checked.value);
}
```

## Syntax

```text
lines/1 lyra-reviewed+dashboard 1
stack#root
 heading#title | Capacity what-if
 slider#load-input label="Expected traffic" min=0 max=1000 step=10 value=400 @bindings={"value":"/whatif/traffic"}
 gauge#load-gauge "Projected CPU" 40 min=0 max=100 thresholds=[{"at":0,"variant":"success"}] @reads={"value":"/whatif/traffic"}
 stat#kpi "Revenue" "1.25M" unit="EUR" goodDirection=up variant=success
```

- **Header.** The first non-blank line is exactly `lines/1 <catalog-id> <catalog-version>` (a value
  is written bare when it only uses letters, digits and `_ . : + @ -`, otherwise as a JSON string).
  The positional order below belongs to that catalog id and version, so a header naming any other
  catalog or version is rejected (`lines.catalog-mismatch`) instead of being read with the wrong order.
- **One node per line:** `type#id positional... key=value... @member=JSON... | text`.
- **Nesting by indentation.** The root starts at column 1. The first indented line fixes the
  indentation step (the encoder writes one space); every child is exactly one step deeper than its
  parent. Tabs, uneven steps, skipped levels and a second root are rejected. There are no closing
  lines; a node's subtree ends at the next line indented no deeper than it.
- **Required props are positional**, in the order of the role's `required` list in the catalog.
  Positional values stop at the first required prop a node does not set (for example one supplied
  by a binding); every other prop is `key=value`. Positional values never follow a `key=value`, more
  positional values than required props are rejected, and a prop set twice is rejected.
- **Values** are JSON numbers, `true`, `false`, `null`, JSON strings in double quotes, or compact JSON
  arrays and objects on the same line. A **bare word** (`up`, `success`, `line`) is accepted only when
  the property's schema enumerates that exact value; anything else must be quoted.
- **Members** (`slot`, `bindings`, `reads`, `liveReads`, `dataQuery`, `repeat`, `itemReads`,
  `visible`, `checks`, `computes`, `a11y`, `action`) are written `@name=JSON`. Unknown members are
  rejected.
- **Text** follows `| ` and runs to the end of the line. Escapes are `\n`, `\r`, `\t`, `\\` and
  `\uXXXX`; any other backslash sequence is rejected. A bare `|` at the end of a line is empty text.
- **Ids** are required by default (`#id`, the same id grammar as JSON views). With
  `{ elideIds: true }` a node may omit its id: it becomes `<type>-<n>`, where `n` is the node's
  position among all nodes of that type in document order (explicit ids included), and an id-less
  root becomes `root`. Derived ids are written into the view before validation, so a derived id that
  collides with an explicit one is rejected as a duplicate. Ask the model to keep explicit ids for
  anything a later patch or host anchor refers to.
- Blank lines are ignored, CRLF line endings are accepted, raw control characters are not (JSON
  escapes carry them), and there are no comments.

Every rule is decided by the line itself; the parser never guesses. Strings are scanned as JSON, so
a quoted value containing `"`, `|`, `#`, `@` or `=` cannot start another field, and a newline inside
any value is always escaped, so no value can start another node.

## API

| Export | Purpose |
|---|---|
| `encodeLines(view, catalog, { elideIds? })` | `LyraGenResult<string>`. Encoding then parsing with the same `elideIds` reproduces the view exactly; with `elideIds` only ids equal to their derived form are left out. |
| `parseLines(text, catalog, options)` | `LyraGenResult<LyraGenView>`, syntax-checked only. `options.surfaceId` and `options.revision` come from the host, never from the text. |
| `createLinesParser(catalog, options)` | Streaming: `push(chunk)` returns `{ status, diagnostics, partial? }`, `finish()` returns the same result as `parseLines()`, `cancel()` discards. Each completed line is one complete node. With `progressive: {}` a validated preview (the shared `LyraGenPartialView`) may follow any completed line; `minCodeUnits` defaults to 0, and previews are still spaced so that their validation stays linear in the stream length. |
| `buildLinesPrompt(catalog, options)` | From `prompts-lines.js`: the Lines grammar, the exact header, the positional order of every role, and the same content, value and bound rules and catalog description as `buildCatalogPrompt()` (default profile `'signature'`). `elideIds` and `examples` (rendered in Lines) are opt in. |
| `LINES_HEADER`, `LINES_LIMITS`, `LINES_MEMBERS` | Constants. |

### Limits

`LINES_LIMITS` are the defaults and hard ceilings; `options.limits` can only lower them.

| Limit | Default | Diagnostic |
|---|---:|---|
| `maxLength` (UTF-16 code units) | 262144 | `lines.limit-length` |
| `maxBytes` (UTF-8) | 262144 | `lines.limit-bytes` |
| `maxLineLength` (enforced while streaming, before the newline arrives) | 65536 | `lines.limit-line` |
| `maxDepth` (levels, root included) | 32 | `lines.limit-depth` |
| `maxNodes` | 1000 | `lines.limit-nodes` |
| `maxFields` (values after the type and id) | 64 | `lines.limit-fields` |

Each embedded JSON value is parsed with `parseJson()` under `options.valueLimits`, so its nesting,
string length and entry counts are bounded and duplicate object keys are rejected (`lines.json`).

### Diagnostics

A failure returns exactly one error diagnostic whose message starts with
`Lyra Lines line <n>, column <c>:`, whose `source` holds UTF-16 offsets into the whole input, and
whose `path` is the JSON Pointer of the node being read (for example `/root/children/2`). Codes:
`lines.header`, `lines.catalog-mismatch`, `lines.indent`, `lines.multiple-roots`, `lines.type`,
`lines.unknown-type`, `lines.id`, `lines.id-required`, `lines.duplicate-id`, `lines.positional-count`,
`lines.positional-order`, `lines.duplicate`, `lines.unknown-member`, `lines.unsafe-key`,
`lines.bare-word`, `lines.value`, `lines.json`, `lines.unterminated`, `lines.separator`,
`lines.escape`, `lines.control-character`, `lines.empty`, `lines.context`, `lines.input`,
`lines.cancelled`, `lines.closed` and the limit codes above. Catalog rules (unknown props, schema
bounds, accessible names, bindings) are reported by `validateView()` on the parsed view, with the
same diagnostics as for JSON output, so repair and isolation work unchanged.

## Measurements (offline, synthetic)

From `benchmarks/generative-ui/dashboards` (13 authored dashboards, `heuristic-v1` approximate
tokens, which are not provider token counts):

| Encoding | Approx tokens vs JSON | Median first valid byte fraction |
|---|---:|---:|
| lyra-gen JSON view | 1.00x | 0.2195 |
| Lyra Markup | 0.69x | 0.1930 |
| Statement language (harness-local) | 0.62x | 0.0848 |
| Lyra Lines, explicit ids | 0.56x | 0.0814 |
| Lyra Lines, ids elided (corpus ids renamed to the derived form) | 0.52x | not measured |

Every scenario round-trips (encode, parse, deep-equal the authored view) and validates. These
figures compare encodings of the same hand-written content; they are not evidence that a model
produces Lines as accurately as JSON.
