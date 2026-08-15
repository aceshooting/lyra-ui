## `lr-markdown`

Sanitized Markdown-to-HTML rendering (GFM tables, fenced code blocks, links, blockquotes) built on
two optional peer dependencies — `marked` (parsing) and `dompurify` (sanitizing) — both lazy-loaded
independently via `markdown-loader.ts`'s `loadMarkdownDeps()` on first connect, cached per page the
same way `chart-loader.ts`/`map-loader.ts` cache their load promise so every `<lr-markdown>`
instance on a page shares one load. `heading`/`code`/`blockquote`/`table`/`link`/`image` tokens are
rendered through a `marked` renderer override that injects `part="..."` attributes directly into the
produced HTML in a single pass (no second DOM walk after insertion).

If an instance disconnects and reconnects before that shared promise settles, only the current
connection applies the result and reparses; the stale connection callback is generation-guarded.

To warm that shared cache before the first Markdown instance connects, await the stable public
entry point. This keeps the default lazy behavior for apps that do not need it while letting a
route or startup boundary render from an already-settled cache. The helper is exported by both
the full and core granular entries:

```ts
import { preloadMarkdown } from "@aceshooting/lyra-ui/components/conversation/markdown/markdown.js";

await preloadMarkdown();
```

Fenced code blocks are also syntax-highlighted via the same optional `shiki` peer `<lr-code-block>`
uses, gated by `highlightCode` (default `true`). This is a pure upgrade, not a separate opt-in: it's
already transparently gated by whether `shiki` is installed at all, so an app that never installs the
peer sees byte-identical output to before this property existed. The very first render of any content
is always plain text/code (identical to today's output); highlighting arrives as an asynchronous
upgrade one render later once shiki resolves and the block's language is tokenized. No highlighting
is attempted while `streaming` is `true` — it applies once a stream settles, adding no per-chunk cost
while content is still arriving.

Highlighted blocks follow the page's resolved theme. Shiki emits both palettes at once, so
`[part="content"]` carries `data-dark-theme="true"` whenever the component's own resolved
`--lr-color-text` is lighter than its `--lr-color-surface`, and the stylesheet then paints each
token from `--shiki-dark`/`--shiki-dark-bg` rather than the light inline color. It keys off the
resolved tokens rather than `prefers-color-scheme`, so an app theming with `--lr-theme-color-*`
independently of the OS setting gets the dark palette too — the same mechanism `<lr-code-block>`
uses for its own `[part="body"]`.

**Properties:**

- `content: string = ''` — the Markdown source to render
- `tabSize: number = 4` (attribute `tab-size`) — tab-stop width used to expand tabs in leading
  indentation before parsing. Values are finite-integer guarded and clamped to `[1, 32]` at use;
  invalid values fall back to `4`. This is separate from `--lr-code-block-tab-size`, which controls
  how tabs already inside rendered code are displayed.
- `marked: LyraMarkedParser | undefined` (readonly, no attribute) — this instance's peer-neutral,
  configurable `marked.Marked` parser. It is `undefined` while the optional peer is still resolving
  or unavailable. Each element owns an isolated parser, so `marked.use(...extensions)` affects only
  that element; call `renderMarkdown()` after configuring it. The peer-neutral type deliberately
  models Lyra's stable `defaults`/`use()`/`parse()` surface; consumers using version-specific Marked
  tokenizers, constructors, or helpers should type that local reference with their installed
  `marked` version.
- `htmlMode: 'sanitize' | 'escape' | 'trusted' = 'sanitize'` (attribute `html-mode`) — controls raw
  authored HTML. `sanitize` passes the complete rendered document through DOMPurify and fails closed
  to plain text if the peer is unavailable; `escape` displays raw HTML source as text while ordinary
  Markdown still renders; `trusted` renders raw HTML without sanitization and is only for trusted
  content.
- `gfm: boolean = true` — GitHub-flavored Markdown (tables, strikethrough, autolinks, task lists)
- `linkTarget: string | null = '_blank'` (attribute `link-target`) — `target` applied to every
  rendered `<a>`, with `rel="noopener noreferrer"` always added alongside it whenever a `target` is
  emitted. `'_blank'` (the default) preserves the original output; a falsy value (`null`, or the
  empty string via `link-target=""`) omits `target`/`rel` entirely instead of always defaulting to
  `_blank`, so rendered links open in the same tab
- `internalLinkPrefix: string = ''` (attribute `internal-link-prefix`) — when set, a rendered link
  whose `href` _attribute_ (not the browser-resolved `.href` property) starts with this prefix is
  intercepted on click and reported via `lr-link-click` instead of navigating; empty (the default)
  means every link is treated as external
- `headingOffset: number = 0` (attribute `heading-offset`) — added to every rendered heading's
  source `token.depth` before emitting `<h${depth}>` (e.g. `heading-offset="2"` renders a source `#`
  as `<h3>`); clamped to `[1, 6]` so a source `######` with a positive offset stays at `<h6>` rather
  than overflowing past the HTML heading levels. `0` (the default) preserves the original
  `<h${token.depth}>` output
- `streaming: boolean = false` (reflected) — marks the host `aria-busy="true"` while partial Markdown
  is still arriving and lets consumers target `lr-markdown[streaming]`; content updates while it is
  true are coalesced to at most one parse per animation frame, while the final `streaming=false`
  update flushes the latest content immediately; busy state also remains true while parser
  dependencies are loading
- `highlightCode: boolean = true` (attribute `highlight-code`) — syntax-highlights fenced code
  blocks via the optional `shiki` peer. `true` (the default) upgrades every fenced block once the
  peer is available; set `false` to keep plain output even when `shiki` is installed. No effect
  while `streaming` is `true`
- `languages?: Record<string, ShikiLanguageInput>` (attribute: false) — same shape and purpose as
  `<lr-code-block>`'s own `languages`: a fine-grained, explicit language-grammar bundle scoping
  shiki's build output to just those grammars instead of its full ~200-language bundle. Forwarded
  verbatim to `loadShikiHighlighterCore()`. Unset (the default) uses the default full-bundle loader
- `headingAnchors: boolean = false` (attribute `heading-anchors`) — stamps a computed
  GitHub-slugger-style slug as `id` on every rendered heading.
- `math: boolean = false` — renders `$inline$` and `$$block$$` TeX via the optional `katex` peer,
  lazy-loaded the same way as `marked`/`dompurify`/`shiki`.
- `highlights: readonly LyraHighlight[] = []` (attribute: false) — host-supplied `text-quote` highlights;
  reassign the array after mutation so painting is refreshed.
- `activeHighlightId: string | null = null` (attribute `active-highlight-id`) — identifies the
  currently active entry in `highlights` for active paint and outline treatment.
- `anchor: LyraAnchor | string | null = null` (attribute: false) — declaratively applies an anchor
  or a highlight id through the same path as `scrollToAnchor()`; assigning the same value again
  deliberately re-runs resolution.
- `anchorKinds: readonly ('fragment' | 'text-quote')[] = ['fragment', 'text-quote']` — the anchor kinds this
  component resolves for the shared anchor-target contract.

Text-quote resolution indexes at most 1,000,000 code units/20,000 text nodes per content
generation, accepts quote fields up to 4,096 code units, and scans at most 4,000,000 code units per
pass. It reuses that index across navigation and painting. Host-highlight admission retains at most
10,000 unique nonempty records after inspecting at most 10,001 inputs; rendering selects at most
1,000 candidates and paints at most 100, with an active entry anywhere in the admitted snapshot
placed first and preserved inside both ceilings.

**Methods:**

- `renderMarkdown(): void` — immediately reruns the current content through the parse, selected
  HTML-mode, and fallback pipeline. Use it to refresh existing content after changing `marked` configuration;
  it safely no-ops while the optional parser is unresolved.
- `getHeadingTree(): MarkdownHeadingItem[]` — returns the document-ordered heading outline
  (`{ id, label, level }[]`)
  computed on every parse, regardless of `headingAnchors`.
- `LyraMarkdown.getMarked(): Marked` — returns the variant's shared compatibility parser (`Marked`
  is the route's exported alias of `LyraMarkedParser`),
  whose configuration seeds instance parses. Await `preloadMarkdown()` first; otherwise this throws.
- `LyraMarkdown.updateAll(): void` — re-renders every connected full Markdown instance after shared
  compatibility-parser configuration changes. Prefer the instance `marked` parser for isolated
  configuration.

**Events:**

- `lr-link-click` (`detail: { href: string }`) — fired, with the click prevented,
  when a rendered link's `href` starts with `internal-link-prefix`; ordinary external links navigate
  normally and never fire this
- `lr-render-error` (`detail: { error: unknown }`) — rendering fell back to plain text (see the
  fallback matrix below), or `math` is set but the `katex` peer isn't installed
- `lr-highlight-activate` (`detail: { highlightId: string }`) — a painted `text-quote` highlight was clicked
- `lr-text-select` (`detail: { text: string; anchor: LyraAnchor | null; rects: DOMRect[] }`) — a text
  selection inside the rendered content ended; `anchor` is a `text-quote` anchor scoped to the
  rendered content, or `null` when the selection couldn't be anchored
- `lr-anchor-result` (`detail: { found: boolean }`) — fired after an `anchor` property assignment or
  a `scrollToAnchor()` call is applied (the shared anchor-target contract)

**Slots:** none — content comes from the `content` property, not light-DOM children.

**CSS parts:** `content` (the wrapper around the rendered or plain-text-fallback output; carries
`data-fallback` while showing the plain-text fallback — still-loading peers or a failed render —
so a consumer can target `lr-markdown [part='content'][data-fallback]` to style it distinctly),
`heading` (every rendered `<h1>`–`<h6>`, shifted by `heading-offset`), `paragraph` (every rendered
`<p>`), `list` (every rendered `<ul>`/`<ol>`), `code-block` (every rendered fenced/indented `<pre>`),
`inline-code` (every rendered inline `<code>` span — backtick spans, not fenced blocks), `link`
(every rendered `<a>`), `table` (every rendered `<table>`), `blockquote` (every rendered
`<blockquote>`), `img` (every rendered `<img>`), `math` (a rendered inline or block math span,
carrying `data-display="inline"|"block"`)

**Themeable custom properties:** `--lr-markdown-font-mono` (default `var(--lr-font-mono)` — the
code/code-block font, resolving through the library's shared monospace stack so a
`--lr-theme-font-mono` override reaches it), `--lr-code-block-tab-size` (default `2` — tab width inside a
rendered fenced or indented `code-block`), plus shared tokens `--lr-space-xs/-s/-m/-l`,
`--lr-color-brand-quiet`, `--lr-color-brand`, `--lr-color-border`, `--lr-color-text-quiet`,
`--lr-radius`.

**Optional peer deps:** `marked`, `dompurify` (both lazy-loaded via `markdown-loader.ts`'s
`loadMarkdownDeps()`, mirroring `chart-loader.ts`'s two-independent-optional-peers shape). Each half
is loaded and caught independently — a consumer who installs only `marked` and explicitly sets
`html-mode="trusted"` (so `dompurify` is never needed) is a valid, supported combination. Also `shiki`,
the same optional peer `<lr-code-block>` uses, for `highlightCode`'s fenced-block syntax
highlighting — independent of the `marked`/`dompurify` pair, and its absence never blocks rendering
(fenced blocks simply stay unhighlighted). The readonly `marked` property becomes available only
after that lazy load resolves; each instance owns its configuration. Call `renderMarkdown()` after
`marked.use(...)` to refresh content that is already shown.

```html
<lr-markdown
  content="# Report&#10;&#10;See the [setup guide](/docs/setup) for details."
  internal-link-prefix="/docs/"
></lr-markdown>
<script>
  document
    .querySelector("lr-markdown")
    .addEventListener("lr-link-click", (e) => {
      router.navigate(e.detail.href);
    });
</script>
```

Rendering never ships unsanitized or broken markup silently. If `marked` fails to load, or throws
while parsing malformed input, the component falls back to plain text (`white-space: pre-wrap`, no
HTML parsing at all — the raw `content` string itself) and fires `lr-render-error`. In the default
`html-mode="sanitize"`, an unavailable or failed `dompurify` peer takes that same fail-closed path:
the component never renders `marked`'s raw HTML output when sanitization was requested. Use
`html-mode="escape"` when authored raw HTML should remain visible as text, or
`html-mode="trusted"` only for content whose complete HTML output is already trusted. While the
optional peers are still resolving, the host carries `aria-busy="true"` (set/
cleared in `updated()` based on whether the deps have loaded) and shows the same plain-text fallback
rendering — there's no separate loading skeleton, since the un-rendered Markdown source is already
legible text in the meantime.

**One tab width for every code surface.** `--lr-code-block-tab-size` is deliberately the same
property name and default (`2`) that `<lr-code-block>` and `<lr-code-editor>` use, so a consumer sets
tab width once for every code surface in the app. It is declared as a `var()` fallback **at the point
of use, never on `:host`** — a `:host` declaration is re-stamped on every instance and shadows any
inherited value, so a page- or container-level declaration could never reach it. This element carries
its own copy of that fallback rather than inheriting `<lr-code-block>`'s because the two are
**sibling** custom elements, not ancestor and descendant: no single declaration inside one of them
can cover the other. The same value can still _look_ different between the two — a markdown code
block inherits `white-space: pre-wrap` while `<lr-code-block>` is `white-space: pre`, and tab stops
restart at the beginning of each visual line, so a wrapped line's tabs land differently.

**Known gotchas:**

- a malformed percent-escape or lone UTF-16 surrogate in a link's raw `href` makes the internal
  `encodeURI`-based validity guard throw, silently dropping just that anchor (the link text still
  renders, with no `href`) — mirrors `marked`'s own default `link()` renderer's defensive behavior.
- `target` is not in DOMPurify's default attribute allowlist (unlike `part`/`rel`/`class`, which
  already are), so sanitization is called with `ADD_ATTR: ['target']` — without that, every rendered
  link's `target` would be silently stripped by sanitization even though the anchor itself survives.
- a fresh internal `marked.Marked()` instance (with a fresh renderer) is built on every parse so
  the renderer's `link()` override always closes over the _current_ `linkTarget`. The public
  `marked` parser is still shared: its current configured defaults are copied into that fresh
  instance on each pass, avoiding a stale closure while preserving `marked.use(...)` hooks and
  extensions.
- `internal-link-prefix` matching compares against the raw `href` _attribute_, not the resolved
  `.href` IDL property (always an absolute URL in the browser) — a prefix like `/docs/` matches a
  relative markdown link but would never match against the resolved property.
- rendered output goes through `unsafeHTML`; with `html-mode="trusted"` the component renders
  whatever HTML `marked` produces from `content` completely unsanitized, so untrusted `content`
  must never use trusted mode.

**Additional API surface:**

- `--lr-markdown-highlight-accent-bg` — Accent highlight fill. Default: `var(--lr-color-brand-quiet)`.
- `--lr-markdown-highlight-success-bg` — Success highlight fill. Default: `var(--lr-color-success-quiet)`.
- `--lr-markdown-highlight-warning-bg` — Warning highlight fill. Default: `var(--lr-color-warning-quiet)`.
- `--lr-markdown-highlight-danger-bg` — Danger highlight fill. Default: `var(--lr-color-danger-quiet)`.
- `--lr-markdown-highlight-neutral-bg` — Neutral highlight fill. Default: `var(--lr-color-surface)`.
- `--lr-markdown-highlight-active-bg` — Active highlight fill. Default: `var(--lr-color-brand-quiet)`.
- `--lr-markdown-highlight-active-outline-color` — Active highlight outline. Default: `var(--lr-color-brand)`.

---

## `lr-markdown-core`

A build-lean sibling of `<lr-markdown>` above, for a consumer whose `languages` map already covers
every language it will ever render — mirrors `<lr-code-block-core>`'s relationship to
`<lr-code-block>`. Where `<lr-markdown>` unconditionally calls `loadShikiHighlighter()` — the
default ~200-language dynamic-import table loader, whose bundled lookup table a bundler can't
statically narrow away —
this component's own module never imports or calls that function at all; it only ever calls
`loadShikiHighlighterCore(languages)`, so a consumer importing this entry point instead of
`markdown.js` gets a build genuinely free of shiki's full language table.

A fenced code block whose language isn't a key in `languages` always renders the plain-text fallback
— there is no default/full-table highlighter here to fall back to, the same default (not degraded)
rendering path as `<lr-code-block-core>`'s identical contract. A block that _is_ highlighted follows the
page's resolved theme through the same `[part="content"][data-dark-theme="true"]` hook `<lr-markdown>`
documents above, painting each token from `--shiki-dark`/`--shiki-dark-bg` on a dark palette. Every other capability — GFM tables,
links, blockquotes, images, heading anchors, `getHeadingTree()`, `fragment`/`text-quote` anchor-target
support (`highlights`, `activeHighlightId`, `scrollToAnchor()`, the `lr-highlight-activate`/
`lr-text-select`/`lr-anchor-result` events), math via the optional `katex` peer, the sanitize/
`htmlMode`/streaming fallback matrix and known gotchas — is identical to `<lr-markdown>`; see that
section above for the full write-up of shared behavior.

**Properties:** `content: string = ''`, `tabSize: number = 4` (attribute `tab-size`) — the same
finite-integer-guarded leading-indentation expansion used by `<lr-markdown>`; values outside 1–32
or non-finite values fall back to `4`, independently of rendered code's
`--lr-code-block-tab-size`; `marked: LyraMarkedParser | undefined` (readonly, no attribute) — this
instance's isolated peer-neutral configurable parser; `htmlMode: 'sanitize' | 'escape' | 'trusted' =
'sanitize'` (attribute `html-mode`), `gfm: boolean = true`, `linkTarget: string | null = '_blank'` (attribute
`link-target`), `internalLinkPrefix: string = ''` (attribute `internal-link-prefix`),
`headingOffset: number = 0` (attribute `heading-offset`), `streaming: boolean = false` (reflected),
`highlightCode: boolean = true` (attribute
`highlight-code`), `languages: Record<string, ShikiLanguageInput> = {}` (attribute: false) — required,
unlike `<lr-markdown>`'s optional `languages?:`; empty (the default) means every fenced block stays
unhighlighted permanently, `headingAnchors: boolean = false` (attribute `heading-anchors`),
`math: boolean = false`; plus the same inherited anchor-target properties as `<lr-markdown>`:
`highlights: readonly LyraHighlight[] = []` (attribute: false), `activeHighlightId: string | null = null`
(attribute `active-highlight-id`), `anchor: LyraAnchor | string | null = null` (attribute: false),
and `anchorKinds: readonly ('fragment' | 'text-quote')[] = ['fragment', 'text-quote']`.
The same 1,000,000-code-unit/20,000-node corpus ceiling, 4,096-code-unit quote-field ceiling,
4,000,000-code-unit work ceiling, 10,000-record admission ceiling, 1,000-candidate window, and
100-painted-highlight limit documented for `<lr-markdown>` apply here too, including active-first
retention from anywhere in the admitted snapshot.

**Methods:** `renderMarkdown(): void` — immediately reruns the current content through the parse,
sanitize, highlight, and fallback pipeline after changing this instance's `marked` configuration;
safely no-ops while the parser is unresolved. `refreshTheme(): void` re-reads the resolved theme
for syntax highlighting. `getHeadingTree()` — same contract as
`<lr-markdown>`'s own. `LyraMarkdownCore.getMarked(): Marked` and
`LyraMarkdownCore.updateAll(): void` provide the same variant-scoped compatibility-parser contract
as the full class; the core route exports its own `Marked` alias.

**Events:** `lr-link-click`, `lr-render-error`, `lr-highlight-activate`, `lr-text-select`,
`lr-anchor-result` — identical detail shapes to `<lr-markdown>`'s own.

**Slots:** none — content comes from the `content` property, not light-DOM children.

**CSS parts:** `content`, `heading`, `paragraph`, `list`, `code-block`, `inline-code`, `link`,
`table`, `blockquote`, `img`, `math` — identical to `<lr-markdown>`'s own parts.

**Themeable custom properties:** `--lr-code-block-tab-size` (default `2` — tab width inside a
rendered fenced or indented `code-block`), with exactly the mechanics described under
`<lr-markdown>` above: the same property name and default that `<lr-code-block>`/`<lr-code-editor>`
read, declared as a `var()` fallback at the point of use rather than on `:host` so a page- or
container-level value reaches it, and carried here in its own right because this element is a
**sibling** of `<lr-code-block>` rather than an ancestor of it. Markdown code blocks wrap
(`white-space: pre-wrap`) while `<lr-code-block>` does not, so the same tab width can render
differently on a wrapped line. `--lr-markdown-font-mono` is the monospace stack used by rendered
code and defaults to `var(--lr-font-mono)`.

**Optional peer deps:** `marked`, `dompurify` (both lazy-loaded, same as `<lr-markdown>`), `katex`
(for `math`). Does _not_ depend on the full `shiki` package's default entry point — only
`shiki/core`/`shiki/engine/oniguruma`/`shiki/langs/*`, the same fine-grained subset
`<lr-code-block-core>` depends on.

````ts
import { html } from "lit";
import python from "shiki/langs/python.mjs";
import "@aceshooting/lyra-ui/components/conversation/markdown/markdown-core.js";

const view = html`<lr-markdown-core
  .content=${"# Report\n\n```python\nprint('hi')\n```"}
  .languages=${{ python }}
></lr-markdown-core>`;
````

**Additional API surface:**

- `--lr-markdown-highlight-accent-bg` — Accent highlight fill. Default: `var(--lr-color-brand-quiet)`.
- `--lr-markdown-highlight-success-bg` — Success highlight fill. Default: `var(--lr-color-success-quiet)`.
- `--lr-markdown-highlight-warning-bg` — Warning highlight fill. Default: `var(--lr-color-warning-quiet)`.
- `--lr-markdown-highlight-danger-bg` — Danger highlight fill. Default: `var(--lr-color-danger-quiet)`.
- `--lr-markdown-highlight-neutral-bg` — Neutral highlight fill. Default: `var(--lr-color-surface)`.
- `--lr-markdown-highlight-active-bg` — Active highlight fill. Default: `var(--lr-color-brand-quiet)`.
- `--lr-markdown-highlight-active-outline-color` — Active highlight outline. Default: `var(--lr-color-brand)`.

---

## `lr-chat-message`

A role-based message bubble _shell_ for a chat/agent conversation surface. It renders none of the
message content itself — the default slot carries whatever a consumer wants to display (plain text,
a `<lr-markdown>`, a custom template, anything) and this component only supplies the surrounding
chrome: alignment/coloring by `role`, an avatar/badges header row, an optional collapse toggle, an
attachments strip, and a status-aware footer (a live-updating status dot + text, the formatted
`timestamp`, a built-in retry affordance for `status="failed"`, and an `actions` slot for everything
else). No built-in copy button is rendered — slot a copy control into `actions` and fire
`lr-copy` (fulfilled-only frozen `detail: { ok: true, text }`) from it if you want one (matching
`<lr-code-block>`'s copy-affordance contract for anything listening at the conversation-surface
level).

**Properties:**

- `messageRole: ChatMessageRole = 'assistant'` (`'user' | 'assistant' | 'system'`, attribute
  `message-role`, reflected) — identifies the author without colliding with the platform `role`
  attribute. The internal article receives the localized author name and styling exposes the same
  state through `data-role`; a bare `role="assistant"` is never an authoring API.
- `status: ChatMessageStatus = 'sent'` (`'sending' | 'sent' | 'failed' | 'streaming'`, reflected) —
  drives the footer's status dot/text, `status="failed"`'s danger treatment on the bubble, and the
  built-in retry button
- `timestamp?: LyraTimestamp` (`Date | string | number`, attribute: false) — normalizes through the
  ECMAScript TimeClip domain; invalid or throwing input is treated as unset (no timestamp rendered)
- `formatTimestamp?: (date: Date) => string` (attribute: false) — overrides the default
  `hour:minute` (`Intl.DateTimeFormat`, runtime locale) rendering of `timestamp`
- `collapsible: boolean = false` (reflected) — shows the built-in collapse/expand toggle in the header
- `collapsed: boolean = false` (reflected) — whether the message body is hidden; effective whenever
  set, independent of `collapsible` (which only controls whether the toggle button itself is
  rendered) — mirrors `lr-widget`'s identical `collapsible`/`collapsed` pair
- `attachmentsPosition: 'before'|'after' = 'after'` (attribute `attachments-position`) — places the
  `attachments` slot before or after the message body; both the visual and reading order follow it
- `actionsPosition: ChatMessageActionsPosition = 'inside'` (`'inside' | 'outside'`, attribute
  `actions-position`, reflected) — `'outside'` renders the `actions` slot's content as a sibling
  immediately after `[part="bubble"]` instead of nested inside `[part="footer"]`'s own
  padding/background box, for an action row that must sit visually outside the bubble's chrome
- `messageId: string = ''` (attribute `message-id`, reflected) — optional stable application id;
  included in `lr-message-retry` detail when the built-in retry control is activated

**Events:** `lr-message-retry` (`detail: { messageId?: string }`; fired by the built-in retry button,
only rendered when `status="failed"`). `lr-toggle-request` is cancelable and carries
`{ collapsed: boolean }`; preventing it vetoes the built-in collapse/expand transaction.
`lr-toggle` carries that same detail after the accepted state is committed.

**Slots:** default (the message body), `avatar` (an avatar/icon for the message author), `badges`
(small status/metric chips — e.g. token count, latency, model name — entirely app-supplied), `actions`
(action controls such as copy/retry, rendered at the end of the footer), `attachments` (file/image
attachment chips, rendered below the message body), `failure` (only meaningful while
`status="failed"`: host-supplied content — typically a `role="alert"` banner plus its own retry
control — that replaces the built-in status text, retry button, and live-region announcement
entirely; unset, `status="failed"` renders exactly as before)

**CSS parts:** `bubble`, `header` (hidden entirely when nothing is in it), `avatar`, `badges`,
`collapse-button` (only rendered when `collapsible`), `body` (hidden while `collapsed`),
`attachments`, `footer` (hidden entirely when nothing is in it), `status-indicator` (a small
decorative `aria-hidden` dot, absent while `status="sent"`), `status-text` (the visible text twin of
`status-indicator`), `timestamp`, `retry-button` (only rendered when `status="failed"` and the
`failure` slot is empty), `actions` (rendered inside the footer by default; a sibling immediately
after `bubble` when `actionsPosition="outside"`), `failure` (`display: contents` wrapper for the
`failure` slot; contributes no box when the slot is empty)

**Themeable custom properties:** `--lr-chat-message-max-width` (default `80%` — the bubble's max
inline size; component-specific, no shared width token exists), four role-scoped bubble color
properties:

- `--lr-chat-message-bubble-bg` (default `var(--lr-color-surface)`) — bubble fill for every role
  except `user`.
- `--lr-chat-message-bubble-color` (default `var(--lr-color-text)`) — bubble text color for those
  same roles.
- `--lr-chat-message-user-bubble-bg` (default `var(--lr-color-brand-quiet)`) — bubble fill for
  `data-role="user"`.
- `--lr-chat-message-user-bubble-color` (default `var(--lr-color-text)`) — bubble text color for
  `data-role="user"`.

Prefer these over re-pointing the shared token a default happens to reference. Overriding
`--lr-color-brand-quiet` on the host also retints `[part='collapse-button']:hover` within this same
component, and which shared token backs each role's fill is not a stable contract — it changed
between 4.x and 5.0.0, which silently turned one consumer's inner-surface scrim into the whole
bubble (near-black text on `rgba(0,0,0,0.22)`, visible only by eye). These four are that stable
contract.

Two matching geometry properties cover the bubble's box:

- `--lr-chat-message-bubble-padding` (default `var(--lr-space-m)`) — the bubble's padding.
- `--lr-chat-message-bubble-radius` (default `var(--lr-radius)`) — the bubble's corner radius.
  Bubble-only by design: `[part='collapse-button']` and `[part='retry-button']` keep reading the
  shared `--lr-radius`, so a rounder bubble never desyncs those controls from the rest of the
  library.

**Prefer these to a `::part(bubble)` padding/radius override.** A consumer `::part()` rule wins only
for the CSS properties it actually declares; changing padding or radius does not erase unrelated
role/status colors or borders. The named hooks are the stable, narrow geometry contract and can be
set once above a whole transcript. They are consumed as inline `var()` fallbacks rather than
declared on `:host`, so the host cannot shadow an inherited value.

Plus shared tokens `--lr-space-xs/-m`, `--lr-color-border`, `--lr-color-surface`,
`--lr-color-brand-quiet`, `--lr-color-brand`, `--lr-color-text-quiet`, `--lr-color-danger`,
`--lr-color-danger-quiet`, `--lr-radius`, `--lr-icon-button-size`, `--lr-focus-ring-*`,
`--lr-transition-fast`, and `--lr-transition-ambient` (default `1.8s ease-in-out`) — the
streaming-indicator pulse animation's cycle, the same shared compound token
`<lr-typing-indicator>` uses.

`[part=bubble]`'s background resolves through `--lr-color-surface`. If your own panel/container
background already maps to that same token, override `[part=bubble]`'s background explicitly (e.g.
via `::part(bubble)`) so message bubbles stay visually distinct from the surrounding panel.

> Retheming a bubble from outside `<lr-chat-message>` (e.g. per-thread or per-role colors)?
> Set `--lr-theme-*` on the ancestor wrapper, not `--lr-*` directly — see `llms/shared.md`'s
> "Theming and design tokens" section for why a `--lr-*` override on a wrapper only reaches that
> wrapper's _direct_ children, not a nested `<lr-*>` host's shadow DOM.

**Optional peer deps:** none. Internally renders a `<lr-live-region>` (a first-party sibling
component, auto-imported alongside this one, not an npm peer) for the status-transition
announcements described below.

```html
<lr-chat-message message-role="assistant" status="streaming">
  <span slot="avatar">🤖</span>
  <span slot="badges">gpt-5.4 · 1.2s</span>
  <lr-markdown content="Here's what I found…"></lr-markdown>
  <button slot="actions">Copy</button>
</lr-chat-message>
<script>
  document
    .querySelector("lr-chat-message")
    .addEventListener("lr-message-retry", () => resend());
</script>
```

Accessibility of `status`: the current status is always available as plain visible text
(`[part="status-text"]`), never color alone. A transition _to_ `"failed"`, or _from_ `"streaming"` to
`"sent"` (a stream finishing), is additionally announced through the internal `<lr-live-region>` —
`"failed"` announces assertively (`"Message failed to send."`), a streaming→sent completion announces
politely (`"Message complete."`) — so a screen-reader user not currently focused on this message
still learns about it. No other status transition is announced (e.g. `streaming`→`sending`, or
`sending`→`sent` without having passed through `streaming`, produce no announcement). This differs
from `<lr-typing-indicator>`'s deliberately simpler `role="status"` approach, appropriate there
since that component only ever announces once (its own mount); this component's `status` can flip
between several values across a single element's lifetime.

**Known gotchas:**

- mounting a message with `status="failed"` (or any other non-`"sent"` status) already set does
  **not** announce anything — only a genuine _later_ transition (`changed.get('status') !==
undefined`, i.e. not the very first update) triggers the live-region announcement.
- `lr-message-retry` carries `{ messageId?: string }`; the field is the component's `messageId` when set,
  and is omitted otherwise.
- the header/footer/avatar/badges/attachments/actions wrappers are shown/hidden via the `hidden`
  attribute, not conditional templating. Whether each slot currently has content is checked once via
  a light-DOM children scan on the very first update (`willUpdate`, gated on `!this.hasUpdated`) and
  thereafter only via each slot's own `slotchange` listener — content added directly with
  `appendChild` after first paint still triggers native `slotchange`, so this works transparently,
  but any code that manually re-parents already-slotted nodes without a real slot-assignment change
  won't refresh the corresponding wrapper's visibility.
- `messageRole` reflects as `message-role`; the shadow tree separately mirrors it to `data-role` for
  component styling. Never use `[role="user"]` as author state.

**Additional API surface:**

- `--lr-chat-message-system-color` — System-message text color. Default: `var(--lr-color-text-quiet)`.
- `--lr-chat-message-streaming-border-color` — Streaming bubble border. Default: `var(--lr-color-brand)`.
- `--lr-chat-message-failed-border-color` — Failed bubble border. Default: `var(--lr-color-danger)`.
- `--lr-chat-message-failed-bg` — Failed bubble fill. Default: `var(--lr-color-danger-quiet)`.
- `--lr-chat-message-footer-color` — Default footer text. Default: `var(--lr-color-text-quiet)`.
- `--lr-chat-message-user-footer-color` — User-message footer text. Default: `var(--lr-color-text)`.
- `--lr-chat-message-failed-footer-color` — Failed-message footer text. Default: `var(--lr-color-danger)`.
- `--lr-chat-message-indicator-color` — Default status indicator. Default: `var(--lr-color-text-quiet)`.
- `--lr-chat-message-streaming-indicator-color` — Streaming indicator. Default: `var(--lr-color-brand)`.
- `--lr-chat-message-failed-indicator-color` — Failed indicator. Default: `var(--lr-color-danger)`.
- `--lr-chat-message-failed-status-color` — Failed status text. Default: `var(--lr-color-danger)`.

---

## `lr-typing-indicator`

A purely presentational "assistant is responding" presence cue — no events, no interactivity. A
consumer mounts it while a response is being generated and removes (or hides) it once real content
arrives. Three visual variants share one component rather than three separate tags, since callers
pick between them along a single axis (how the surrounding surface wants the cue to read) and
nothing else about the component differs: `dots` (default, three dots with a staggered bounce — the
classic "typing…" affordance for a standalone status line), `pulse` (a single breathing dot, a
quieter cue for a tight space, e.g. next to an avatar), `cursor` (a blinking vertical bar, meant to
sit inline at the tail end of streamed text still being appended to).

**Properties:**

- `shape: TypingIndicatorShape = 'dots'` (`'dots' | 'pulse' | 'cursor'`, reflected)
- `label: string = ''` — caller-supplied accessible name. Empty or whitespace-only values use the
  localized “Thinking…” fallback; an explicit host `aria-label`, including `aria-label=""`, wins.
  The status is not re-announced on every animation frame, only on mount and on later label changes
- `size: TypingIndicatorSize = 'm'` (reflected) — visual size on the library-wide ladder;
  `TypingIndicatorSize` is an alias of the shared `LyraSize`, so it accepts `2xs`/`xs`/`s`/`m`/`l`/
  `xl` plus the `small`/`medium`/`large` spellings of `s`/`m`/`l`. A presence cue has three usefully
  distinguishable sizes rather than six, so the ladder renders as three tiers: `2xs`/`xs`/`s`/
  `small` are compact (for dense layouts, e.g. inline with a message bubble), `m`/`medium` is the
  default standalone status-line size, and `l`/`large`/`xl` are roomy. Every accepted value matches a
  rule — none is silently inert

**Events:** none — purely presentational.

**Slots:** none.

**CSS parts:** `base` (the decorative, `aria-hidden`, wrapper around the animated shape), `dot`
(each of the three dots in the `dots` variant), `pulse` (the single pulsing dot in the `pulse`
variant), `cursor` (the blinking bar in the `cursor` variant)

**Themeable custom properties:** `--lr-typing-dot-size` (default `var(--lr-space-s)`, i.e. `0.5rem`;
`0.375rem` on the compact tier, `var(--lr-space-m)` on the roomy one), `--lr-typing-gap` (default
`var(--lr-space-xs)`, i.e. `0.25rem`; `0.1875rem` compact, `var(--lr-space-s)` roomy),
`--lr-inline-cursor-width` (shared inline-cursor hook; default `var(--lr-size-0-125rem)`, compact
`0.09375rem`, roomy `0.1875rem`), `--lr-inline-cursor-height` (shared inline-cursor hook; default
`var(--lr-size-1em)`, unaffected by `size`),
`--lr-typing-dot-stagger-1` (default `600ms`, second dot), `--lr-typing-dot-stagger-2` (default
`1200ms`, third dot), and `--lr-typing-duration` (default `var(--lr-transition-ambient)`, i.e.
`1.8s ease-in-out`) — the compound duration/timing-function token every variant uses as its
animation cycle. `--lr-typing-duration` is a dedicated alias: it defaults to the library-wide
`--lr-transition-ambient` token (shared by every other ambient-looping component), but overriding
it retimes only this component, leaving `--lr-transition-ambient` itself — and anything else keyed
off it — untouched.

**Optional peer deps:** none.

```html
<lr-typing-indicator label="Assistant is responding…"></lr-typing-indicator>
<lr-typing-indicator shape="pulse" size="s"></lr-typing-indicator>
<lr-typing-indicator shape="cursor"></lr-typing-indicator>
<lr-typing-indicator
  style="--lr-typing-duration: 900ms ease-in-out; --lr-typing-dot-stagger-1: 300ms; --lr-typing-dot-stagger-2: 600ms"
></lr-typing-indicator>
```

Accessibility: since this indicator typically mounts and unmounts around a real generation lifecycle
(appears when a response starts, disappears once one arrives) rather than emitting a stream of
updates of its own, it does **not** route through `<lr-live-region>`/the internal `Announcer` —
that machinery exists to coalesce many rapidly-changing announcements into one, and there is only
ever a single announcement here: the mount itself. `role="status"` plus an accessible name derived
from `label` is set both as `aria-label` on the host _and_ as a visually-hidden text node
(`.sr-only`) in the shadow tree, so the name survives even if only one of the two is picked up by a
given assistive-tech/browser pairing. The animated shape itself is `aria-hidden="true"` — it's
decorative; `label` is the entire accessible content, nothing narrates individual animation frames.

**Known gotchas:**

- under `prefers-reduced-motion: reduce`, every variant collapses to its plain, fully-visible resting
  state (`opacity: 1`, no transform, `animation: none !important`) rather than freezing on whatever
  frame the animation happened to be on — notably relevant for `cursor`, which would otherwise risk
  freezing on its invisible ("off") blink half.
- `--lr-typing-duration` (like the `--lr-transition-ambient` token it aliases by default) is a
  compound `duration timing-function` value and cannot be divided with `calc()`. When retiming it,
  override both stagger properties alongside it to preserve the default one-third/two-thirds dot
  phasing, as shown above.
- the compact tier (`2xs`/`xs`/`s`/`small`) shrinks the dot size, gap, and cursor width, but **not**
  `--lr-inline-cursor-height` (still `1em` at any size) — the cursor bar's height is meant to track
  surrounding text size via `1em`, not the component's own `size` property.
- the six-step ladder collapses onto three rendered tiers here, so `2xs` and `s` look identical, as
  do `l` and `xl`. That is deliberate: six distinguishable dot diameters do not exist inside a `1em`
  line box, and accepting a value no selector matches would leave it quietly rendering at the
  default tier.

---

## `lr-chat-composer`

The message input for a chat/agent conversation surface: an auto-resizing `<textarea>` plus a
built-in send/stop button. Deliberately no label/hint/error chrome — a composite chat-input
control, not a labeled form field; wrap it in your own layout for that context. **Form-associated**
via the shared `FormAssociated` mixin (same shape as
`<lr-date-input>`) — `name: string = ''`, `value: string = ''`, `disabled: boolean = false`
(reflected), `required: boolean = false` (reflected) are all inherited, along with
`defaultValue: string = ''`, `customError: string | null = null` (`custom-error`), readonly
`effectiveDisabled: boolean`, `form: HTMLFormElement | null = null`, readonly `labels: NodeList`,
`validity: ValidityState`, `validationMessage: string`, and `willValidate: boolean`, plus
`getForm()`, `checkValidity()`/`reportValidity()`, and `setCustomValidity()`, so it participates in
native `<form>` submission/validation/reset like any other text control.

The inner textarea mirrors `required` through native `required`/`aria-required`. Its
`aria-invalid` remains false until the textarea has been blurred, then follows the host's
`ElementInternals` validity as `value` or `required` changes. A native validation attempt also
reveals the invalid state, and `form.reset()` clears the touched presentation.

**Properties (own):**

- `placeholder: string = ''`
- `minRows: number = 1` (attribute `min-rows`) — floored to `1` at render time
- `maxRows: number = 8` (attribute `max-rows`) — floored to at least `minRows`
- `status: ChatComposerStatus = 'idle'` (reflected) — `'idle' | 'sending' | 'streaming'`; drives the
  built-in button's icon/label (send vs. stop) and whether Enter still submits
- `frame: ChatComposerFrame = 'card'` (reflected) — container treatment, in the library-wide `frame`
  vocabulary (`'card' | 'plain'`; `ChatComposerFrame` is an alias of the shared `LyraFrame`).
  `'plain'` drops `[part="base"]`'s border, background, padding and corner radius so a composer
  docked inside a chat panel, dialog footer or toolbar that already draws its own border doesn't
  double it. Named `frame`, not `appearance`: `appearance` is the library's vocabulary for how a
  _control fills itself_, and one property name cannot mean both. The focus affordance is swapped,
  not dropped — see **Known gotchas**
- `submitOnEnter: boolean = true` (reflected, attribute `submit-on-enter`) — when `false`, Enter
  always inserts a newline instead of submitting
- `submitDisabled: boolean = false` (reflected, attribute `submit-disabled`) — consumer-controlled
  validation gate; while idle, disables the built-in Send button and suppresses Enter/click
  submission without disabling the textarea or a busy-state Stop action
- `stoppable: boolean = true` (reflected) — when false, busy states keep a disabled Send button
  instead of exposing a Stop action
- `readOnly: boolean = false` (attribute `readonly`, reflected) — native read-only editing state;
  intrinsic required/length constraints are barred while set
- `minLength?: number` (attribute `minlength`) and `maxLength?: number` (attribute `maxlength`) —
  forwarded native text-length constraints; invalid/unset values impose no bound
- `accessibleLabel: string | null = null` (attribute `aria-label`) — names the internal textarea;
  wins over placeholder and the localized composer label
- `spellcheck: boolean = true` — forwarded to the internal `<textarea>`
- `autocapitalize: string = ''` — forwarded to the internal `<textarea>`; empty omits the attribute
- `autocorrect: boolean = true` — forwarded to the internal `<textarea>` and reflected canonically
  as `autocorrect="on"|"off"`; JavaScript writes also accept legacy `'off'`/`'false'` strings
- `wrap: 'hard' | 'soft' | 'off' = 'soft'`, `autocomplete: string = ''`, `inputMode: string = ''`
  (attribute `inputmode`), and `enterKeyHint: string = ''` (attribute `enterkeyhint`) — forwarded to
  the native textarea
- `input: HTMLTextAreaElement | null` — readonly reference to the rendered native textarea
- `selectionStart: number | null`, `selectionEnd: number | null`, and `selectionDirection:
'forward' | 'backward' | 'none' | null` — native selection getters/setters

**Methods (own):** `focus(options?)`, `blur()`, `select()`, `setSelectionRange()`, and
`setRangeText()` forward to the textarea; `click()` focuses it when the composer is not effectively
disabled. `setRangeText()` synchronizes reactive/form value and auto-sizing.
`checkValidity()`/`reportValidity()` remain inherited; `resetValidity()` clears consumer custom
validity and recomputes the current intrinsic constraints.

**Events:**

- `input` / `change` — one realm-correct native event relayed from the textarea per native edit or
  commit; `focus` / `blur` similarly preserve `relatedTarget`
- `lr-input` (`detail: { value }`) — fired on every user-driven edit of the textarea, not a
  programmatic `.value` assignment
- `lr-change` (`detail: { value }`) — paired with the native `change` event
- `lr-submit` (`detail: { value }`) — fired by Enter (per `submit-on-enter`) or the built-in
  button while `status="idle"` and `submitDisabled` is false. `detail.value` is always the exact, untrimmed current value;
  trimming is left to the consumer. Submitting does **not** clear `value`
- `lr-stop` (no detail) — fired by the built-in button while `status` is `"sending"` or
  `"streaming"`
- `lr-blur` / `lr-focus` (`detail: null`) — prefixed notifications paired with native focus events
- `lr-invalid` (no detail) — one bubbling/composed, cancelable alias when native validity fails;
  preventing it also prevents the native `invalid` event that produced it

**Slots:** `start` (content before the textarea, e.g. an attach-file trigger button), `end`
(overrides the built-in send/stop button entirely when it has assigned content), `chips` (an
attachment tray rendered above the input row).

**CSS parts:** `base`, `chips`, `row`, `start`, `textarea`, `end`, `send-glyph`, `stop-glyph`,
`action-button`

**Themeable custom properties:** `--lr-chat-composer-busy-bg` (default `var(--lr-color-text-quiet)`)
— `[part="action-button"]`'s background while `status` is `"sending"` or `"streaming"` (the busy/stop
treatment). Scoped separately from the shared `--lr-color-text-quiet` token, which
`[part="textarea"]`'s placeholder color also reads — overriding this cssprop recolors only the busy
button, not the placeholder too (the same shared-token-collision fix `<lr-chat-message>`'s own
user-bubble background pair documents). Plus shared tokens `--lr-space-xs`, `--lr-space-s`,
`--lr-color-border`, `--lr-color-surface`, `--lr-color-brand`, `--lr-color-on-brand`,
`--lr-color-text-quiet`, `--lr-radius`, `--lr-icon-button-size`, `--lr-transition-fast`,
`--lr-opacity-disabled`, `--lr-focus-ring-width`, `--lr-focus-ring-color`, `--lr-focus-ring-offset`.

**Optional peer deps:** none.

```html
<lr-chat-composer
  id="composer"
  name="message"
  placeholder="Message the assistant…"
  min-rows="1"
  max-rows="8"
></lr-chat-composer>
<script type="module">
  const composer = document.getElementById("composer");
  composer.addEventListener("lr-submit", (e) => {
    sendMessage(e.detail.value);
    composer.value = ""; // the composer never clears itself
    composer.status = "sending";
  });
  composer.addEventListener("lr-stop", () => stopGeneration());
</script>
```

Auto-resize (`resizeTextarea()`) reads the textarea's own _computed_ line-height/padding/border at
call time rather than assuming a fixed px-per-row constant, so it stays correct under a consumer's
own font-size/line-height overrides; it grows between `min-rows` and `max-rows`, then switches to
internal scrolling (`overflow-y: auto`) past `max-rows`. A `ResizeObserver` on the textarea itself
also re-runs this fit (one animation frame later, to avoid a `ResizeObserver`-loop console error)
whenever the textarea's own _width_ changes — a sidebar collapsing, a responsive breakpoint, a
window resize — even though `value`/`min-rows`/`max-rows` never did, since the same text now wraps
across a different number of lines. Enter-to-send only fires while
`submit-on-enter` is `true` (the default): plain Enter submits and prevents the default newline;
Shift+Enter always inserts a newline regardless of `submit-on-enter`; an IME composition step
(checked via `isComposing`, with `keyCode === 229` as a defense-in-depth fallback for browsers that
report `isComposing` inconsistently) is never treated as a submit trigger; and while `status` isn't
`"idle"`, Enter is left alone to insert a newline instead of resubmitting — the textarea itself is
**not** auto-disabled during `sending`/`streaming`, so a user can keep composing their next message
while a previous one is in flight. While idle, `submitDisabled` suppresses Enter/click submission
and disables only the built-in Send button; editing and busy-state Stop behavior remain available.

**Known gotchas:**

- `lr-submit` never clears `value` — the consumer must clear it once a submission is actually
  accepted, so a failed send can leave the text in place for retry.
- While `status !== 'idle'`, only the built-in button's behavior changes (it emits `lr-stop`
  instead of `lr-submit`); the textarea keeps accepting input and Enter keeps inserting newlines
  rather than being blocked.
- Auto-resize requires a concrete, unitless `line-height` on the textarea (the component sets
  `line-height: 1.5` in its own styles) — the UA default of `normal` has no single resolved px
  figure to measure rows against, so overriding `line-height` to a keyword breaks row sizing.
- The `end` slot fully replaces the built-in action button rather than rendering alongside it —
  once it has assigned content, the library's send/stop icon, its `aria-label`, and its
  `status`-driven busy styling all disappear, so a custom end control needs its own send/stop
  handling.
- `[part="chips"]`/`[part="start"]` are hidden via a JS-tracked `[hidden]` attribute rather than a
  CSS `:empty` selector, because each always contains a literal `<slot>` child regardless of
  assigned content.
- Under `frame="card"` the only focus affordance is a border-color shift on `[part="base"]`
  (the internal `<textarea>` sets `outline: none`). `frame="plain"` removes that border, so it
  swaps in a different affordance rather than losing focus visibility: an underline across the whole
  input row, drawn as an inset `box-shadow` from `--lr-focus-ring-width`/`--lr-focus-ring-color` so
  it costs no layout. If you restyle `[part="base"]` under `plain`, keep a focus indicator.

---

## `lr-stream-status`

A compact status indicator for a single streaming connection (SSE, WebSocket, long-poll, …), with
built-in heartbeat-aware stall detection. First-party invention (no Web Awesome equivalent). The
host drives `connectionState` for `idle`/`connecting`/`streaming`, and calls the imperative
`recordActivity()` method on every _semantic_ frame received while streaming — a real content
chunk, never a transport-level keep-alive ping. This component has no payload-inspection logic of
its own: "ignore heartbeats" is entirely call-site discipline, which is exactly why a connection
that's only sending keep-alives (no real content) for longer than `stall-threshold-ms` correctly
reads as stalled.

**Properties:**

- `connectionState: StreamConnectionState = 'idle'` (attribute `connection-state`, reflected) —
  host-owned transport state (`'idle' | 'connecting' | 'streaming'`). Invalid attribute or property
  writes normalize to `idle`.
- `phase: LyraStreamPhase` (readonly) — effective state: `connectionState`, or component-owned
  `'stalled'` while an active stream has exceeded its inactivity threshold
- `stallThresholdMs: number = 10000` (attribute `stall-threshold-ms`) — how long `phase` may stay
  `'streaming'` with no `recordActivity()` call before the component auto-transitions to
  `'stalled'`. A non-finite or `<= 0` value disables the stall timer entirely (arming becomes a
  no-op, so the phase will never auto-stall). Changing this value while already `'streaming'`
  re-arms the timer immediately against the new value, rather than waiting for the next
  `recordActivity()` call or phase change.

**Methods:**

- `recordActivity(): void` — call on every semantic (non-heartbeat) frame received while
  streaming.
  - While `phase === 'streaming'`: (re)arms the stall timer, pushing the stall deadline
    `stallThresholdMs` further out.
  - While `phase === 'stalled'`: recovers — the effective phase becomes `'streaming'` again (firing
    `lr-recover` and arming the timer fresh, via the same transition handling a direct host
    transport transition would also go through).
  - While `phase` is `'idle'` or `'connecting'`: a no-op. Safe to call defensively before formally
    flipping to `'streaming'`; it never throws or starts a timer early.
- `markStalled(): void` — installs the component-owned stalled override for an active streaming
  connection; no-op in other transport states or when already stalled

**Events:** `lr-stall` (`detail: null`) — fires whenever the effective phase transitions into
`'stalled'`, whether timer-driven or via `markStalled()`. `lr-recover` (`detail: null`) — fires
whenever the effective phase transitions out of `'stalled'`, whether via `recordActivity()` or a
host transport transition. Neither fires for a same-value
reassignment, and neither fires for whatever phase the element happens to _mount_ with — only a
later change counts as a transition.

**Slots:** default (custom copy shown only while the readonly `phase` is `'stalled'`, e.g. "Taking longer than
usual…" — falls back to a built-in default message when nothing is slotted), `actions` (a
stop/retry button row; always present in the template regardless of `phase` — its wrapper's
visibility is driven purely by whether anything is slotted into it, not by `phase`)

**CSS parts:** `base`, `indicator`, `phase` (persistent localized effective-state text), `message`,
`actions`

**Themeable custom properties:** shared tokens only — `--lr-color-text-quiet` (idle dot color),
`--lr-color-brand` (connecting/streaming dot color), `--lr-color-warning` (stalled dot color,
message text color, stalled border), `--lr-color-warning-quiet` (stalled background tint),
`--lr-space-s` / `--lr-space-xs` (base gap, stalled padding, actions gap), `--lr-radius`
(base corner radius), `--lr-transition-base` (background/border-color transitions and the
dot's color/opacity transitions), and `--lr-transition-ambient` (the streaming pulse cycle).
The phase defaults flow through `--lr-stream-status-dot-color` and
`--lr-stream-status-dot-opacity`; setting either custom property on the element or an ancestor
wins through the shadow cascade and is the supported per-instance override. The stalled row's own
longhands are indirected the same way: `--lr-stream-status-stalled-bg` (falls back to
`--lr-color-warning-quiet`) and `--lr-stream-status-stalled-border-color` (falls back to
`--lr-color-warning`) retheme the `base` part's background/border while stalled, and
`--lr-stream-status-message-color` (also falling back to `--lr-color-warning`) retheme the
`message` part's text color independently of the border — the two currently share a default value
but are separate hooks, so overriding one never moves the other.

**Optional peer deps:** none.

```html
<lr-stream-status connection-state="streaming" stall-threshold-ms="8000">
  <span slot="actions"><button>Stop</button></span>
</lr-stream-status>
```

```ts
const status = document.querySelector("lr-stream-status")!;
status.addEventListener("lr-stall", () => console.warn("stream stalled"));
status.addEventListener("lr-recover", () => console.info("stream recovered"));

// on every real content chunk from the transport (never on a keep-alive ping):
status.recordActivity();
```

Internally, the inactivity timer runs only while `phase === 'streaming'`. It's (re)armed whenever
`connectionState` transitions to `'streaming'` (or `recordActivity()` recovers from
`'stalled'`) and on every subsequent `recordActivity()` call while already streaming; it's disarmed
the instant the effective phase becomes anything else, including a host-driven transport transition away from
`'streaming'` — so a stale timer can never fire a stall transition after the host has already moved
on. Phase transitions into/out of `'stalled'` are announced through an internal
`<lr-live-region>` rather than a hand-rolled `aria-live` region: entering `'stalled'` announces
"Connection stalled." with `mode="assertive"` (a stall can need the user's attention before they
give up and navigate away). Leaving `'stalled'` always announces with `mode="polite"` (good news
doesn't need to interrupt), but the _wording_ depends on the destination phase: "Connection
restored." only when leaving `'stalled'` for `'streaming'` (a genuine recovery, typically via
`recordActivity()`); a neutral "No longer stalled." when the destination is `'idle'`/`'connecting'`
instead (the host gave up on the stream, which is not the same thing as it recovering — a
screen-reader user must not be told the opposite of what a sighted user sees). Calling
`recordActivity()` itself never announces anything, no
matter how often the host calls it — only the phase _transition_ announces, exactly once. The
decorative indicator dot is `aria-hidden` (a color/motion cue only) and only pulses while
`connection-state="streaming"` and not stalled; `'stalled'` is styled as a warning tone, not danger, since a stall is usually
recoverable — a host that wants to escalate after N stalls can scope its own CSS off
the `lr-stall` event, or stop rendering this component and show its own danger-styled error state
instead. The pulse animation is suppressed under `prefers-reduced-motion: reduce`.

**Known gotchas:**

- `recordActivity()` is a plain instance method, not a reactive property — there's nothing to bind
  to in a template; call it directly from streaming/application code on every real chunk received.
- Never call `recordActivity()` for a heartbeat/keep-alive ping. This component has no
  payload-inspection logic of its own, so a connection that's only sending pings (no real content)
  for longer than `stall-threshold-ms` is _supposed_ to read as stalled — that's the entire
  point of the API.
- Setting `stallThresholdMs` to `0`, a negative number, or a non-finite value disables the stall
  timer outright; the component stays `'streaming'` until the host changes `connectionState` or
  explicitly calls `markStalled()`.
- `phase` is readonly. Call `markStalled()` for a semantic stall detected outside the inactivity
  timer; writing an own `phase` property is unsupported and cannot replace component-owned state.
- reconnecting the element while still `phase === 'streaming'` (e.g. a drag-and-drop reparent that
  keeps the same instance) automatically re-arms the stall timer in `connectedCallback` —
  `disconnectedCallback` always disarms it, and disconnect/reconnect fire back-to-back with no
  `updated()` cycle in between, so nothing else would otherwise notice.
- The `actions` slot's wrapper is always present in the DOM and toggled with the `hidden` attribute
  based on slotted content, not gated by `phase` — content placed there is visible regardless of
  the current phase.

---

## `lr-conversation-item`

A selectable row representing one chat session in a history sidebar list. Usable standalone or as the
`renderItem()` payload of `<lr-virtual-list>`; has no dependency on that (or any) other component.
First-party invention (no Web Awesome equivalent).

**Properties:**

- `conversationId: string = ''` (attribute `conversation-id`) — stable domain identity carried by
  both selection and rename details. Native `id` remains ordinary document/CSS/ARIA identity.
- `label: string = ''` — the session's visible label. Falls back to "Untitled conversation" when
  empty (display only — the property itself is never mutated by that fallback). Native `title`
  remains available for tooltip semantics.
- `excerpt: string = ''` — a short preview snippet of the last message. Omit for no excerpt line.
  Ignored entirely once the `excerpt` slot has assigned content.
- `timestamp?: LyraTimestamp` (attribute: false) — accepts a `Date`, ISO/date string, or epoch-ms
  number; invalid and TimeClip-out-of-range input is treated as unset (no `<time>` rendered).
- `formatTimestamp?: (date: Date) => string` (attribute: false) — overrides the default absolute-time
  rendering (clock time for same-day timestamps, otherwise a calendar date). Not a fuzzy "2 hours ago"
  relative string — bucketed relative grouping is a list-level concern, not this row's job.
- `active: boolean = false` (reflected) — whether this is the currently-selected/open session; drives
  the brand-quiet background treatment.
- `renamable: boolean = true` (reflected) — whether inline-rename is available at all. When `false`, the
  rename button never renders and the row can never enter its editing state; flipping it to `false`
  while a rename is already in progress cancels that edit (discards the draft, like Escape) rather
  than leaving it stranded and still committable.
- `compact: boolean = false` (reflected) — tighter row padding and gaps, for the dense history
  sidebars these rows usually render in (same convention as `lr-empty`'s `compact`). Tightens
  `[part='base']`'s padding to `var(--lr-space-xs) var(--lr-space-s)` and its gap to
  `var(--lr-space-2xs)`, and collapses `[part='content']`'s inter-line gap to `0`. Deliberately
  changes nothing else: it does **not** shrink `[part='rename-button']` below the shared
  `--lr-icon-button-size` target floor, hide the excerpt, or reduce the excerpt/timestamp font
  sizes — so a row carrying a rename button or slotted `actions` still floors at roughly that icon
  size plus the compact padding, while a row with `renamable=false` and no actions collapses much
  further.
- `spellcheck: boolean = true` — forwarded to the in-place rename `<input>`; `spellcheck="false"` is
  parsed as false (not Lit's default boolean-attribute behavior)
- `autocapitalize: string = ''` — forwarded to the in-place rename `<input>`; empty omits the attribute
- `autocorrect: boolean = true` — forwarded canonically as `autocorrect="on"|"off"`; JavaScript
  writes also accept legacy `'off'`/`'false'` strings and normalize reads to boolean.

**Methods:** `click()` activates the selectable row like its internal button; while an inline rename
is active, it forwards to the label input instead and does not re-select the conversation.

**Events:** `lr-select` (`detail: { conversationId }`; fires from the selectable region on click or
Enter/Space while not renaming), `lr-rename` (`detail: { conversationId, label }`; a controlled
rename request that never mutates `label`, and is omitted for an empty or unchanged trimmed draft),
plus bubbling/composed `blur` and `focus` with `null` detail relayed from the rename input.

**Slots:**

- `actions` — overflow/icon-button controls rendered at the trailing edge of the row (e.g. a
  pin/delete control); only visually shown once it actually has assigned elements. The only slot that
  may hold focusable content.
- `start` — non-interactive leading content (avatar, purpose icon, status dot), rendered inside the
  selectable region before the label/excerpt content.
- `content` — replaces the built-in label + excerpt + meta content area with host-supplied
  non-interactive row content.
- `excerpt` — full override of the excerpt presentation (e.g. a search-hit snippet with `<mark>`);
  wins over the `excerpt` property whenever it has assigned content.
- `meta` — small, non-focusable structured fields below the label/excerpt (a day label, cost, request
  count); entirely app-supplied, this component computes none of it.

`start`/`content`/`excerpt`/`meta` must all stay non-focusable — see the `role="button"` note below.

**CSS parts:** `base`, `active-indicator` (decorative, rendered only while `active`),
`select-button`, `start`, `content`, `label`, `label-input`, `rename-button`, `excerpt`, `meta`, `timestamp`,
`actions`

**Themeable custom properties:** `--lr-conversation-item-active-bg` (default
`var(--lr-color-brand-quiet)`) — the row's background while `active`. `--lr-conversation-item-active-color`
(default `var(--lr-color-text)`) — the text color of `[part='excerpt']` and `[part='timestamp']`
while `active`. Both are declared as inline `var()` fallbacks at the point of use and never on
`:host`, so either can be set on the element _or on any ancestor_ (a thread-list wrapper, a page
theme layer); `::part(base)[active]` is not valid CSS — Shadow Parts forbids an attribute selector
after `::part()` — so the only previous lever was overriding the library-wide `--lr-color-brand-quiet`
token and repainting everything else reading it. Unset, each falls back to exactly the token its rule
used before.

**These two are a contrast-sensitive pair — override them together, never one alone.** The
`-active-color` hook exists precisely because the quiet text tone only reaches about 4.25:1 against
the default active background; keep any override at 4.5:1 or better against it. And note that
`[part='label']` is _not_ restyled by the pair — it keeps `--lr-color-text` regardless — so a dark
custom active background needs its own label color set alongside them, or the label drops below
contrast while the excerpt stays legible.

`--lr-conversation-item-active-indicator-color` (default `var(--lr-color-brand)`) controls the
decorative `active-indicator` part's color. `--lr-conversation-item-active-indicator-width`
(default `var(--lr-size-2px)`) controls its inline width. `--lr-conversation-item-active-indicator-inset-inline`
(default `0 auto`) controls its logical inline insets; set `auto 0` to move the indicator to
inline-end. The indicator is `aria-hidden`, occupies the full row block-size, and is absent while
the row is inactive.

`--lr-conversation-item-compact-padding` (default `var(--lr-space-xs) var(--lr-space-s)`) —
`[part='base']`'s padding while `compact`. `--lr-conversation-item-compact-gap` (default
`var(--lr-space-2xs)`) — `[part='base']`'s gap while `compact`. Like the active-state pair, both are
inline `var()` fallbacks at the point of use and never declared on `:host`, so a surrounding list can
retune every row at once from an ancestor. `[part='content']`'s gap collapses to a flat `0` under
`compact` with no hatch of its own — there is no smaller step left to retune to. `:host([compact])
[part='base']` is ordered _before_ `:host([active]) [part='base']` (equal specificity), so a row that
is both compact and active keeps the active background and the promoted excerpt/timestamp contrast.

Plus shared tokens — `--lr-space-xs/-s/-m`, `--lr-radius`,
`--lr-transition-fast`, `--lr-color-text/-text-quiet/-brand/-brand-quiet/-surface`,
`--lr-focus-ring-width/-color/-offset`, `--lr-icon-button-size`.

**Optional peer deps:** none.

```html
<lr-conversation-item
  conversation-id="sess_123"
  label="Q3 roadmap planning"
  excerpt="Let's revisit the timeline for the launch…"
  .timestamp=${session.updatedAt}
  ?active=${session.id === currentSessionId}
  @lr-select=${(e) => openSession(e.detail.conversationId)}
  @lr-rename=${(e) => renameSession(e.detail.conversationId, e.detail.label)}
>
  <button slot="actions" aria-label="Delete conversation">✕</button>
</lr-conversation-item>
```

`role="button"` lives on `[part="select-button"]`, so the row has
valid semantics both standalone and inside a larger history-list layout: it activates one current
session rather than being a listbox option, so it requires no particular owner role. Selection is
conveyed via `aria-current="true"` while `active`, not `aria-selected`. Because `role="button"`
forbids focusable descendants (axe-core's `nested-interactive` rule), the rename button and the
`actions` slot are rendered as DOM _siblings_ of `[part="select-button"]` inside `[part="base"]`, not nested
inside it — the same constraint the in-place rename `<input>` runs into one level deeper, which is
why `[part="select-button"]` sheds its `role`/`tabindex`/`aria-current`/`aria-label` entirely for the
duration of an edit rather than just visually swapping content (a row mid-edit _is_ a text field).

**Known gotchas:**

- Both `lr-select` and `lr-rename` carry the stable `conversationId`; do not overload native `id`
  as domain identity.
- Renaming is a controlled interaction: committing `lr-rename` never updates `label` locally: the
  consumer must apply the new label once it's actually persisted.
- An empty or unchanged (post-trim) rename draft is treated as an implicit cancel — no `lr-rename`
  fires, and the row silently reverts to showing `label`.
- Rename is triggered only by the dedicated pencil-icon button, never a double-click on the label —
  double-click has no keyboard/screen-reader equivalent and would also swallow the row's own
  single-click `lr-select`.
- While renaming, `[part="select-button"]` has no `role`/`tabindex`/`aria-current`/`aria-label` at all — a
  screen reader briefly stops announcing it as a button for the duration of the edit.
- Setting `renamable = false` mid-rename silently discards the in-progress draft (no `lr-rename`
  fires) — a consumer toggling `renamable` off (e.g. in response to some other row entering rename
  mode) should not expect the previous edit to be committed first.
- `compact` is a spacing knob only — it never lowers the rename button's `--lr-icon-button-size`
  floor. A compact row that still shows a rename button (or slotted `actions` at the same floor)
  therefore bottoms out at roughly that icon size plus the compact padding, not at the text height.
  Lowering `--lr-icon-button-size` at an ancestor is the explicit, informed opt-out of the
  target-size floor; a density flag deliberately won't do it silently on your behalf.

---

## `lr-model-select`

A provider/model picker that renders as a closed dropdown when a fixed `catalog` is available, or as a
filterable free-text combobox when it isn't (or when `allow-custom` explicitly permits typing something
outside the catalog). Form-associated (hand-rolled internals via `attachInternals()` directly, not the
shared `FormAssociated` mixin — same reasoning as `lr-combobox`/`lr-select`: see the shared-foundation
notes). Built on the same trigger-button/`aria-activedescendant` listbox technique `<lr-select>` uses
and the filter-as-you-type suggestion-popup technique `<lr-combobox>` uses, without composing either
element. First-party invention (no Web Awesome equivalent).
Session-history/autofill restoration synchronously restores the model id and form entry without
emitting `lr-change`.

When `catalog`/`allowCustom` replaces a focused trigger with the free-text input or vice versa,
focus follows the available replacement. If the new owner is disabled or inert, focus returns to
the available element that led into the picker, or to the stable `form-control` owner when no
return target exists. This repair emits no action/value events and never overrides a newer external
focus move.

**Exported types:**

- `LyraCatalogEntry { id: string; label: string }` — the shared minimum row vocabulary.
- `LyraCatalog<T extends LyraCatalogEntry = LyraCatalogEntry> = readonly string[] | readonly T[]`
  — a homogeneous catalog shared by model-select, voice-picker, and composed controls. String
  shorthand uses the same string for both id and label; readonly tuples/arrays are accepted. Ids
  must be nonempty and unique: malformed rows and later duplicates are omitted first-wins before
  mode selection, rendering, focus reconciliation, selection, or preview lookup.
- `LyraModelCatalogEntry extends LyraCatalogEntry { icon?: string }` — one model row. An
  optional literal `icon` (for example, an emoji) renders decoratively before `label`; it does not
  change the option's accessible name.

**Properties:**

- `provider: string = ''` — informational only (e.g. `'ollama'`); rendered as a small leading badge.
- `catalog?: LyraCatalog<LyraModelCatalogEntry>` (attribute: false) — the full model list. Omit (or
  leave empty) to fall back to plain free-text entry. Ids use the shared unique, nonempty,
  first-wins catalog rule above. The array is clone-owned, bounded, and frozen; reassign a new
  catalog array after changing its rows.
- `allowCustom: boolean = false` (attribute `allow-custom`, reflected) — let the user type/commit a
  value that isn't in `catalog`, even when `catalog` is non-empty.
- `label: string = ''` — optional visible title above the control, rendered alongside the `label`
  slot in a `[part="form-control-label"]` `<label>` paired with the active control's id. A host
  `aria-label` remains the authoritative override by presence; otherwise either visible-label
  source names the control through the native label association. Leaving both sources empty keeps
  the original `aria-label || placeholder || 'Model'` accessible-name chain untouched.
- `hint: string = ''` — hint text below the field. Unset (the default): no hint chrome renders.
- `errorText: string = ''` (attribute `error-text`) — error text below the field (overridden by
  slotted `error` content). Unset (the default): no error chrome renders.
- `placeholder: string = ''`
- `spellcheck: boolean = true` — forwarded to the free-text mode's native `<input>`; no effect in
  closed-dropdown mode (no native text input there). `spellcheck="false"` is parsed as `false` (a
  custom converter, not Lit's presence-based `type: Boolean`, so the literal attribute string is
  honored — matches `<lr-textarea>`/`<lr-date-input>`).
- `autocapitalize: string = ''` — forwarded to the free-text mode's native `<input>`; empty omits
  the attribute.
- `autoCorrect: string = ''` (attribute `autocorrect`) — forwarded to the free-text mode's native
  `<input>`'s own `autocorrect` (Safari/WebKit-specific); empty omits the attribute. Named
  `autoCorrect` in JS purely to dodge a `lib.dom.d.ts` typing collision — the wire attribute is
  still plain `autocorrect`.
- `autocomplete: string = 'off'`, `inputMode: string = ''` (attribute `inputmode`), and
  `enterKeyHint: string = ''` (attribute `enterkeyhint`) — forwarded to the free-text input;
  they have no effect in closed-dropdown mode
- `name: string = ''` (reflected)
- `disabled: boolean = false` (reflected)
- `required: boolean = false` (reflected — enforced via `internals.setValidity()`)
- `open: boolean = false` (reflected)
- `size: LyraSize = 'm'` (reflected) — visual size on the library-wide ladder: `2xs`/`xs`/`s`/`m`/
  `l`/`xl`, plus `small`/`medium`/`large` as accepted spellings of `s`/`m`/`l`, so markup migrated
  from Web Awesome or Shoelace needs no attribute rewrite. It scales
  `[part="trigger"]`/`[part="combobox"]`'s padding/min-height/font-size through the shared
  `--lr-form-control-*` knobs, so a model select sits at the same height as the `lr-select`,
  `lr-input` or `lr-button` beside it in a toolbar row at every tier, plus `[part="expand-icon"]`'s
  box size (see the themeable custom properties below).
- `value: string` — getter/setter (hand-rolled, not the `FormAssociated` mixin); the current model id,
  `''` when nothing is selected. Writing it calls `internals.setFormValue()` synchronously. A named,
  untouched model-select contributes `''` to `FormData` instead of omitting its key.
- `defaultValue: string = ''` (attribute `value`, reflected) — the current reset default. The live
  `value` is non-reflecting and dirty, so changing the default/attribute cannot overwrite it until
  `form.reset()` restores the current default.
- `customError: string | null = null` (attribute `custom-error`) — reflected consumer validation
  message.
- `form: HTMLFormElement | null = null` — browser-resolved owner (and an assignable external owner);
  readonly `labels: NodeList`, `validity: ValidityState`, `validationMessage: string`,
  `willValidate: boolean`, and `effectiveDisabled: boolean` expose the native FACE state.
- `input: HTMLInputElement | null` — readonly native input reference in free-text mode; `null` in
  closed-dropdown mode and before render.
- `selectionStart: number | null`, `selectionEnd: number | null`, and `selectionDirection:
LyraModelSelectSelectionDirection | null` — native caret/selection state in free-text mode;
  getters return `null` and setters are inert when no text input is rendered.

**Methods:** `click()` (override) — forwards to whichever internal control the active mode renders,
since `HTMLElement.prototype.click()` is otherwise a no-op on a custom element with no native click
semantics of its own (mirrors `<lr-button>`'s identical host `click()` forwarding, so a generic
form-automation helper or another component calling `.click()` on the host actually opens the picker
instead of silently doing nothing). Closed-dropdown mode forwards a real `.click()` to the trigger
`<button>`, whose own `@click` handler opens it. Free-text mode forwards `.click()` to the combobox
`<input>`, then explicitly calls `.focus()`: unlike a genuine pointer click,
`HTMLElement.click()` never moves focus (that's a `mousedown` side effect the browser applies only
to real pointer interaction), and this mode's open behavior is wired to the input's `focus` event
(`onInputFocus`), not a `click` handler on the input itself.

`focus(options?)` and `blur()` forward to the active semantic control in either rendering mode.
If a catalog/`allowCustom` update replaces that control while it owns focus, focus follows from the
closed trigger to the free-text input (or back again). A newer external focus destination is never
overridden.

`select()` and `setSelectionRange()` forward to the native input in free-text mode.
`setRangeText()` applies the native range edit and silently synchronizes `value`, the form entry,
and validity; none of these editing methods has an effect in closed-dropdown mode or before render.

`getForm()` returns the browser-resolved owning form. `checkValidity()` / `reportValidity()` behave
as on any form-associated control.
`setCustomValidity(message: string)` is the standard channel for a server-side rejection ("that
model was retired by the provider") that no client-side constraint can express: a non-empty
`message` raises `customError` and becomes `validationMessage`, so the control fails
`checkValidity()`, blocks submission, and matches `:state(invalid)`; `''` clears it. Clearing
restores the control's own computed validity rather than forcing it valid — a `required` picker with
no value stays `valueMissing` — and the custom error survives every intrinsic recomputation in
between (each `value`/`required` change) and a `form.reset()`, matching a native control. The
message is caller-supplied content, used verbatim and never localized.

**Mode switching:** `closedMode` (private) is `true` whenever `normalizedCatalog.length > 0 &&
!allowCustom` — a non-empty `catalog` with `allowCustom` left `false` renders the closed dropdown
trigger-button UI (`[part="trigger"]`, `role="combobox"` on a `<button>`, no typing). Any other
combination (`catalog` empty/unset, or `allowCustom` true) renders the free-text `<input>` UI
(`[part="combobox"]`/`[part="combobox-input"]`) with live substring filtering against the catalog (id or
label, case-insensitive). The mode is re-evaluated on every render, so toggling `allowCustom` or clearing
`catalog` at runtime switches modes live, repositioning the shared `[part="listbox"]` popover against
whichever element is the active anchor. Replacing `catalog` while free-text mode remains open
refilters suggestions without erasing the user's current draft; controlled `value` changes and
actual mode switches still rebase the input to the committed value.

A `value` that isn't present in `catalog` (e.g. a model id saved from a provider whose live catalog has
since changed) is never silently dropped: it's appended to the rendered option list as a synthetic,
visually-distinct row (dashed border, italic label, "not in catalog" badge) computed fresh from
`catalog` + `value` on every access, without ever mutating the `catalog` property itself.

**Events:**

- `lr-change` (`detail: { value: string; inCatalog: boolean }` — fired when a value is selected
  from the listbox or committed in free-text mode; `inCatalog` reflects whether that value was
  actually present in `normalizedCatalog`, so a consumer can flag a freshly-typed custom value
  distinctly from a real catalog pick)
- `change` (`Event`, no detail) — an owner-realm native event fired on a committed value alongside
  `lr-change`, mirroring `<lr-select>`/`<lr-combobox>`'s value-change pair so native form bindings
  and framework `v-model` handlers behave consistently across the picker family.
- `input` — a payload-preserving owner-realm `InputEvent` for each free-text edit, and a plain
  owner-realm `Event` fired immediately before `change` when either mode commits a value.
- `blur` / `focus` (no detail) — one owner-realm native `FocusEvent` re-dispatched from the active
  control in either mode (the closed trigger button or free-text input), retaining `relatedTarget`
  and bubbling/composed unlike the shadow-internal original.
- `lr-blur` and `lr-focus` (no detail) — prefixed compatibility aliases, each fired immediately
  after its unprefixed counterpart.
- `lr-invalid` (no detail) — the single bubbling/composed alias of a failed native validity check.

**Slots:** `label` (custom visible label content), `hint` (custom hint content), `error` (custom
error content).

**The required marker and barred validity.** With `required` set and either visible-label source
non-empty,
`[part="form-control-label"]` paints the library's shared required marker — the same `::after` rule
every labelled control in the library uses, so `--lr-form-control-required-content`,
`--lr-form-control-required-color` and `--lr-form-control-required-offset` retune or suppress it here
exactly as they do on `lr-input` (see `llms/shared.md` → "The required-field marker"). With no visible label there
is nothing to mark and no stray glyph is rendered. Correspondingly, while the picker is barred from
constraint validation — its own `disabled`, or an ancestor `<fieldset disabled>`; this control has no
`readonly` — it reports no violation and publishes neither `:state(invalid)` nor
`:state(user-invalid)`, matching native `:invalid`. `required`/`optional` keep publishing.

**CSS parts:** `form-control` (the complete label, control, hint, error, and listbox frame),
`form-control-label` (the `<label>` element containing the `label` property and slot), `trigger` (closed-dropdown mode's
`<button role="combobox">`, also its positioning anchor), `combobox` (free-text mode's input
container, also its positioning anchor), `combobox-input` (the free-text `<input>`),
`provider-badge` (the optional leading `provider` label), `listbox` (the options popover, shared by
both modes), `option`, `option-icon` (an object-shaped catalog row's optional decorative leading
icon), `option-label`, `option-badge` (the "not in catalog" badge on a synthetic stale-value row),
`empty` (the no-matching-models message), `expand-icon` (the dropdown chevron, present in both modes), `hint` (the hint
message), `error` (the error message)

**Themeable custom properties:** `--lr-model-select-trigger-padding` (default
`var(--lr-form-control-padding-block) var(--lr-form-control-padding-inline)`) —
`[part="trigger"]`/`[part="combobox"]`'s padding shorthand.
`--lr-model-select-trigger-min-height` (default `var(--lr-form-control-height)`) — their block-size
floor. `--lr-model-select-font-size` (default `var(--lr-form-control-font-size)`) — their font size.
Those three are indirections onto the shared `--lr-form-control-*` scale rather than literal values:
the public property surface is unchanged, but the numbers come from the one ladder every other
control sizes against, so a tier is restated in exactly one place. `--lr-model-select-expand-size`
(default `var(--lr-size-1-75rem)`) — `[part="expand-icon"]`'s decorative box size (clamped against
`--lr-icon-button-size` via `min()`); this one is a glyph box rather than a control metric, so the
shared ladder has no equivalent and its per-tier values stay local. `size` is the primary lever;
override a cssprop directly only to retune a single element or step outside the scale entirely.
`--lr-model-select-gap` (default `var(--lr-space-xs)`) controls the child gap in the trigger,
combobox, and option rows; `--lr-model-select-radius` (default `var(--lr-radius)`) controls the
corner radius of the trigger, combobox, listbox, and option rows. Both remain inheritable fallback
arms, so set them on an ancestor to retheme a group without changing unrelated controls.
`--lr-model-select-open-border-color` (default `var(--lr-color-brand)`) controls the trigger
border while the listbox is open. A synthetic stale-value row has independent
`--lr-model-select-option-synthetic-border-style` (default `dashed`) and
`--lr-model-select-option-synthetic-border-color` (default `var(--lr-color-border)`) hooks.
`--lr-model-select-option-active-bg` (default
`var(--lr-color-brand-quiet)`) — background of a hovered or keyboard-active `[part="option"]` row;
declared as a `var()` fallback at the point of use, not on `:host`, so it isn't tied to `size`. The
selected row (`[part="option"][aria-selected="true"]`) has the matching set
`--lr-model-select-option-selected-bg` (default `transparent`),
`--lr-model-select-option-selected-border` and `--lr-model-select-option-selected-color` (both
`var(--lr-color-brand)`), and `--lr-model-select-option-selected-font-weight`
(`var(--lr-font-weight-semibold)`), all inline `var()` fallbacks so the selected row is rethemeable
without hijacking `--lr-color-brand`. Plus
shared tokens — `--lr-space-xs/-s`, `--lr-color-border/-surface/-brand/-brand-quiet/-text-quiet`,
`--lr-radius`, `--lr-shadow`, `--lr-focus-ring-width/-color/-offset`, `--lr-icon-button-size`,
`--lr-transition-fast`, `--lr-opacity-disabled`.

**Optional peer deps:** none.

```html
<lr-model-select
  provider="openai"
  .catalog=${[
    { id: 'gpt-4o', label: 'GPT-4o', icon: '✦' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  ]}
  value="gpt-4o"
  placeholder="Choose a model…"
  @lr-change=${(e) => setModel(e.detail.value, e.detail.inCatalog)}
></lr-model-select>

<!-- No fixed catalog yet: falls back to free-text entry -->
<lr-model-select provider="ollama" placeholder="Type a model id…" allow-custom></lr-model-select>
```

**Known gotchas:**

- `catalog` must be homogeneous — an array of plain strings, or an array of `{ id, label, icon? }`
  objects, not a mix; `LyraCatalog<T>` is a union of two readonly array _types_, not an array of a
  union item type.
- The synthetic "not in catalog" row only ever appears when `catalog` is non-empty and `value` isn't one
  of its ids — with no `catalog` at all, there's no catalog list to diff `value` against, so no badge.
- `value`/form-association here is hand-rolled via `attachInternals()` directly, not the shared
  `FormAssociated` mixin — mirrors `lr-combobox`/`lr-select`'s identical divergence.
- `aria-invalid`/`data-invalid` only reflect once the control has been blurred (touched) at least once,
  matching `lr-select`'s identical pattern — validity styling never flashes on first render.
- In free-text mode, the input's displayed text is `query` only while `open`; while closed it shows the
  committed value's label — so setting `.value` programmatically doesn't require also touching the live
  typed text.
- `hint`/`errorText` mirror `<lr-select>`'s identical chrome, including the `aria-describedby` wiring
  to the rendered `hint`/`error` ids — set on whichever element (`trigger` or `combobox-input`) owns
  `role="combobox"` for the active mode.

---

## `lr-streaming-text`

A token-coalescing incremental text renderer for streaming assistant output, with an optional
blinking cursor and auto-detected Markdown rendering. First-party invention (no Web Awesome
equivalent). The host is expected to assign the _entire_ current text on every update to `content`,
not a delta — this component does no accumulation or ordering of its own.

**Properties:**

- `content: string = ''` — the full current text so far.
- `streaming: boolean = false` (reflected) — shows the blinking cursor after the rendered text;
  reflects so a host can also target `lr-streaming-text[streaming]` in CSS.
- `coalesceMs: number = 50` (attribute `coalesce-ms`) — trailing-edge coalesce window, in ms, for
  `content` updates (see prose below).
- `contentMode: StreamingTextContentMode = 'auto'` (attribute `content-mode`, reflected) — `auto`
  uses `looksLikeMarkdown`; `plain` and `markdown` force their named paths. Invalid values render as
  `auto` without installing a stale memoized decision.

**Exported helper:** `looksLikeMarkdown(text: string): boolean` — runs a fixed, ordered list of
lightweight regexes (ATX heading, fenced code block, `**bold**`, `_italic_`, inline code, bullet
list item, numbered list item, `[text](url)` link, blockquote) against the whole string and returns
`true` on the first match. Used internally in `contentMode="auto"`; exported standalone
so the heuristic is directly testable without going through the component's render cycle. None of
the patterns need to be airtight — a false positive just routes ordinary prose harmlessly through
`<lr-markdown>`; a false negative just shows literal `**`/backticks/etc. as plain text until more
of the stream arrives.

**Events:** none.

**Slots:** none — content renders from `content`, not a slot.

**CSS parts:** `base`, `cursor` (only rendered while `streaming` is `true`)

**Themeable custom properties:** `--lr-inline-cursor-width` (default
`var(--lr-size-0-125rem)`, the shared inline cursor width), `--lr-inline-cursor-height` (default
`var(--lr-size-1em)`, so the bar tracks surrounding text). These are shared with
`<lr-typing-indicator>`, inherit from ancestors, and use local fallbacks only at the point of use; plus shared
`--lr-space-xs` (cursor's `margin-inline-start`) and `--lr-transition-ambient` (blink animation
cycle length).

**Optional peer deps:** the registration entry imports and auto-registers `<lr-markdown>` (the host
does not register it separately), so its optional-peer module graph includes `marked`, `dompurify`,
`shiki`, and `katex`. The runtime matrix is narrower: `content-mode="plain"` and auto-detected plain text
stay on the peer-free plain-text path; Markdown rendering lazy-loads `marked` plus the default
`dompurify` sanitizer and falls back to readable plain text if either is unavailable. Fenced code
can additionally use `shiki`, whose absence only leaves code unhighlighted. The composed Markdown
implementation contains the opt-in `katex` loader, but this wrapper does not enable its `math`
property and therefore never requests `katex` itself.

```html
<lr-streaming-text id="out" coalesce-ms="80" streaming></lr-streaming-text>
<script type="module">
  const out = document.getElementById("out");
  let text = "";
  for await (const token of tokenStream) {
    text += token;
    out.content = text; // always the full string so far, never a delta
  }
  out.streaming = false; // forces the final chunk through immediately; cursor disappears
</script>
```

Token-by-token streaming can update `content` far faster than a human can usefully perceive a
re-render, so updates funnel through `Announcer` (`../../internal/announcer.js`), reused here
purely as a generic "coalesce rapid calls, flush the latest" timing primitive — with none of that
class's usual DOM/ARIA plumbing. Within any `coalesce-ms` window, only the _last_ `content` value
assigned actually reaches the rendered DOM. Two cases always bypass the throttle and flush
immediately: the very first `content` assignment after mount, and any transition of `streaming`
between `true` and `false` in _either_ direction — so the final chunk of a finished stream can
never be left stranded mid-window, and a stream restarting on a reused element can never keep
showing the previous stream's stale final content for the length of the window.

Rendering itself is never reimplemented here: Markdown mode composes `<lr-markdown>` directly,
forwarding this component's own `streaming` through as that component's `streaming` hint prop;
plain-text mode renders into a `white-space: pre-wrap` span instead. The blinking cursor degrades
to a static, always-visible bar under `prefers-reduced-motion: reduce`. In plain-text mode it sits
inline at the tail of the final character; in Markdown mode it renders as its own trailing block
below the rendered content instead of attempting to splice into whatever nested block Markdown
happens to end with.

**Known gotchas:**

- `content` must always be the complete string so far, never a delta — this component does no
  accumulation of its own.
- Only the very _first_ `content` assignment after mount bypasses `coalesceMs` unconditionally —
  every later assignment is throttled normally except when it lands in the same update as a
  `streaming` transition (either `true → false` or `false → true`), which also forces an immediate
  flush.
- `content-mode="plain"` forces plain text even if the text obviously contains Markdown syntax;
  `content-mode="markdown"` forces the Markdown path.
- Purely presentational: no events, and it does not announce anything to assistive tech itself — a
  host that needs streamed text announced needs `<lr-live-region>` for that (e.g. composed inside
  `<lr-chat-message>`).

---

## `lr-generation-metrics`

A compact, ticking status readout shown alongside an in-progress AI response: elapsed time, token
count, and token-throughput, plus a built-in Stop button. First-party invention (no Web Awesome
equivalent). Renders as e.g. `12.3s · 340 tokens · 27 tok/s [Stop]`.

**9.0 identity migration:** `lr-generation-status` → `lr-generation-metrics`,
`LyraGenerationStatus` → `LyraGenerationMetrics`, and `LyraGenerationStatusEventMap` →
`LyraGenerationMetricsEventMap`. The old tag, class, event-map name, registration route, and
generated framework members are removed rather than retained as aliases.

**Properties:**

- `status: GenerationMetricsStatus = 'idle'` (`'idle' | 'running' | 'complete'`, reflected) —
  generation lifecycle. `idle` is never-started/reset; `running` ticks and is the only state that
  exposes Stop; `complete` freezes the final metrics. Invalid attribute or property writes normalize
  to `idle`.
- `startedAt?: number` (attribute `started-at`) — epoch-ms timestamp of when generation began.
  Optional — when unset, or set to a value that fails to parse as a finite number (e.g. an ISO-8601
  date string, which `type: Number` conversion turns into `NaN`), while `status` is `running`, this
  component captures `Date.now()` itself the moment `status` becomes `running` and counts from there
  instead — an invalid value is treated identically to "unset", never rendered as literal `"NaNs"`.
- `tokenCount?: number` (attribute `token-count`) — finite values are rounded to a non-negative
  integer; unset/non-finite values omit the `tokens` segment entirely.
- `tokensPerSecond?: number` (attribute `tokens-per-second`) — finite values are clamped to zero or
  above; unset/non-finite values derive from `token-count`/elapsed time once one second has elapsed.
- `showStop: boolean = true` (attribute `show-stop`, **not reflected**) — whether the built-in Stop
  button renders at all. Uses a string-value-aware `ComplexAttributeConverter` (not Lit's default
  presence-based `type: Boolean`), so a plain-HTML `show-stop="false"` content attribute correctly
  turns it off — the literal string `"false"` maps to `false`; the attribute's mere presence with any
  other value (or no value) maps to `true`. A Lit template can instead use a `.showStop=${false}`
  property binding. **Caveat:** a `?show-stop=${false}` boolean-attribute _binding_ still can't turn
  it off when the attribute was never present in markup to begin with — that binding only ever
  removes the attribute when falsy, and removing an attribute that's already absent fires no
  `attributeChangedCallback` (see AGENTS.md); use `.showStop=${false}` or the plain
  `show-stop="false"` string form instead.

**Events:** `lr-stop` (`detail: null`) — fired when the built-in Stop button is clicked while
`status="running"`.

**Slots:** none.

**CSS parts:** `base`, `elapsed` (always rendered, reads `"0.0s"` while idle), `tokens` (only
rendered for a finite `token-count`), `throughput` (only rendered when
a value is available, host-supplied or derived), `stop-button` (only rendered while `show-stop` is
`true` and `status="running"`)

**Themeable custom properties:** shared tokens only — `--lr-color-text-quiet` (base readout and
tokens/throughput text color), `--lr-color-text` (the elapsed segment's higher-contrast color,
and the stop-button's icon color), `--lr-space-s` (stop-button margin), `--lr-icon-button-size`
(stop-button minimum sizing; the full shared 40px-equivalent hit floor applies), `--lr-color-border`/`-surface`/`-brand`
(stop-button border/background/hover), `--lr-focus-ring-width`/`-color`/`-offset`,
`--lr-transition-fast`.

**Optional peer deps:** none.

```html
<lr-generation-metrics
  status="running"
  started-at="1732000000000"
  token-count="340"
  show-stop
></lr-generation-metrics>
<script type="module">
  document
    .querySelector("lr-generation-metrics")
    .addEventListener("lr-stop", () => {
      controller.abort(); // stop the host's own generation
    });
</script>
```

This is deliberately a _different_ concern than `<lr-stream-status>`: that component is about
transport/connection health (idle/connecting/streaming/stalled, heartbeat-aware stall detection),
while this one is a user-facing metrics readout for a generation both components' hosts typically
already know is healthily in progress. Neither imports or depends on the other; compose both side
by side rather than picking one. A finite `tokens-per-second`, when supplied directly, is clamped
non-negative and used;
when omitted, this component derives a live figure from `token-count` divided by elapsed seconds,
but only once at least one full second of elapsed time has accumulated (dividing by a sub-second
window can produce wildly-swinging early readings, e.g. 3 tokens in 40ms reading as "75 tok/s").
Entering `complete` freezes the elapsed clock for a completed-state summary; entering `idle` resets
it to zero. Sub-minute elapsed values use one decimal place until the rounding boundary at 59.95s;
minute values use localized whole minutes and seconds. Token counts use locale-aware plural rules.
Throughput below 10 uses up to one fractional digit and higher values round to whole tokens/sec.

This readout ticks roughly once per second while running, which is exactly the kind of
high-frequency update `<lr-live-region>`/`Announcer` exists to _prevent_ from being read aloud
verbatim — this component therefore carries no `role="status"`/`aria-live` of its own and never
announces anything. A host that wants generation-start/-end announced should pair this with
something that announces state _transitions_ instead. The Stop button gets a normal, always-present
`aria-label="Stop generating"`, no different from any other icon-only button in this library.

**Known gotchas:**

- `showStop` defaults to `true` and is not a reflected property. Its `ComplexAttributeConverter`
  makes the plain content attribute `show-stop="false"` work correctly, but a `?show-stop=${false}`
  Lit boolean-attribute _binding_ still can't turn it off starting from absent markup — see the
  property list above for the exact footgun.
- The derived `tokens-per-second` figure only appears once `elapsedMs >= 1000`; before that, the
  `throughput` part simply doesn't render — supply `tokens-per-second` yourself for a stable figure
  from the very first tick.
- Entering `complete` freezes the elapsed display; entering `idle` resets it to `"0.0s"`.
- `started-at` only re-baselines the ticker at the moment it's read: mounting the component with
  `status="running"` but no `started-at` captures `Date.now()` at that first update, not at
  whatever earlier instant generation may actually have begun.

---

## `lr-code-block`

Fenced code display with optional lazy syntax highlighting and a copy button. First-party invention
(no Web Awesome equivalent). It lazy-loads the optional peer dependency `shiki` (see
`code-loader.ts`) for the actual tokenizing, and includes a compact GreyCat/GCL grammar because
Shiki does not bundle one. It falls back to a plain `<pre><code>` when that peer isn't installed or
`language` is unset/unrecognized. That
fallback is the _default_ rendering path, not a degraded one: unhighlighted code is perfectly usable,
and it's what every instance renders at zero extra bytes until shiki resolves.

**Properties:**

- `code: string = ''` — the raw source text
- `language: string = ''` — a shiki-recognized language id or alias (e.g. `"javascript"`, `"python"`,
  `"json"`); when unset, or when shiki doesn't recognize it, the code renders as plain unhighlighted
  text regardless of whether shiki itself is available. Shiki's bundled catalog covers most common
  programming, markup, data, and configuration languages, including Python, C, C++, C#, Java,
  JavaScript, TypeScript, HTML, CSS, JSON, SQL, Go, Rust, YAML, Markdown, and shell scripts. Lyra
  also includes a built-in GreyCat grammar; use `"gcl"` or `"greycat"` for GreyCat source.
- `filename: string = ''` — shown in the header, when set
- `accessibleLabel: string | null = null` (attribute `aria-label`) — names the internal focusable code-body
  region; otherwise a localized filename/language description is generated
- `collapsible: boolean = false` (reflected) — shows the collapse/expand chevron button
- `collapsed: boolean = false` (reflected) — only has a visible effect while `collapsible` is also
  true
- `copyable: boolean = true` (reflected) — shows the copy-to-clipboard button. Literal HTML
  `copyable="false"` disables it; use a property binding such as `.copyable=${false}` when binding a
  value. A `?copyable=${false}` boolean-attribute binding only removes the attribute and cannot
  override the true default.
- `maxHeight: string = ''` (attribute `max-height`) — a CSS length (e.g. `"20rem"`); once set, the
  code scrolls internally past this height instead of growing the page
- `lineNumbers: boolean = false` (attribute `line-numbers`, reflected) — displays one-based line
  numbers for both highlighted output and the plain-text fallback
- `highlightLines: string = ''` (attribute `highlight-lines`) — comma-separated 1-based inclusive
  line ranges (e.g. `"3-5,7"`) to visually emphasize. Declarative sugar over `highlights` — merges
  with, and renders identically to, any `line-range` entries there.
- `activatableLines: boolean = false` (attribute `activatable-lines`) — turns the
  (`lineNumbers`-gated) gutter into a roving-tabindex group of buttons emitting `lr-line-activate`.
  Has no effect while `lineNumbers` is unset. If controlled `code` shrinks while a line owns
  focus, focus follows the clamped surviving line; moving focus elsewhere during that update wins.
- `highlights: readonly LyraHighlight[] = []` (attribute: false) — host-supplied highlights to paint over the
  code (the shared anchor-target `LyraHighlight` contract from `document-viewer/anchors.ts`). Only
  `line-range` anchors are meaningful here — every other `LyraAnchor` kind is ignored.
- `activeHighlightId: string | null = null` (attribute `active-highlight-id`) — the `highlights`
  entry, if any, currently treated as active (`data-active` on its lines).
- `anchorKinds: LyraAnchor['kind'][] = ['line-range']` — readonly, for the shared anchor-target
  contract.
- `languages?: Record<string, ShikiLanguageInput>` (attribute: false) — a map of language id to an
  already-imported shiki grammar module (e.g. `{ bash: bashGrammar }` from a module-scope
  `import bash from 'shiki/langs/bash.mjs'`). When `language` matches a key here, highlighting is
  seeded from exactly that pre-supplied grammar via a fine-grained `createHighlighterCore()`
  highlighter, bypassing the default ~200-language dynamic-import path (`loadShikiHighlighter()`)
  for that language — an additive, opt-in escape hatch for a build scoped to just the languages a
  consumer actually needs. A `language` absent from this map (or `languages` left unset) falls back
  to the default dynamic-import path unchanged. For a TypeScript annotation, use
  `import type { ShikiLanguageInput } from '@aceshooting/lyra-ui/components/conversation/code-block/code-block.js'`;
  the type-only granular import emits no registration side effect.
  `refreshTheme(): void` re-reads the resolved theme for syntax highlighting.
  **Methods:** `scrollToAnchor(target)` — resolves a `line-range` anchor (or a `highlights` id string
  resolving to one) by scrolling its start line into view within `[part="body"]`; resolves `false`
  when the anchor isn't a `line-range`, the id isn't found, or the start line is out of bounds.

**Events:** `lr-copy` (frozen `detail: { ok: true, text }` — fires only after the raw `code` value
was written successfully), `lr-error` (`detail: null` — generic notification when clipboard writing
fails), `lr-copy-error` (frozen `detail: { ok: false, text, reason, error }`, where `reason` is
`'unsupported' | 'denied' | 'failed'`), `lr-toggle-request` (cancelable;
`detail: { collapsed }` is the proposed next state and canceling leaves `collapsed` unchanged),
`lr-toggle` (`detail: { collapsed: boolean }` — the committed state after the request is accepted),
`lr-line-activate` (`detail: { line: number }` — a gutter line number was activated while
`activatableLines` is set),
`lr-text-select` (`detail: { text, anchor, rects }` — a text selection inside the code body ended;
`anchor` is a `line-range` anchor covering the selected lines)

**Slots:** none.

**CSS parts:** `base`, `header`, `filename`, `language`, `copy-button`, `toggle`, `body`, `pre`,
`code`, `line-highlight` (a line marked by `highlightLines` or a `line-range` entry in `highlights`),
`line-button` (a gutter line-number button, only rendered while `activatableLines` and `lineNumbers`
are both set)

**Themeable custom properties:** `--lr-code-block-max-height` (default `none` — an independently
settable scroll cap; a `max-height` attribute writes the same property inline on `body` and wins),
`--lr-code-block-font` (default
`var(--lr-font-mono)`, the library's shared monospace stack), `--lr-code-block-tab-size` (default `2` — tab width for the
rendered code, applied to `[part='pre']`), `--lr-code-block-active-line-outline-color` (default
`var(--lr-color-brand)` — the outline around the line marked active by `active-highlight-id`),
`--lr-code-block-highlighted-line-bg` (default `var(--lr-color-warning-quiet)` — the background of a
line marked by `highlight-lines` or a `line-range` entry in `highlights`, in both the light and
dark-theme rendering paths), plus shared tokens `--lr-color-border`, `--lr-radius`,
`--lr-color-surface`, `--lr-space-xs/-s/-m`, `--lr-font`, `--lr-color-text-quiet`,
`--lr-color-text`, `--lr-color-brand`/`-brand-quiet`, `--lr-transition-fast`,
`--lr-focus-ring-width/-color/-offset`.

`--lr-code-block-tab-size` carries the same default as `--lr-code-editor-tab-size`, so the editable
and read-only code surfaces agree on what a literal tab looks like. It is declared as a `var()`
fallback **at the point of use, not on `:host`** — a `:host` rule is re-stamped on every instance and
shadows any inherited value, so a page- or container-level declaration could never reach it. It is
also never written as an inline `tab-size`: `shiki` puts its own `style` attribute on the highlighted
`<pre>`, and an inline declaration is the one thing a host override cannot beat. `<lr-markdown>` and
`<lr-markdown-core>` carry the same fallback for their own `code-block` part because they are
**sibling** custom elements rather than descendants of this one — no single declaration covers both.
The identical value can still look different across the two: this component is `white-space: pre`
while a markdown code block inherits `pre-wrap`, and tab stops restart at each visual line, so a
wrapped line's tabs diverge.

`--lr-code-block-active-line-outline-color` retints just the active line's outline and leaves every
other `--lr-color-brand` surface in the component — the header language pill, hover states, the focus
ring — alone. It too is an inline `var()` fallback rather than a `:host` declaration, deliberately,
so it inherits: set it on the element, on an ancestor, or at the theme level.

`--lr-code-block-highlighted-line-bg` follows the same pattern: an inline `var()` fallback (not a
`:host` declaration) so it inherits, retinting just the highlighted-line background and leaving every
other `--lr-color-warning-quiet` surface alone.

**Optional peer deps:** `shiki` (lazy-loaded and cached once per page by `code-loader.ts`'s
`loadShikiHighlighter()`, which builds a single `Highlighter` seeded with the bundled `github-light`/
`github-dark` "dual themes" and _zero_ language grammars up front; each `language` a
`<lr-code-block>` actually requests is loaded incrementally on first use via
`loadShikiLanguage()`, and a language id that fails to load once is remembered and never retried. If
`shiki` isn't installed, `loadShikiHighlighter()` resolves to `null` with a one-time `console.warn`
and every instance falls back to plain text — install it with `pnpm add shiki` to enable
highlighting).

```ts
import { html } from "lit";
import "@aceshooting/lyra-ui/components/conversation/code-block/code-block.js";

const view = html`<lr-code-block
  language="typescript"
  filename="sum.ts"
  collapsible
  max-height="20rem"
  .code=${`export function sum(a: number, b: number) {\n  return a + b;\n}`}
  @lr-copy=${(e) => console.log("copied", e.detail.text)}
></lr-code-block>`;
```

Set `line-numbers` when source context benefits from numbered lines. The option does not change the
raw `code` value or the `lr-copy` event payload.

A decorative `<lr-skeleton shape="rect">` placeholder (with its own announcements disabled and
`aria-busy="true"` on the host) stands in only while shiki itself is loading for the very first time
on the page and `language` is set — it is
deliberately _not_ shown again for a later per-language grammar fetch (that's typically fast, and the
plain-text fallback already reads fine as a placeholder for it). Internally, a shiki `transformer`
(`partTransformer`) rewrites shiki's generated `<pre>`/`<code>` nodes in a single pass to carry this
component's own `part="pre"`/`part="code"` hooks and strips shiki's default `tabindex="0"` from
`<pre>`, since `[part="body"]` is already the single scrollable/focusable region (`role="group"`,
`tabindex="0"`) for the code area. Dark mode is handled via shiki's own "dual themes" feature: every
token carries its light color as a plain inline `color`/`background-color` and its dark color in
`--shiki-dark`/`--shiki-dark-bg` custom properties. The component watches its resolved Lyra theme
tokens and sets `data-dark-theme="true"` on the code body when the effective surface is dark; an
`!important` state rule then activates Shiki's dark values. This follows explicit Lyra theme
overrides instead of consulting `prefers-color-scheme` directly. Shiki's generated colors are the
one deliberate exception to every other color being a `--lr-*` token.

**Known gotchas:**

- `copyable` defaults to `true` and reflects — literal `copyable="false"` and a `.copyable=${false}`
  property binding both disable it; a `?copyable=${false}` boolean-attribute binding does not.
- an in-flight per-language grammar load is guarded by an internal token so a `code`/`language` change
  that arrives before a previous load resolves never applies a stale result — only the load matching
  the _current_ `language` is ever rendered.
- a malformed `code`/`language` combination that makes shiki's `codeToHtml()` throw falls back to
  plain text silently, not a blank code block.
- the "Copied!" label appears only after clipboard fulfillment and reverts to "Copy" after 1500ms.
  Rejection or an unavailable clipboard instead shows the localized failure state and emits
  `lr-error` plus `lr-copy-error`; the helper resolves the clipboard from the element's current
  `ownerDocument`, including after adoption.

---

## `lr-code-block-core`

A build-lean sibling of `<lr-code-block>` above, for a consumer whose `languages` map already
covers every language it will ever render. Where `<lr-code-block>` unconditionally calls
`loadShikiHighlighter()` — the default ~200-language dynamic-import table loader, whose bundled
lookup table a bundler can't statically narrow away even when a consumer never actually uses it —
this component's own module never imports or calls that function at all. It only ever calls
`loadShikiHighlighterCore(languages)` (shiki's "fine-grained bundle" recipe: `createHighlighterCore()`
plus an explicit oniguruma engine, seeded with _only_ the grammars in `languages`), so a consumer
importing this entry point instead of `code-block.js` gets a build genuinely free of shiki's full
language table.

A `language` value absent from `languages` always renders the plain `<pre><code>` fallback — there is
no default/full-table highlighter here to fall back to, unlike `<lr-code-block>`'s dynamic-import
path for an unmapped language. That fallback is the _default_ rendering path, not a degraded one,
same as `<lr-code-block>`'s own plain-text fallback. Everything else — `code`/`language`/
`filename`/`copyable`/`collapsible`/`collapsed`/`maxHeight`, the copy button, the collapse header
toggle, the loading-skeleton behavior while the fine-grained highlighter resolves — matches
`<lr-code-block>` exactly, including its CSS parts, themeable custom properties, and stylesheet
(this component reuses `code-block.styles.ts` directly).

**Properties:**

- `code: string = ''` — the raw source text.
- `language: string = ''` — a shiki-recognized language id or alias; when unset, or when it isn't a
  key in `languages`, the code renders as plain unhighlighted text — this component has no
  default/full-table highlighter to fall back to.
- `filename: string = ''` — shown in the header, when set.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — names the internal focusable code-body
  region; otherwise a localized filename/language description is generated.
- `collapsible: boolean = false` (reflected) — shows the collapse/expand chevron button.
- `collapsed: boolean = false` (reflected) — only has a visible effect while `collapsible` is also
  true.
- `copyable: boolean = true` (reflected) — shows the copy-to-clipboard button. Literal HTML
  `copyable="false"` or a `.copyable=${false}` property binding disables it; a
  `?copyable=${false}` boolean-attribute binding cannot override the true default.
- `maxHeight: string = ''` (attribute `max-height`) — a CSS length (e.g. `"20rem"`); once set, the
  code scrolls internally past this height instead of growing the page.
- `lineNumbers: boolean = false` (attribute `line-numbers`, reflected) — displays one-based line
  numbers for highlighted and plain output.
- `highlightLines: string = ''` (attribute `highlight-lines`) — comma-separated 1-based inclusive
  line ranges (e.g. `"3-5,7"`) to visually emphasize. Declarative sugar over `highlights` — merges
  with, and renders identically to, any `line-range` entries there.
- `activatableLines: boolean = false` (attribute `activatable-lines`) — turns the
  (`lineNumbers`-gated) gutter into a roving-tabindex group of buttons emitting `lr-line-activate`.
  Has no effect while `lineNumbers` is unset. If controlled `code` shrinks while a line owns
  focus, focus follows the clamped surviving line; moving focus elsewhere during that update wins.
- `highlights: readonly LyraHighlight[] = []` (attribute: false) — host-supplied highlights to paint over the
  code. Only `line-range` anchors are meaningful here — every other `LyraAnchor` kind is ignored.
- `activeHighlightId: string | null = null` (attribute `active-highlight-id`) — the `highlights`
  entry, if any, currently treated as active (`data-active` on its lines).
- `anchorKinds: LyraAnchor['kind'][] = ['line-range']` — readonly, for the shared anchor-target
  contract, identical to `<lr-code-block>`.
- `languages: Record<string, ShikiLanguageInput> = {}` (attribute: false) — grammar definitions this
  instance can highlight, e.g. `{ json: jsonGrammar }` (import from `shiki/langs/<name>.mjs`). Empty
  (the default) never highlights at all — every `language` renders the plain-text fallback.
  Replacing the map while connected starts a new loading generation; an older map that settles
  later cannot clear the current map's loading state or replace its highlighted output. For a
  TypeScript annotation, use `import type { ShikiLanguageInput } from
'@aceshooting/lyra-ui/components/conversation/code-block/code-block-core.js'`; the type-only
  granular import emits no registration side effect.

**Methods:** `scrollToAnchor(target)` — resolves a `line-range` anchor (or a `highlights` id string
resolving to one) by scrolling its start line into view within `[part="body"]`; resolves `false`
when the anchor isn't a `line-range`, the id isn't found, or the start line is out of bounds.
`refreshTheme(): void` re-reads the resolved theme for syntax highlighting.
`refreshTheme(): void` re-reads the resolved theme for syntax highlighting.
Identical behavior to `<lr-code-block>`'s own method.

**Events:** the same fulfilled-only `lr-copy`, generic `lr-error`, full `lr-copy-error`, cancelable
`lr-toggle-request`, committed `lr-toggle`, and `lr-line-activate` contracts as `<lr-code-block>`;
`lr-text-select` (`detail: { text, anchor, rects }` — a text selection inside the code
body ended; `anchor` is a `line-range` anchor covering the selected lines).

**Slots:** none.

**CSS parts:** `base`, `header`, `filename`, `language`, `copy-button`, `toggle`, `body`, `pre`,
`code`, `line-highlight`, `line-button` — identical set to `<lr-code-block>`.

**Themeable custom properties:** identical to `<lr-code-block>` — `--lr-code-block-max-height`
(independently settable; an authored `max-height` attribute wins inline),
`--lr-code-block-font`, `--lr-code-block-tab-size` (default `2`, applied to `[part='pre']`),
`--lr-code-block-active-line-outline-color` (default `var(--lr-color-brand)`),
`--lr-code-block-highlighted-line-bg` (default `var(--lr-color-warning-quiet)`), plus the same shared
tokens. The last three are inline `var()` fallbacks at the point of use rather than `:host`
declarations, so a page-, container-, or theme-level value reaches them; see `<lr-code-block>` above
for the full rationale, including why `<lr-markdown>`/`<lr-markdown-core>` must declare the tab-size
fallback separately.

**Optional peer deps:** `shiki` (specifically its `shiki/core`, `shiki/engine/oniguruma`,
`shiki/wasm`, and `shiki/themes/github-{light,dark}.mjs` subpaths — never `shiki`'s main entry point,
which is what carries the ~200-language table this component exists to avoid). Building the
fine-grained highlighter is cached per `languages` object identity (a `WeakMap`), so passing the same
module-level `languages` constant on every render builds it only once.

```ts
import { html } from "lit";
import jsonGrammar from "shiki/langs/json.mjs";
import "@aceshooting/lyra-ui/components/conversation/code-block/code-block-core.js";

const languages = { json: jsonGrammar };
const view = html`<lr-code-block-core
  language="json"
  .languages=${languages}
  .code=${'{"ok": true}'}
></lr-code-block-core>`;
```

**Known gotchas:**

- there is no default highlighter and no dynamic-import fallback table — a `language` you haven't
  added to `languages` will never highlight, no matter how common that language is elsewhere. Reach
  for `<lr-code-block>` instead if you need to support an open-ended set of languages without
  pre-declaring each one.
- `languages` is keyed by object identity for caching purposes — pass a stable, module-level constant
  (not a fresh object literal per render), or every render rebuilds its own fine-grained highlighter.

---

## `lr-model-settings-panel`

A fixed composition of `<lr-model-select>` and `<lr-slider>` into one agent-configuration card:
pick a provider's model, then tune its sampling temperature. First-party invention (no Web Awesome
equivalent). Not a generic layout shell — it exists so a consumer doesn't have to re-wire the same
two child `lr-change` events into one combined settings object by hand every time this pairing
comes up.

Every prop here is a plain pass-through to (or mirror of) the matching child control's own prop of
the same/similar name — see `lr-model-select` and `lr-slider` themselves for the exact semantics
of `catalog`/`allowCustom` and `temperatureMin`/`temperatureMax`/`temperatureStep`.

**Properties:**

- `provider: string = ''` — informational provider badge, passed straight through to the internal
  `lr-model-select`.
- `catalog?: LyraCatalog<LyraModelCatalogEntry>` (attribute: false, JS-only) — a readonly string
  catalog or readonly object-row catalog (every entry must be one shape or the other, never mixed);
  passed straight through to the internal `lr-model-select`, with the shared unique, nonempty,
  first-wins catalog projection also used for this panel's `inCatalog` event field. The array is
  clone-owned, bounded, and frozen; reassign a new catalog array after changing its rows.
- `model: string = ''` — the current model id.
- `allowCustom: boolean = false` (attribute `allow-custom`) — lets the model control accept a value
  outside `catalog`; passed straight through.
- `temperature: number = 1` — the current sampling temperature. `1` is the midpoint of the default
  `[0, 2]` range and matches both OpenAI's and Anthropic's own provider default; reassign it yourself
  if your provider differs.
- `temperatureMin: number = 0` (attribute `temperature-min`)
- `temperatureMax: number = 2` (attribute `temperature-max`)
- `temperatureStep: number = 0.1` (attribute `temperature-step`)
- `layout: 'vertical' | 'compact' = 'vertical'` (reflected) — `vertical` stacks full-width rows with
  visible labels; `compact` runs the same two rows side by side with a smaller, uppercase temperature
  caption, for toolbars/sidebars where the vertical layout's height doesn't fit.
- `disabled: boolean = false` (reflected) — disables the panel as a unit by forwarding to _both_
  internal `lr-model-select` and `lr-slider`; a wrapping `<fieldset disabled>` alone would not
  reach either, since a form-associated control's own `disabled` IDL property/attribute is never
  mutated by fieldset cascading.

**Events:** `lr-change` — `detail: { model: string; inCatalog: boolean; temperature: number }`.
Fires whenever _either_ child control's own `lr-change` fires, and always carries the full current
settings snapshot, not just whichever field actually changed. `inCatalog` is recomputed fresh from
`catalog`/`model` on every emission (mirroring `lr-model-select`'s own `effectiveEntries` logic)
rather than cached from the last child event, so it's still correct even when `model` was just
assigned directly instead of via the child's own event.

**Slots:** none — this is a fixed two-control composition, not a generic layout shell.

**CSS parts:** `base`, `model-row`, `model-select`, `model-label` (forwarded visible internal
selector label), `temperature-row`, `temperature-label`, `temperature-value`

**Themeable custom properties:** no component-specific custom properties; consumes shared tokens
`--lr-space-l/-m/-s/-xs`, `--lr-color-border`, `--lr-radius`, `--lr-color-surface`,
`--lr-color-text`, `--lr-color-text-quiet`.

**Optional peer deps:** none — it composes the library's own `<lr-model-select>` and `<lr-slider>`
internally (both imported unconditionally as side effects, not optional).

```html
<lr-model-settings-panel
  provider="OpenAI"
  .catalog=${['gpt-4o', 'gpt-4o-mini', 'gpt-4.1']}
  model="gpt-4o"
  temperature="0.7"
  @lr-change=${(e) => console.log(e.detail)}
></lr-model-settings-panel>

<lr-model-settings-panel layout="compact" .catalog=${catalog}></lr-model-settings-panel>
```

The internal `lr-slider` renders with its own value readout suppressed (`.showValue=${false}`);
the current temperature is instead shown via this component's own `[part="temperature-value"]` span,
which formats `temperature` through the cached `Intl.NumberFormat` for the effective locale with up
to 20 fractional digits, matching `lr-slider`'s own numeric readout. For example, `temperature="0.7"`
under `locale="de-DE"` displays `0,7`.

The panel's own `temperature` property mirrors the nested slider's _live_ value on every one of its
`lr-input` events (drag/key-repeat), not just its committed `lr-change` — so `temperature` (and
the visible readout) tick continuously during a drag, but the panel's own `lr-change` event only
fires once the slider's own `lr-change` commits (pointerup/keyup) or the model changes; reading
`.temperature` mid-drag will already reflect the live position even though no `lr-change` has fired
yet for it.

**Known gotchas:**

- `catalog` is JS-only (`attribute: false`) — set it via a property binding (`.catalog=`), never as
  an HTML attribute, same requirement as the underlying `lr-model-select`.
- `layout="compact"` removes the host's own `max-inline-size` cap (`28rem` in `vertical` layout)
  entirely, so a compact panel can grow as wide as its container/flex context allows.
- The nested `lr-model-select`'s own `max-inline-size` (sized for a standalone dropdown) is
  overridden to `100%`/`none` inside `[part="model-row"]` so it fills the card's full width — a
  detail only worth knowing if you're targeting `lr-model-select` internals with your own CSS
  through this component.

---

## `lr-audio-visualizer`

A presentational, canvas-drawn voice-activity visualization (bars or waveform) — the
LiveKit-BarVisualizer counterpart for this library. Driven by a `MediaStream` (lazily wired to a
WebAudio `AnalyserNode`), a numeric `level` for hosts that already compute levels (e.g.
`<lr-push-to-talk>`'s `lr-level`), or `state` alone for an ambient animation when no real signal
exists. A real signal (`stream` or `level`) always drives amplitude regardless of
`prefers-reduced-motion`; only the signal-less ambient animation is throttled under reduced motion.

**Properties:** `stream: MediaStream | null = null` (attribute: false) — a live capture stream, lazily
wired to a WebAudio `AnalyserNode`; `level: number | null = null` — a pre-computed 0–1 amplitude for
hosts that already have one (e.g. `lr-push-to-talk`'s `lr-level` detail); `state: 'idle' |
'listening' | 'thinking' | 'speaking' = 'idle'` (reflected) — drives the signal-less ambient
animation and per-state coloring; `mode: AudioVisualizerMode = 'bars'` (`'bars' | 'waveform'`,
reflected); `barCount: number = 5` (attribute `bar-count`); `gain: number = 1` — multiplier applied
to the resolved amplitude; `label: string =
''` — accessible-name override. Invalid `state` or `mode` attribute/property writes normalize to
`idle` and `bars` respectively.

**Methods:** `refreshTheme()` re-reads themeable custom properties after a runtime theme change (the
canvas resolves token values at paint time and cannot inherit `var()` directly). Canvas-bound
colors are materialized through a live DOM probe, so `currentColor` and inherited expressions
resolve in the component's theme scope while invalid values fall back safely. Assigning a detached
or empty `MediaStream` tears down the prior analyser transaction immediately and draws from
`level`/ambient state; late setup from an older stream cannot replace the current source.

**Events:** none — purely presentational.

**Slots:** none.

**CSS parts:** `base` (the root wrapper) and `canvas` (the drawing surface, `aria-hidden`; the host
itself carries `role="img"` and the accessible name).

**Themeable custom properties:** `--lr-audio-visualizer-color` (default `var(--lr-color-brand)` —
active bar/waveform color), `--lr-audio-visualizer-quiet-color` (default
`var(--lr-color-brand-quiet)` — inactive/idle color), and `--lr-audio-visualizer-height` (default
`var(--lr-size-3rem)` — the host's block size). `--lr-audio-visualizer-ambient-duration` (default
`var(--lr-duration-ambient)`) is the time-only `ms`/`s` duration of one signal-less ambient pulse
or sweep. It retimes this visualizer alone; compound transition values and invalid values fall back
to the shared duration, while reduced-motion ambient output remains static.

## `lr-branch-picker`

The "‹ 2 / 5 ›" navigator across regenerated/edited variants of one message. Pure controlled: it
never mutates its own `index` — the same contract `<lr-pagination>` already establishes for
`page`. The host listens for `lr-branch-change`, swaps the displayed branch content, and applies
the new `index` back. Renders nothing at all while `count < 2`, so a host can bind it unconditionally
on every message regardless of whether that message actually has multiple branches yet.

**Properties:** `index: number = 0` (reflected) and `count: number = 1` (reflected) — the current
0-based branch and the total branch count. `label: string = ''`.

**Methods:** `focus(options?)` forwards to the currently enabled chevron (falling back to the first
rendered chevron), `blur()` blurs both chevrons, `click()` activates that same enabled target, and
`getToolbarActions()` returns the ordered logical actions used by an enclosing message toolbar.

**Events:** `lr-branch-change` — a branch navigation was requested. `detail: { index }`, always a
valid target (never past either bound); the consumer applies `index` after switching the displayed
branch content. `lr-toolbar-actions-change` is the no-detail coordination event emitted when the
provider's logical toolbar actions change availability or order.

**CSS parts:** `base` (the group wrapper, `role="group"`), `previous-button`, `next-button`,
`previous-glyph` and `next-glyph` (the chevron inside each button — target these to swap the
arrow without restyling the button), and `position` (the visible "2 / 5" text).

## `lr-message-actions`

The per-message action toolbar for `lr-chat-message`'s `actions` slot: opt-in built-ins (copy /
regenerate / edit / feedback) that emit intent events, plus a default slot for custom controls (e.g.
a slotted `lr-branch-picker`). `role="toolbar"` with WAI-ARIA APG roving-tabindex; ArrowLeft/
ArrowRight (RTL-aware) plus Home/End move focus across every stop — built-ins and slotted controls
alike. Composite controls expose ordered logical actions through the exported
`LyraToolbarActionProvider` protocol, so implementation nodes stay private while the toolbar can
focus and set each logical tab stop. Providers announce order/availability changes with
`lr-toolbar-actions-change`; plain authored controls remain observed in light DOM.
Disabled, hidden, `aria-hidden`, `aria-disabled`, inert, or no-longer-actionable controls (including
controls beneath an unavailable ancestor) are excluded before the usable roving fallback is chosen.
Those states and `tabindex` are observed live, not only at mount/slot assignment; former stops are
cleared immediately. Slotted custom elements contribute their actual composed action targets rather
than their host merely because it has a `focus()` method; multiple nested actions (for example both
feedback thumbs or branch-picker buttons) remain distinct stops. If the focused action is removed or
becomes unavailable, focus moves to the nearest survivor or the stable toolbar, without overriding a
newer external focus move. Keyboard movement starts from the action that actually received the event,
even after a controlled state write changed the remembered stop.

**Properties:** `controls: MessageActionControl[] = []` (attribute: false) —
`MessageActionControl = 'copy' | 'regenerate' | 'edit' | 'feedback'` (exported here); which built-ins
render, in that order. Duplicate names are omitted first-wins before rendering, roving focus, or
intent events, so each built-in can occur at most once. `copyText: string = ''`
(attribute `copy-text`) — required for the `copy` built-in to render at all. `feedbackRating:
MessageFeedbackValue = null` (attribute `feedback-rating`) — forwarded to the embedded, thumbs-only
`lr-message-feedback` (its `detail`/`detailFor` are never forwarded, so its detail panel never
opens). `revealOnInteraction: boolean = false` (reflected, attribute `reveal-on-interaction`) — hides
the bar until the closest `lr-chat-message` ancestor is hovered, or the toolbar contains focus.
`label: string = ''` — accessible name override for the toolbar. `accessibleLabel: string | null =
null` (attribute `aria-label`) — overrides the toolbar's computed accessible name, winning over
`label` and the localized default; attribute-reflects from a host-level `aria-label`.

**Events:** `lr-regenerate`/`lr-edit` — a built-in was activated, `detail: null`. `lr-copy` —
frozen `detail: { ok: true, text }`, emitted only after the embedded `lr-copy-button`'s clipboard
write fulfills (bubbles/composed already, not re-emitted). A failed write surfaces generic
`lr-error` (`detail: null`) plus `lr-copy-error` with frozen
`detail: { ok: false, text, reason, error }`; `reason` is `'unsupported' | 'denied' | 'failed'`.
`lr-feedback-change`/`lr-feedback-submit` — bubble unchanged from the embedded,
thumbs-only `lr-message-feedback`. A colliding event from an
arbitrary slotted child is contained at that slot boundary rather than being mistaken for a
built-in action.

**Slots:** default — additional controls (e.g. `lr-copy-button`, `lr-icon-button`,
`lr-branch-picker`) appended after the built-ins; they participate in the toolbar's arrow-key
navigation.

**CSS parts:** `base` (the toolbar, `role="toolbar"`), `copy-button` (the embedded
`lr-copy-button`), `regenerate-button`, `edit-button`, and `feedback` (the embedded
`lr-message-feedback`).

## `lr-message-feedback`

Thumbs up/down for one assistant message, with an optional inline detail step (categorical reason
chips + a free-text comment) that opens as a disclosure directly below the thumbs. Emits; never
persists — a host reflects a previously-recorded rating back via `rating` (+ `disabled` for a
read-only display). Activating the pressed thumb while its detail panel is open toggles it off to
`null`. If an applicable panel was closed without changing the rating (for example with Escape),
activating the still-pressed thumb reopens it with the surviving draft. A thumbs-only control always
uses the ordinary re-activate-to-clear toggle.

**Properties:** `rating: MessageFeedbackValue = null` (`'up' | 'down' | null`, reflected),
`detail?: MessageFeedbackDetailConfiguration` (attribute: false) — one configuration with optional
`reasons?: readonly { id, label }[]` and `commentable?: boolean`; omit it for thumbs-only feedback.
The record and nested reasons are a bounded clone-owned frozen snapshot; create and reassign a new
detail record after changes.
`detailFor: 'none' | 'up' | 'down' | 'both' = 'down'` (attribute `detail-for`) selects which rating
owns that one detail panel. `disabled: boolean = false` (reflected) makes a recorded rating read-only, and
`pending: boolean = false` (reflected) — set automatically when a submit listener prevents the
submission while host persistence is unresolved; all feedback controls are disabled and the panel
reports busy until that state is resolved.

**Methods:** `focus()` focuses the thumb matching the current `rating` (the up thumb when `null`);
`blur()` blurs both thumbs; `click()` activates that same thumb when enabled.
`getToolbarActions()` returns the ordered logical thumb actions used by an enclosing toolbar.
`finalizePendingSubmit()` completes a prevented submit after persistence succeeds, closing the
panel, announcing success, and returning focus to the active thumb. `revertPendingSubmit()` releases
the pending state after failure without clearing the draft or announcing success, leaving the panel
open for retry. Both are no-ops when no submit is pending.

**Events:** `lr-feedback-change` — `detail: { rating: 'up' | 'down' | null }`, fired when a thumb's
provisional rating changes or clears. `lr-feedback-submit` — cancelable
`detail: { rating: 'up' | 'down' | null; reasonIds: string[]; comment: string }`, fired for every
terminal thumbs-only choice/clear and by the detail panel's submit button. The pending transaction
is installed before dispatch, so even a synchronous listener may finalize/revert it safely.
`preventDefault()` holds the panel/control in `pending` and delays
success announcement/focus until `finalizePendingSubmit()`; call `revertPendingSubmit()` on failure.
When uncanceled it retains the synchronous close/announce/focus behavior. The optional comment
`<textarea>`'s native `focus` and `blur` are re-dispatched as bubbling, composed host events.
`lr-toolbar-actions-change` is the no-detail coordination event emitted when the provider's logical
toolbar actions change availability or order.

**CSS parts:** `base` (the root), `thumbs` (wrapper around both thumb buttons), `up-button`,
`down-button`, `panel` (the inline detail disclosure, only rendered when `reasons` is non-empty or
`commentable` is set), `reasons` (the reason-chip group), `comment` (the comment `<textarea>`), and
`submit-button`.

**Themeable custom properties:** six pressed-state hooks, three per thumb —
`--lr-message-feedback-up-active-color` (default `var(--lr-color-success)`),
`--lr-message-feedback-up-active-bg` (default `var(--lr-color-success-quiet)`),
`--lr-message-feedback-up-active-border` (default `var(--lr-color-success)`), and the thumbs-down
trio `--lr-message-feedback-down-active-color`, `--lr-message-feedback-down-active-bg`,
`--lr-message-feedback-down-active-border` (defaulting to `var(--lr-color-danger)`,
`var(--lr-color-danger-quiet)`, `var(--lr-color-danger)`). Each styles the glyph, background, and
border of its thumb only while that thumb is pressed. All six are declared as inline `var()`
fallbacks at the point of use and never on `:host`, so each can be set on the element _or on any
ancestor_ — a whole transcript's feedback controls retint from one declaration. That shape is
required because `::part(up-button)[aria-pressed='true']` is invalid CSS (Shadow Parts forbids an
attribute selector after `::part()`), which previously left overriding the library-wide
`--lr-color-success`/`--lr-color-danger` tokens as the only lever, repainting every other element
reading them. Unset, each falls back to exactly the token its rule used before.

## `lr-push-to-talk`

A mic capture button owning the full `getUserMedia` + `MediaRecorder` lifecycle: permission request,
recording, optional chunked streaming, teardown. The one place in this library that touches the
microphone — no SDK, no LiveKit/ElevenLabs import, native browser APIs only. `mode="hold"` (the
default) is a press-and-hold gesture; `mode="toggle"` is click-to-start/click-to-stop with
`aria-pressed`. Escape cancels the in-progress take in either mode.

While recording, the optional elapsed timer uses the effective locale's decimal digits, suppresses
grouping, and pads its seconds field to two locale-aware digits.

**Properties:** `mode: PushToTalkMode = 'hold'` (`'hold' | 'toggle'`, reflected; invalid writes
normalize to `hold`), `timesliceMs: number = 0` (attribute
`timeslice-ms`) — `> 0` passes a timeslice to `MediaRecorder.start()` and emits `lr-record-chunk` per
slice, `mimeType: string = ''` (attribute `mime-type`) — a `MediaRecorder` MIME type, `deviceId:
string = ''` (attribute `device-id`) — a specific input device, `audioConstraints?:
PushToTalkAudioConstraints` (attribute: false) — merged into the `getUserMedia` audio constraints;
it deliberately excludes `deviceId`, whose single authority is the dedicated property,
`levelEvents: boolean = false` (attribute `level-events`) — opt in to `lr-level`, `maxDurationMs:
number = 0` (attribute `max-duration-ms`) — auto-stop cap, `0` disables it, `showTimer: boolean =
true` (attribute `show-timer`), `disabled: boolean = false` (reflected), plus two getter-only
properties: `state: PushToTalkState` (`'idle' | 'requesting' | 'denied' | 'recording' | 'error'`,
mirrored to `data-state`) and `stream: MediaStream | null` (the live capture stream, assignable straight onto
`lr-audio-visualizer.stream`).

`levelEvents`, `maxDurationMs`, and `showTimer` stay reactive during an active recording: changing
them starts or stops their audio-analysis, deadline, or elapsed-time work immediately. A changed
maximum remains measured from the original recording start rather than granting a fresh duration;
setting it to `0` removes the deadline.

**Methods:** `start()`, `stop()`, and `cancel()` drive the capture lifecycle imperatively (mirroring
the pointer/keyboard gestures).

**Slots:** `microphone-icon` replaces the default mic glyph. `recording-icon` replaces the default
recording-state pulse glyph. Both are
decorative inside the named trigger: their flattened content is inert and hidden from accessibility
APIs, so do not place a second interactive control there.

**Events:** `lr-record-start` (`detail: { stream: MediaStream }`), `lr-record-chunk` (`detail: { blob:
Blob }`, only when `timeslice-ms > 0`), `lr-record-stop` (`detail: { blob: Blob; durationMs: number
}`), `lr-record-cancel` (`detail: null`), `lr-record-error`
(`detail: { error: DOMException | Error }`, including recorder runtime errors), `lr-level`
(`detail: { level: number }` — 0–1 amplitude, opt-in via `level-events`), and `lr-record-state-change`
(`detail: { state: 'idle' | 'requesting' | 'denied' | 'recording' | 'error' }`).

**CSS parts:** `trigger` (the capture button), `icon`, `pulse` (rendered only while recording),
`timer` (the localized `M:SS` elapsed-time readout, only while recording and `show-timer`), and `status`
(visible status text for the `requesting`/`denied`/`error`/unsupported states).

**Themeable custom properties:** `--lr-push-to-talk-size` (default `var(--lr-size-3rem)`) — the
trigger button's preferred inline and block size; the shared `--lr-icon-button-size` remains its
minimum hit-area floor even when this value is smaller. `--lr-push-to-talk-recording-color` (default
`var(--lr-color-danger)`) remains the established aggregate fallback for the recording trigger's
border and foreground and the pulse-ring border. Retune those independently with
`--lr-push-to-talk-trigger-recording-border-color`,
`--lr-push-to-talk-trigger-recording-color`, and
`--lr-push-to-talk-pulse-recording-border-color`, each defaulting through
`var(--lr-push-to-talk-recording-color, var(--lr-color-danger))`. All four are inline `var()`
fallbacks at the point of use rather than `:host` declarations, so each can be set on the element or
on an ancestor without repainting every other danger-toned surface. `::part(trigger)[data-state='recording']`
is invalid CSS (Shadow Parts forbids an attribute selector after `::part()`), which is why these
recording-state hooks exist.

**Additional API surface:**

- `blur()` — Forwards host blur to the internal push-to-talk control.
- `focus()` — Forwards host focus to the internal push-to-talk control.
- `click()` — Programmatically starts or stops a take, mirroring a real pointer/keyboard
  activation: in `mode="toggle"` it forwards to the trigger's native `click()`; otherwise it calls
  `stop()` while `state` is `recording` or `start()` otherwise. A no-op while `disabled` or
  unsupported.

## `lr-transcript-feed`

Live captions for an in-progress voice session: speaker-grouped entries, interim-vs-final styling
with in-place upgrades keyed by `id`, and a stick-to-bottom auto-scroll with release, the same
`follow`/`lr-follow-change` contract `<lr-terminal>` uses. Live captions only — recorded-media
transcript sync is a separate concern.

**Properties:** `entries: LyraTranscriptEntry[] = []` (attribute: false) — `LyraTranscriptEntry { id:
string; speaker?: string; text: string; interim?: boolean; timestamp?: LyraTimestamp }` (exported by
this module; `LyraTimestamp = Date | string | number`, normalized through Date/TimeClip). Reconciled
keyed by nonempty, nonblank, first-wins `id` via Lit's `repeat()`: a
same-`id` entry with new `text` replaces in place, and a same-`id` entry whose `interim` flips from
`true` to unset/`false` moves from the interim area into the `role="log"` region and announces
exactly once. A collection with no valid entry renders the empty state. Interim entries render
_after_ the log container — visible, but structurally outside
it — so per-token mutations are never spoken by assistive tech. That announcement does **not** come
from the shadow `role="log"` region, which is explicitly `aria-live="off"`: a live region inside a
component's own shadow root is not reliably announced (JAWS with Firefox ignores one outright).
Each newly final entry's `text` is announced once through the shared light-DOM polite live region
instead, the same route `<lr-chat-viewport>` and `<lr-terminal>` take. The entries a feed is
_mounted_ with are treated as existing transcript rather than newly spoken captions, so the first
render only records them. `follow: boolean = true`
(reflected), `showTimestamps: boolean = false` (attribute `show-timestamps`), `formatTimestamp?:
(date: Date) => string` (attribute: false), `maxRenderedEntries: number = 500` (attribute
`max-rendered-entries`) — `0` explicitly renders every entry; a positive value keeps only the newest N,
`sessionId: string = ''` (attribute `session-id`) — changing session identity clears finalized-ID
announcement history and treats the new session's current entries as a silent baseline,
`label: string = ''` — accessible name for the `role="log"` region
(default: the localized `transcriptFeedLabel`), and `accessibleLabel: string | null = null`
(attribute `aria-label`) — overrides the log's computed accessible name, winning over `label` and
the localized default; attribute-reflects from a host-level `aria-label`.

**Methods:** `scrollToBottom()` re-engages `follow` and instantly scrolls to the current latest
entry. The built-in jump action delegates to this method.

**Slots:** `empty` — custom empty state (default: the localized "No transcript yet").

**Events:** `lr-follow-change` — `detail: { following }`, fires on every `follow` transition.

**CSS parts:** `base` (the scroll container), `log` (the `role="log"` region wrapping final entries
only), `entry`, `speaker` (omitted for a row repeating the previous row's speaker), `text`
(`dir="auto"`), `timestamp` (only while `show-timestamps`), `interim` (present alongside `entry` on
an interim row), `interim-area` (the wrapper holding interim rows, rendered only while at least one
interim entry exists), `jump-button` (shown only while `follow` is `false`), and `empty`.

## `lr-handoff-divider`

A labeled semantic separator marking control transfer between agents in a transcript ("Transferred
to Research Agent"), with an optional agent avatar. Purely presentational: no events, no
interactivity, no restore semantics. The computed label is announced once, on first connect,
through an internal `<lr-live-region>`.

**Properties:** `toAgent: string = ''` (attribute `to-agent`), `fromAgent: string = ''` (attribute
`from-agent`), and `label: string = ''`. With both agent names the localized text is “Transferred
from {from} to {to}”; `label` overrides it. An explicit host `aria-label`, including an empty one,
wins for the separator and mount-time announcement.

**Slots:** `avatar` — the incoming agent's `<lr-avatar>` (or icon), hidden entirely while empty.

**CSS parts:** `base` (the separator root, `role="separator"`), `line` (each of the two flanking
rules), `chip` (the visual `aria-hidden` chip wrapping the avatar and label), `avatar` (wrapper
around the `avatar` slot, only shown while the slot has content), and `label`.

## `lr-chat-viewport`

The transcript scroll container: owns stick-to-bottom behavior while an answer streams, the "jump to
latest" pill, and the unread divider. Two supported content shapes, auto-detected: ordinary element
children (typically `lr-chat-message`s — _slotted mode_), or exactly one `lr-virtual-list`
(_virtual mode_, detected via `instanceof`). In virtual mode this component defers all scrolling to
the slotted list's own `scrollToIndex()`. Follow/release state machine: while `follow` is engaged,
content growth re-scrolls to the end; release happens only on a user-intent gesture (wheel,
touchmove, scrollbar-drag, or PageUp/ArrowUp/Home while the log region has focus) that leaves the
view more than `bottomThreshold` from the end — a scroll caused by this component's own programmatic
scrolling, or by a layout shift, never releases it. Reaching the bottom again by any means re-engages
`follow`. The shadow `role="log"` always remains `aria-live="off"`, which avoids announcing every
streaming token. Consumers that append complete messages at an announcement-safe cadence can opt
into `polite` or `assertive`; each newly appended direct child's accessibility-exposed text is then
copied to the matching shared light-DOM announcement sink in the component's `ownerDocument`.
Hidden, inert, `aria-hidden`, and CSS-hidden content is omitted. Existing declarative children stay
silent on mount, and appending the same text again creates another announcement. `off` acquires no
sink and produces no announcements.

**Properties:** `follow: boolean = true` (reflected) — component-managed stick-to-bottom state,
host-writable: setting `true` scrolls to the end and re-engages following, setting `false` releases
it. `bottomThreshold: number = 24` (attribute `bottom-threshold`) — px distance from the end still
counted as "at bottom." `unreadStartIndex: number | null = null` (attribute `unread-start-index`) —
index of the first unread item (element-child index in slotted mode, `items` index in virtual mode);
`null` disables both the divider and the pill's unread count. `live: 'off' | 'polite' | 'assertive' =
'off'` (reflected) — policy for the shared light-DOM announcement sink; the internal log itself
remains non-live. Keep `off` for token-by-token streaming and opt in only when complete messages are
appended as direct children at an announcement-safe cadence.
`label: string = ''` — accessible name
for the log region, defaults to the localized `chatViewportLabel`. `accessibleLabel: string | null =
null` (attribute `aria-label`) — host `aria-label`, forwarded to the internal `role="log"` element
(an `aria-label` left on the host itself names nothing, since the log role lives inside the shadow
root); wins over `label` and the localized default.

**Methods:** `scrollToBottom(options?)` — scrolls to the end and re-engages `follow`; default
`smooth`, forced to `auto` under `prefers-reduced-motion`. `scrollToUnread(options?)` — scrolls the
unread divider to the top of the view, resolving `false` when `unreadStartIndex` is `null`/out of
range; does not re-engage `follow`.

**Events:** `lr-follow-change` — `detail: { following }`, fired whenever `follow` flips (user
scroll-up release, or reaching the bottom again). Never fired for the initial mount state.

Activating a focused jump-to-latest pill, or directly setting `follow = true`, transfers focus to
the transcript's stable scroll owner after the pill disappears: `[part="scroll"]` in slotted mode,
or the nested virtual list's real focus owner in virtual mode. Focus that moved elsewhere before the
update is preserved.

**Slots:** default — the transcript: ordinary element children, or exactly one `lr-virtual-list`.

Only a direct child `lr-virtual-list` selects virtual mode; bubbled list events from nested message
content are ignored. In slotted mode the visual unread divider remains an absolutely positioned
paint layer while a separate hidden semantic boundary is inserted immediately before the first
unread child, so DOM/accessibility order matches the visible boundary. Reordering an existing child
does not announce it again; only genuinely appended complete-message nodes do. A primary
`pointerdown` begins scrollbar-drag tracking only when the scroll container itself is the event
target, never for arbitrary descendant controls.

**CSS parts:** `base` (the positioning root), `scroll` (the scroll container, non-live `role="log"`,
`tabindex="0"`; in virtual mode it stops scrolling itself, keeps the role, and drops its tab stop), `content` (the
slotted-content wrapper the growth observers watch), `jump-pill` (the built-in jump-to-latest button,
absent while `follow` is engaged), `unread-divider` (the "New messages" separator, slotted mode
only).

Renders no messages and computes no unread state itself — the host supplies `unreadStartIndex`; no
virtualization of its own (`lr-virtual-list`); not a generic overflow surface (`lr-scroller`); no
message semantics (`lr-chat-message`).

**Sizing in virtual mode.** `[part='scroll']` steps aside and the slotted `lr-virtual-list`'s own
viewport becomes the real scroller, so it is given this component's full height — otherwise it would
scroll inside `lr-virtual-list`'s `24rem` default no matter how tall the viewport is. An explicit
`block-size` on the slotted list is what makes that resolvable: without it the list host is
auto-height, its own base percentage chains to `auto`, and the two size each other circularly.
`<lr-thread-list>` solves the same problem by turning the internal list's shipped `24rem` into a
flex-basis through `::part(base)`, which is not available here — that list lives in the _consumer's_
light DOM, and `::slotted()` cannot be followed by `::part()`. Virtual mode therefore inherits this
component's existing requirement of a height-bounded parent, exactly as slotted mode's own
`[part='scroll']` already does. A document-tree declaration on the list (a consumer's own rule or an
inline style) still wins over the built-in one.

```html
<lr-chat-viewport unread-start-index="12" @lr-follow-change=${(e) => console.log(e.detail.following)}>
  <lr-chat-message message-role="user">…</lr-chat-message>
  <lr-chat-message message-role="assistant" status="streaming">
    <lr-streaming-text streaming .content=${partial}></lr-streaming-text>
  </lr-chat-message>
</lr-chat-viewport>
<lr-chat-composer status="streaming"></lr-chat-composer>
```

## `lr-suggestion-chips`

Starter prompts (empty thread) and follow-up suggestions (after a response) as a horizontally
scrollable chip row; activation hands the prompt to the host, which decides whether to compose it
into an input or send it directly. Never writes into a composer or sends anything itself.
Streaming-friendly: chips render through a keyed `repeat()` on `suggestionId`, so replacing
follow-ups mid-conversation preserves focus on any chip whose identifier survives; when the focused
identifier disappears, focus repairs to the nearest surviving occurrence without overriding a newer
external focus move.

**Properties:** `suggestions: readonly LyraChatSuggestion[] = []` (attribute: false) —
`LyraChatSuggestion { suggestionId: string; label: string; icon?: string; detail?: string }`
(exported here). Identifiers must be nonempty and unique; invalid/later duplicates are omitted with
the first valid occurrence winning. The input is clone-owned, bounded, and frozen; reassign a new
array after changing the sequence or a row. `icon` is an optional
peer-neutral literal hint (for example, an emoji), rendered decoratively before the text, and
`detail` is an optional secondary line. Empty renders nothing at all. `wrap: boolean = false`
(reflected) — wraps into multiple rows instead of a single horizontally scrollable line. `label:
string = ''` — accessible name for the group, defaults to the localized `suggestionsLabel`.

**Events:** `lr-suggestion-select` — `detail: { suggestionId, label }`.

**CSS parts:** `base` (the labeled group), `row` (the flex container holding the chips, present in
both the wrapping and the scrolling layout), `chip` (each suggestion button), `chip-icon` (the
optional decorative literal icon), `chip-label` (the primary text), `chip-detail` (the secondary
line, only rendered when `detail` is set).

**Themeable custom properties:** `--lr-suggestion-chips-justify` (default `flex-start`) — main-axis
packing of the chip row. Use `center` to center the chips under centered empty-state text: it centers
every line, the wrapped final one included, which styling `::part(base)` as a centered flex container
cannot do (once the chips wrap, the row fills the available inline size and each line packs to the
start). `--lr-suggestion-chips-hover-bg` (default `var(--lr-color-brand-quiet)`) — a `chip`'s
background on hover. `--lr-suggestion-chips-hover-border` (default `var(--lr-color-brand)`) — a
`chip`'s border color on hover. All three are declared as `var()` fallbacks at the point of use, not
on `:host`. Plus shared tokens `--lr-space-xs/-m/-2xs`,
`--lr-color-border/-surface/-text/-text-quiet`, `--lr-radius-pill`, `--lr-font-size-xs`,
`--lr-focus-ring-width/-color/-offset`.

**Optional peer deps:** none.

Keyboard: roving tabindex across chips; ArrowLeft/ArrowRight (direction-aware) plus Home/End;
Enter/Space activate. Renders inside an internal `lr-scroller` (`orientation="horizontal"`,
`hide-scrollbar`) unless `wrap` is set.

```html
<lr-suggestion-chips .suggestions=${followUps}
  @lr-suggestion-select=${(e) => (composer.value = e.detail.label)}></lr-suggestion-chips>
<lr-chat-composer></lr-chat-composer>
```

## `lr-thread-list`

The conversation sidebar: a grouped, searchable list of chat sessions with pin/archive/delete/rename
affordances. _Data mode_ (at least one valid `threads` record, or no valid records with nothing
slotted) renders every row as a `lr-conversation-item` inside an internal `lr-virtual-list` — virtualized by
construction, scroll position and per-row state survive a `threads` replacement; zero rows renders
the built-in empty state. _Slotted mode_ (no valid `threads` records _and_ real slotted content) renders
host-supplied `lr-conversation-item`s from the default slot as-is: no grouping, virtualization, or
row actions in that mode. No thread CRUD or persistence — every mutation
(`lr-thread-pin`/`-archive`/`-delete`/`-rename`) is a controlled event carrying the _requested_ new
state; the host mutates `threads`.

ArrowUp/ArrowDown/Home/End navigation skips rows that are disabled, hidden, `aria-hidden`, or
`inert` (including an inert ancestor introduced by `wrapRow`). Arrow navigation continues through
the complete item model at a virtual-window edge and mounts the next available row before moving
focus. Home/End always resolve the first/last thread from that complete model, even when focus
starts in a middle window; group records, collapsed-group contents, and unavailable endpoint rows
are skipped rather than becoming false boundaries.

**Exported types:** `LyraChatThread { id: string; title: string; excerpt?: string; timestamp?: Date |
string | number; pinned?: boolean; archived?: boolean }`; `ThreadRowAction = 'pin' | 'archive' |
'delete'`; `ThreadListGrouping = 'date' | 'custom' | 'none'`; `ThreadBucketKey = 'pinned' |
'today' | 'yesterday' | 'previous7' | 'previous30' | `month:${string}` | 'archived'`; and
`ThreadGroupContext { id: string; threads: readonly LyraChatThread[]; bucket?: ThreadBucketKey;
date?: Date }`. `LyraThreadList` and `LyraThreadListEventMap` are exported alongside them. The class
module, normal and stable tag-shaped registration entries, conversation family entry, and package
root all retain this complete thread-list surface; the former `ChatThread` name is not retained.
Data-mode thread ids must be nonempty, nonblank, and unique; invalid rows and later duplicates are
omitted with the first valid occurrence winning before the mode is selected, so focus, actions,
slot ownership, and emitted `conversationId` values remain unambiguous.

**Properties:** `threads: LyraChatThread[] = []` (attribute: false). `activeConversationId: string = ''`
(attribute `active-conversation-id`) — data mode:
marks the matching row `active`/`aria-current` and scrolls it into view. `searchable: boolean =
false` (reflected) — shows the built-in search field. `filter?: (thread, query) => boolean`
(attribute: false) — overrides the default case-insensitive `title` + `excerpt` substring match.
`grouping: ThreadListGrouping = 'date'` — data mode: bucket rows under localized date headers
(Pinned/Today/Yesterday/Previous 7 days/Previous 30 days/one bucket per month/Archived), use the
arbitrary grouping callbacks below, or render a flat list. `groupBy?: (thread: LyraChatThread) => string`
(attribute: false) derives each group id in `grouping="custom"`; omitting it leaves the custom mode
flat. `getGroupLabel?: (context: ThreadGroupContext) => string` (attribute: false) supplies the
plain-text accessible/visible label; `renderGroupAdornment?: (context) => TemplateResult` supplies
separate rich content beside the toggle without nesting it inside the button. `groupOrder?: string[] | ((a: string, b:
string) => number)` (attribute: false) supplies an explicit order or comparator; ids omitted from an
array follow in first-seen order. `collapsedGroupIds: string[] = []` (attribute: false) is the
controlled collapsed state for both date and custom groups. A collapsed group's header remains in
the virtual list while its conversation rows are removed from the virtual-list item/measurement
set; `lr-group-toggle` requests the matching state change. Group headers and threads use separate
internal key namespaces, so every public `activeConversationId` remains a raw thread id — even a value such as
`group:today` cannot collide with the `today` group header. `rowActions: ThreadRowAction[] = []`
(attribute: false, each `'pin' | 'archive' | 'delete'`) —
data mode only: built-in icon buttons rendered into each row's `actions` slot. `showArchived: boolean
= false` (attribute `show-archived`, reflected) — data mode: include `archived` threads (in their own
trailing group). `renamable: boolean = true` (reflected) — forwarded to each data-mode row's inline
rename. `compact: boolean = false` (reflected) — data mode only: forwarded to each row
`lr-conversation-item`'s own `compact`, tightening every row's padding and gaps from one attribute
(the density itself lives on the row item; retune it through
`--lr-conversation-item-compact-padding`/`-gap` on this element or any ancestor). Slotted mode is a
deliberate no-op — that mode renders host-supplied items as-is, so the host sets `compact` on its own
items there, the same division of responsibility slotted mode already has for every other row
property. `stickyGroups: boolean = false` (attribute `sticky-groups`, reflected) — data mode: pins
the current date/custom group's header to the top of the scroll viewport while its rows are in view,
pushing it off as the next group's header arrives. Group headers are ordinary virtualized rows, so
this renders an `aria-hidden` copy of the header into the internal `lr-virtual-list`'s sticky layer:
the real row keeps the `role="heading"`/`aria-level` semantics and the tab order (the copy's toggle
is not a second tab stop), while the pinned copy stays clickable and requests the same
`lr-group-toggle` collapse. Default `false` renders exactly as before; `grouping="none"` has no
headers to pin, so it is a no-op there. `label: string = ''` — accessible name for the list region,
defaults to the localized `threadListLabel`. `wrapRow?: (thread: LyraChatThread, row: TemplateResult) =>
TemplateResult` (attribute: false) — data mode only: wraps each row's built-in
`lr-conversation-item` with host-supplied content that has no home in the item's own `label`/`excerpt`/`meta`/`actions` surface (e.g. a leading purpose
icon — the item has no default slot to receive one); unset renders the built-in row unwrapped.
`renderActions?: (thread: LyraChatThread) => TemplateResult` (attribute: false) — data mode only:
appends host-supplied content (re-invoked per row on every render, e.g. an `lr-dropdown` containing `lr-menu` with custom
actions) after the built-in `rowActions` output in each row's `actions` slot; events it fires reach
the host normally and never trigger `lr-select`. An open nested `lr-dropdown` keeps its virtual row
above later rows even if focus temporarily leaves the menu. Unset renders only the built-in
`rowActions`.
`renderStart?: (thread: LyraChatThread) => TemplateResult` (attribute: false) — renders non-interactive
start-side content in each virtualized row. `renderExcerpt?: (thread: LyraChatThread) => TemplateResult`
(attribute: false) — renders rich content into the row item's own `excerpt` slot, winning over the
plain-string `excerpt` property (e.g. a server-highlighted search-match snippet), while leaving the
built-in label layout and inline-rename affordance untouched. `<mark>` descendants returned by this
hook receive the default, component-themeable highlight treatment documented below.
`renderMeta?: (thread: LyraChatThread) => TemplateResult` (attribute: false) — appends structured
metadata in the row's meta region.
`renderRowContent?: (thread: LyraChatThread) => TemplateResult` (attribute: false) — replaces the
conversation item's label/excerpt/meta content area with custom non-interactive row content.
`formatDate?: (date: Date) => string` (attribute: false) — overrides month-group date formatting.
Use `getGroupLabel` for every date/custom group label. When `wrapRow` is set, its
returned content is placed inside the library-owned `row-wrapper` part; that wrapper surrounds the
complete built-in row, including built-in `rowActions` and appended `renderActions` content inside
the conversation item's `actions` slot. Use `row-wrapper` for whole-row layout, `row-actions` for
the callback-output region, and the `row-item-*` parts for the conversation item's own internals.
With `wrapRow` unset, no wrapper element or `row-wrapper` part is rendered.

**Slots:** default — slotted mode only: host-supplied `lr-conversation-item`s, rendered in order.
`empty` — replaces the built-in empty state.

**Events:** data mode: `lr-select` (`detail: { conversationId }`), `lr-thread-pin`
(`detail: { conversationId, pinned }` — the requested new state), `lr-thread-archive`
(`detail: { conversationId, archived }`), `lr-thread-delete` (`detail: { conversationId }`, no
built-in confirmation), `lr-thread-rename` (`detail: { conversationId, label }`, correlated and
re-emitted from the owned row), `lr-filter-change` (`detail: { text, matchCount }`). Slotted mode
instead emits `lr-query-change` (`detail: { text }`) and never claims a match count it cannot own.
`lr-group-toggle` (`detail: { groupId, collapsed }` —
controlled intent; native group buttons provide Enter/Space activation and explicit
`aria-expanded="true"|"false"`). `searchable` only: `blur`/`focus` (no detail) — re-dispatched from
the internal search `<input>`'s own `blur`/`focus`, bubbling and composed unlike the native events,
which are neither.

**CSS parts:** `base`, `search`/`search-input` (the search field wrapper and `<input
type="search">`), `list` (the list region), `empty`, `viewport` (the actual internal virtual-list
scroll container, suitable for scrollbar styling), `row-action` (a built-in pin/archive/delete icon
button), `pin-glyph` (the small pin indicator on a pinned row), `group-header`, `group-toggle`,
`group-label`, `group-adornment`, `group-icon`, `group-sticky` (`sticky-groups` only: the pinned copy of the current
group's header, exported from the internal `lr-virtual-list`'s sticky layer — it wraps a full copy of
the `group-header`/`group-toggle`/`group-label`/`group-adornment`/`group-icon` markup, so those parts style the real
header row and the pinned copy alike, and the band itself is where a shadow or bottom border
belongs), `row` (all exported across the internal `lr-virtual-list` shadow
boundary), `row-wrapper` (the wrapper around `wrapRow` output, only present when `wrapRow` is set;
row-only — group headers are never passed through `wrapRow`, so they never carry it), and
`row-start`/`row-excerpt`/`row-content`/`row-meta`/`row-actions` (the library-owned wrappers around
their corresponding render-hook output; inherited fonts, layout values, and theme custom properties
reach callback-rendered descendants through these parts). `row-excerpt` wraps `renderExcerpt`
output, which is slotted into the row item's own `excerpt` slot.

Data mode additionally forwards each row `<lr-conversation-item>`'s own parts under a `row-item-`
prefix: `row-item-base`, `row-item-active-indicator`, `row-item-select-button`, `row-item-start`, `row-item-content`,
`row-item-label`, `row-item-label-input`, `row-item-rename-button`, `row-item-excerpt`,
`row-item-meta`, `row-item-timestamp`, `row-item-actions`.

**Themeable excerpt highlights:** `<mark>` descendants returned by `renderExcerpt` use
`--lr-thread-list-excerpt-highlight-background` (default `var(--lr-color-warning-quiet)`),
`--lr-thread-list-excerpt-highlight-foreground` (default `inherit`),
`--lr-thread-list-excerpt-highlight-radius` (default `var(--lr-radius-xs)`), and
`--lr-thread-list-excerpt-highlight-padding` (default `0`). These properties inherit through the
internal virtual-list shadow tree, so set them on `lr-thread-list` or any ancestor. They do not style
marks returned by `renderRowContent` or any other hook.

**Keep the two prefixes straight — they are different surfaces.** The `row-*` parts wrap _this_
component's own render-callback output (`wrapRow`, `renderStart`, `renderExcerpt`,
`renderRowContent`, `renderMeta`, `renderActions`); the `row-item-*` parts are the row item's
_internals_. Row density
in particular lives in `row-item-base`'s padding and `row-item-label`'s font size, so
`::part(row-item-base)` is the supported way to build a dense sidebar.

For plain row density, prefer the `compact` property above — it forwards straight to the row item's
own density knob. The `row-item-*` parts remain the lever for tuning beyond it (a different font
size, a different padding ratio):

```css
lr-thread-list::part(row-item-base) {
  padding-block: 0.25rem;
}
lr-thread-list::part(row-item-label) {
  font-size: 0.8125rem;
}
```

Do **not** reach for `::part(row) { --lr-theme-space-s: … }` instead. That is a whole-subtree
retheme: it shrinks everything nested inside the row, including the items of a `renderActions` menu,
which pushes their touch targets below the accessible minimum. The `row-item-*` parts exist so row
density can be tuned without that blast radius.

**Sizing:** the internal list fills whatever height this component is given, with no consumer CSS —
`[part='viewport']` is the real scroll container, and it falls back to `lr-virtual-list`'s own `24rem`
default only when the container has no resolvable height. This is deliberately _not_ implemented by
setting `--lr-virtual-list-height: 100%`: that percentage resolves against this host, which is a flex
item, so in an auto-height container it chains to `auto` and the viewport either collapses to zero
(with no rows) or grows to the full un-virtualized content height (with rows) — defeating
virtualization in both directions. Instead the list host is made a column flex container, which turns
the shipped `24rem` into a _flex-basis_: it grows to fill a bounded pane, shrinks below `24rem` in a
short one, and falls back to exactly `24rem` in an auto-height container.

`sticky-groups` keeps the current date group's header visible while scrolling through a long sidebar;
style the pinned band with `lr-thread-list::part(group-sticky)`.

```html
<lr-thread-list
  searchable
  sticky-groups
  .threads=${threads}
  active-conversation-id=${activeThreadId}
  .rowActions=${['pin', 'archive', 'delete']}
  @lr-select=${(e) => openThread(e.detail.conversationId)}
></lr-thread-list>
```

Composed with `lr-multi-split` (or `lr-app-rail` + `lr-responsive-panel`): thread-list in the start
pane driving `activeConversationId`, `lr-chat-viewport` + `lr-chat-composer` in the main pane.

## `lr-checkpoint`

An inline conversation restore point: a labeled marker between messages whose Restore affordance
confirms inline, then hands the host a `lr-restore` event. This component persists and restores
nothing itself — host state in, events out. Not a handoff or plain rule
(`lr-handoff-divider`/`lr-divider`); not branch navigation across regenerated variants
(`lr-branch-picker`); not recorded-run playback (`lr-sequence-playback`).

**Properties:** `checkpointId: string = ''` (attribute `checkpoint-id`) — opaque id echoed in the
`lr-restore` event detail. `label: string = ''` — checkpoint name; the localized `checkpointLabel`
fallback renders while empty. `timestamp?: LyraTimestamp` (`Date | string | number`, attribute:
false) — optional creation
time, rendered as `<time datetime>`, default `hour:minute` in `effectiveLocale`; invalid strings are
treated as unset. `formatTimestamp?: (date: Date) => string` (attribute: false) — overrides the
default rendering. `restorable: boolean = true` — when `false`, renders a plain marker with no
button. `confirmRestore: boolean = true` (attribute `confirm-restore`) — gates the event behind an
inline confirm step; a string-aware converter parses `confirm-restore="false"` correctly from plain
HTML. `restoring: boolean = false` (reflected) — host-set busy state: the Restore button becomes
`aria-disabled="true"` with a spinner beside the localized "Restoring…" text.

**Slots:** default — optional supplemental content under the marker row (e.g. what changed since
this point).

**Events:** `lr-restore` — `detail: { checkpointId, label }`; fired on Restore activation, after
the inline confirm when `confirmRestore` is on. Not cancelable.

**Methods:** `click()` forwards to the current Restore action only when restoration is available.
The confirm prompt names both Confirm and Cancel through `aria-describedby`; Escape/cancel restores
focus transactionally, and a same-turn controlled change that removes confirmation never lets a
stale focus continuation win.

**CSS parts:** `base` (`role="group"`), `line` (each of the two flanking rules), `icon` (bookmark
glyph), `label`, `timestamp`, `restore-button` (only while `restorable`), `confirm-group`,
`confirm-prompt`, `confirm-button`, `cancel-button`.

**Themeable custom properties:** `--lr-checkpoint-spin-duration` (default
`var(--lr-transition-ambient)`, the library's compound duration/timing-function token for infinite
"still alive" motion) — the restoring spinner's rotation cycle. Because that value carries a timing
function as well as a duration, it can only be spliced into the `animation` shorthand, never
assigned to `animation-duration` alone. The spinner stops outright under
`prefers-reduced-motion: reduce`.

```html
<lr-checkpoint checkpoint-id="ck_18" label="Before refactor" .timestamp=${t}
  @lr-restore=${(e) => restoreTo(e.detail.checkpointId)}></lr-checkpoint>
```

## `lr-usage-badge`

Compact, static resource strip for one message or run — tokens in/out, cost, latency — with a
hover/focus tooltip breakdown. Purely formatting: computes no counts, rates, or prices; every segment
is independently optional, and with nothing set, nothing renders at all (not even a focusable shell).
The tooltip reuses `lr-tool-call-chip`'s hover/focus/Escape/`aria-describedby` contract wholesale.
Not `lr-context-meter` (occupancy of a fixed capacity); not `lr-generation-metrics` (live, with a
Stop button) — this is static after the fact.

**Properties:** `tokensIn?: number` (attribute `tokens-in`) — input tokens, normalized to a
non-negative integer, locale-formatted; segment omitted while unset/non-finite. `tokensOut?: number`
(attribute `tokens-out`) — same rules. `costText: string = ''` (attribute `cost-text`) —
pre-formatted cost (e.g. `"$0.012"`), rendered verbatim. `latencyMs?: number` (attribute
`latency-ms`) — formatted with the shared duration algorithm (`820 -> "820ms"`, `1500 -> "1.5s"`), or
`formatLatency` when set. `formatLatency?: (ms: number) => string` — overrides the built-in duration
algorithm (which has no minutes/hours tier) in both the visible strip and the tooltip row; mirrors
`lr-activity-feed`'s `formatTimestamp` convention. `abbreviate: boolean = false` (reflected) — token
counts render via `Intl.NumberFormat` `notation: 'compact'` (`12345 -> "12K"`); the tooltip always
shows full grouped figures. This badge has no density mode: the old `compact` spelling of this
property was removed in 9.0.0 (it collided with `compact`'s density meaning everywhere else in the
library) — rename `compact` to `abbreviate`; a stale `compact` attribute is inert. `summary: string =
''` supplies visible fallback text when no built-in segment is present.

**Slots:** `summary` — visible summary when no built-in segment is set (takes precedence over the
property); `details` — extra rows appended below the built-in tooltip breakdown (e.g. cache-read
tokens). Interactive descendants are inert because this is a tooltip, while their accessible text
is mirrored into the trigger description. Details without a visible summary remain non-focusable.

**CSS parts:** `base` (a focusable non-button `role="group"` only when content is both visible and
describable), `summary`, `tokens-in`, `tokens-out`, `cost`, `latency`, `tooltip`.

```html
<lr-chat-message message-role="assistant" status="sent">
  <lr-usage-badge
    slot="badges"
    tokens-in="1204"
    tokens-out="386"
    cost-text="$0.012"
    latency-ms="2350"
  ></lr-usage-badge>
  <lr-markdown .content="${answer}"></lr-markdown>
</lr-chat-message>
```

## `lr-widget-renderer`

Renders an agent-streamed version-two declarative JSON widget document through an immutable,
allowlisted `type -> lyra tag` registry. Mapped tags and children render declaratively, so populated
documents work during SSR without a global `document`; primitive mapped props remain property-only
and are assigned during hydration. Keyed reconciliation preserves the mapped element's focus,
scroll position, and internal state across streamed document updates. Built-in `row`/`col`/`text`
structural nodes render through ordinary nested templates. Not a
form runtime (no input/select/form types in the default registry), no expression language or
implicit state mutation, no remote widget/schema fetching, and it never renders arbitrary HTML or
navigates (no `href` props are allowlisted anywhere). Controlled state binding is deliberately
narrow: a versioned document may bind an allowlisted primitive prop to a JSON Pointer, and the host
must apply every requested change itself.

**Exported types:**

- `LyraWidgetNode { readonly type: string; readonly id?: string; readonly props?:
Readonly<Record<string, unknown>>; readonly children?: readonly (LyraWidgetNode | string)[];
readonly slot?: string; readonly actionId?: string; readonly payload?: unknown }` — `id` is a stable public
  identity and reconciliation key. Bound/actionable nodes require a unique, nonempty id; other
  nodes fall back to a deterministic structural `nodePath`. `slot` is honored only when the parent
  type allowlists it, `actionId` arms the type's declared action trigger, and `payload` is echoed
  back in `lr-widget-action`.
- `LyraWidgetBinding { $bind: string; fallback?: string | number | boolean | null }` — an explicit JSON
  Pointer lookup used as an allowlisted prop value. `fallback` is used only when the pointer cannot
  resolve.
- `LyraWidgetDocument { readonly version: '2'; readonly root: LyraWidgetNode }` — the sole versioned tree source.
- `createWidgetDocument(root: LyraWidgetNode): LyraWidgetDocument` — creates an immediate frozen
  version-two snapshot for former unversioned tree assignments. Traversal uses the renderer's depth,
  node, and per-node prop ceilings; malformed, cyclic, duplicate-id, or hostile structure throws
  `TypeError`. Node records, child arrays, and prop records are copied and frozen, while opaque prop
  values and action payloads intentionally retain caller identity.

The package root and the normal `widget-renderer.js` registration entry expose the renderer
`LyraWidgetRenderer`/`LyraWidgetRendererEventMap` together with the complete stable authoring
surface: `LyraWidgetNode`, `LyraWidgetBinding`, `LyraWidgetDocument`, `createWidgetDocument`,
`LyraWidgetPropType`, `LyraWidgetInteraction`, `LyraWidgetTypeDefinition`,
`LyraWidgetTypeRegistry`, `createWidgetTypeRegistry`, `isWidgetTypeRegistry`, and
`DEFAULT_WIDGET_TYPE_REGISTRY`. Advanced consumers that need `resolveTree`, `ResolveContext`,
`ResolvedNode`, `ResolvedText`, or `ResolvedElement` import the explicit expert route
`@aceshooting/lyra-ui/components/conversation/widget-renderer/resolve.js`. Pointer-reading helpers
and the resolver's hard safety ceilings remain internal implementation details.

The expert route's exact resolver contracts are `ResolvedText { nodeKey: string; nodePath: string;
kind: 'text'; text: string; slot?: string }`, `ResolvedElement { nodeId?: string; nodeKey: string;
nodePath: string; kind: 'builtin-row' | 'builtin-col' | 'builtin-text' | 'mapped'; tag?: string;
interactive: boolean; props: Record<string, unknown>; actionEvent?: string; actionId?: string;
payload?: unknown; bindings: Array<{ prop: string; path: string; event?: string }>; children:
ResolvedNode[]; slot?: string }`, and `ResolveContext { registry: LyraWidgetTypeRegistry;
bindingState: unknown; warned: Set<string>; warn?: (message: string) => void }`.
`resolveTree(root: LyraWidgetNode | null | undefined, ctx: ResolveContext): ResolvedNode | null`
resolves one bounded snapshot; invalid structure returns `null`.

**Properties:**

- `document: LyraWidgetDocument | null = null` (property only) — the sole tree source. `null`
  renders an empty base; a present document with an invalid/missing root fails closed, clears prior
  output, and emits exactly one `lr-render-error`.
- `bindingState?: unknown` (property only) — explicit controlled binding state. `null` is a real
  state value, not an absence sentinel.
- `registry: LyraWidgetTypeRegistry = DEFAULT_WIDGET_TYPE_REGISTRY` (property only) — immutable
  per-instance registry; mutable structural `Map` values are rejected.

**Registry module (`widget-renderer/registry.js`):**
`createWidgetTypeRegistry(entries?: Iterable<readonly [string, LyraWidgetTypeDefinition]>):
LyraWidgetTypeRegistry` validates, snapshots, and freezes a unique-key registry;
`isWidgetTypeRegistry(value: unknown): value is LyraWidgetTypeRegistry` is its untyped-boundary
guard. `LyraWidgetTypeRegistry extends ReadonlyMap<string,
Readonly<LyraWidgetTypeDefinition>> {}` is an opaque branded snapshot, so a mutable structural
`Map` is not assignable. `LyraWidgetTypeDefinition { tag: string; interaction:
'none' | 'control'; props?:
Record<string, 'string' | 'number' | 'boolean'>; forcedProps?: Record<string, unknown>; slots?:
string[]; action?: { event: string }; bindings?: Record<string, { event: string }> }` — `tag` is
resolved prefix-aware, `props` is a prop allowlist (a prop absent here, or whose runtime type doesn't
match, is silently skipped — never assigned),
`forcedProps` always apply and are never overridable by `LyraWidgetNode.props`, `slots` allowlists child
`slot` names (a disallowed one renders unslotted rather than being dropped), and `action.event` is
the native/custom DOM event that arms `lr-widget-action` when a node also sets `actionId`.
`bindings?: Record<string, { event: string }>` maps an allowlisted prop to the control event that
requests its controlled update. `interaction` is explicit: actions/bindings require `control`, and
a control descendant under another control fails closed. `DEFAULT_WIDGET_TYPE_REGISTRY` is the
frozen built-in snapshot; there are no module-global register/clear/get mutation APIs.

**Built-in schema:** `text` (plain text node) and `row`/`col` (internal flex wrappers; props `gap:
's'|'m'|'l'`, `align: 'start'|'center'|'end'|'stretch'`, `justify:
'start'|'center'|'end'|'between'`) are structural and cannot be registered. The immutable
`DEFAULT_WIDGET_TYPE_REGISTRY` maps `card` →
`lr-card` (`appearance`), `badge` → `lr-badge` (`variant`), `button` → `lr-button` (`variant`,
`appearance`, `size`, `disabled`, `loading`; action: `click`), `stat` → `lr-stat` (`label`,
`value`, `unit`, `variant`, `caption`, `sub`), `result-card` → `lr-result-card` (`title`),
`result-field` → `lr-result-field` (`label`, `value`), `markdown` → `lr-markdown` (`content`),
`image` → `lr-media-card` (`src`, `alt`, `filename`; forced `{ kind: 'image' }`). The registration
entry defines those eight mapped custom elements and `lr-widget-renderer`; it installs no mutable
module-global registry state.

**Events:** `lr-widget-action` — `detail: { actionId, payload, nodeId, nodeKey, nodePath }`, the single bubbling action
channel. `lr-render-error` — `detail: { error }`, the root or a reachable nested node was
structurally unusable (including a non-object node, invalid `props`/`children` shape, or a tree the
depth/size caps made empty). The rejected update clears prior rendered content and emits this event
once rather than throwing. `lr-widget-state-change` —
`detail: { path, value, nodeId, nodeKey, nodePath, prop }`, emitted when a bound mapped control
requests a controlled update. The renderer never mutates caller data; assign a new `bindingState`
value to complete the update.

**CSS parts:** `base` (the root wrapper, `display: contents`), `row`, `col`, `text` (built-in
structural nodes only — a mapped lyra component exposes its own parts instead).

Caps: depth 32, 5,000 nodes, 100 visited props per node, and 100 unique warning keys plus one
deterministic suppression warning. The current document/registry generation deduplicates warnings;
binding-state-only re-resolution stays quiet, while replacing the root or registry releases prior
keys. Exported deterministic `nodeKey`/`nodePath` identity drives reconciliation. One bounded input
snapshot is shared by traversal, identity validation, pointer resolution, and rendering, so getters
beyond an admitted cap are never dereferenced.

```ts
import { html } from "lit";
import {
  createWidgetDocument,
  createWidgetTypeRegistry,
  DEFAULT_WIDGET_TYPE_REGISTRY,
} from "@aceshooting/lyra-ui/components/conversation/widget-renderer/widget-renderer.js";
import "@aceshooting/lyra-ui/components/data/sparkline/sparkline.js";
import { tag } from "@aceshooting/lyra-ui/utilities/prefix.js";

const registry = createWidgetTypeRegistry([
  ...DEFAULT_WIDGET_TYPE_REGISTRY,
  [
    "sparkline",
    { tag: tag("sparkline"), interaction: "none", props: { data: "string" } },
  ],
]);
const widgetDocument = createWidgetDocument(msg.widget);
const view = html`<lr-widget-renderer
  .document=${widgetDocument}
  .registry=${registry}
  @lr-widget-action=${(event: CustomEvent) =>
    sendToAgent(event.detail.actionId, event.detail.payload)}
></lr-widget-renderer>`;
```

For a controlled binding, use a per-instance registry and apply the event's requested value back to
`bindingState` (this one-field example binds `/name`). This is also the lean registration route: it imports
the side-effect-free renderer class, defines only `lr-widget-renderer`, and imports only the mapped
input registration. Do not import `widget-renderer.js` on this route; that entry intentionally
installs the full default registry.

```html
<lr-widget-renderer id="bound-widget"></lr-widget-renderer>
```

```js
import { LyraWidgetRenderer } from "@aceshooting/lyra-ui/components/conversation/widget-renderer/widget-renderer.class.js";
import { createWidgetDocument } from "@aceshooting/lyra-ui/components/conversation/widget-renderer/resolve.js";
import { createWidgetTypeRegistry } from "@aceshooting/lyra-ui/components/conversation/widget-renderer/registry.js";
import { defineElement, tag } from "@aceshooting/lyra-ui/utilities/prefix.js";
import "@aceshooting/lyra-ui/components/forms/input/input.js";

defineElement("widget-renderer", LyraWidgetRenderer);

const renderer = document.querySelector("#bound-widget");
renderer.registry = createWidgetTypeRegistry([
  [
    "bound-input",
    {
      tag: tag("input"),
      interaction: "control",
      props: { label: "string", value: "string" },
      bindings: { value: { event: "lr-input" } },
    },
  ],
]);
renderer.document = createWidgetDocument({
  type: "bound-input",
  id: "name",
  props: { label: "Name", value: { $bind: "/name", fallback: "" } },
});
renderer.bindingState = { name: "Ada" };
renderer.addEventListener("lr-widget-state-change", (event) => {
  renderer.bindingState = { name: event.detail.value };
});
```

**Optional peer deps:** none new — the normal registration entry directly imports the eight mapped
components (`markdown` keeps its own `marked`/`dompurify` optional-peer fallback). The manual class
route above is the verified lean path: its real peer-inclusive esbuild metafile excludes
`default-registry.js` and all eight default mapped class modules, while the consumer explicitly
imports only the component registrations its per-instance registry maps.

## `lr-voice-picker`

A TTS voice selector over a host-supplied `catalog`, mirroring `lr-model-select`'s
closed-dropdown/free-text-combobox dual mode, stale-value handling, and form-association verbatim
(see that section for the full mode-switching contract this one shares), extended with a
TTS-agnostic preview affordance. Each new target is event-first: its cancelable
`lr-preview-request` fires before that target can start. Left un-prevented, a `previewUrl` plays
through one internal native `<audio>` (validated by `safeMediaSrc()` first); `preventDefault()` or no
URL leaves playback to the host's own TTS. Requesting the same voice while it's already playing
internally stops it instead of re-requesting; requesting a different voice retires the old resource
and publishes its terminal change before dispatching the new request. Internal playback becomes
public only after the still-current `audio.play()` promise
fulfills; a rejected pending play emits neither a false start nor a false stop. Committed-value,
active-option, and catalog changes likewise retire an internal preview before the visible preview
control changes target; closing or filtering also retires a row-owned preview once no rendered
control represents it. Does not synthesize speech, fetch catalogs, or persist selection; not a
persona picker; `lr-model-select` stays for LLMs.

**Exported types:** `LyraVoiceCatalogEntry extends LyraCatalogEntry { language?: string;
description?: string; previewUrl?: string }` — `language`/`description` render as a quiet
`[part="option-meta"]` second line. Voice catalogs use the shared
`LyraCatalog<LyraVoiceCatalogEntry>` homogeneous readonly union documented under `lr-model-select`.
The public `size` property uses `LyraSize`, including the long-form aliases.
`LyraVoicePickerSelectionDirection = 'forward' | 'backward' | 'none'` is the native
selection direction exposed in free-text mode.

**Properties:** `provider: string = ''` — informational only (e.g. `'elevenlabs'`); rendered as a
small leading badge. `catalog?: LyraCatalog<LyraVoiceCatalogEntry>` (attribute: false) — the full
voice list; omit (or leave empty) to fall back to plain free-text entry; replacing it retires any
internal preview before the rendered candidate changes. Ids use the shared unique, nonempty,
first-wins catalog rule documented under `lr-model-select`, including preview lookup. Assignments
become bounded clone-owned frozen snapshots; create and reassign a new array after row changes.
`allowCustom: boolean = false` (attribute
`allow-custom`, reflected) — let the user type/commit a value that isn't in `catalog`. `preview:
boolean = true` (reflected) — whether to render preview affordances at all. `label: string = ''`,
`hint: string = ''`, `errorText: string = ''` (attribute `error-text`), `placeholder: string = ''`,
`spellcheck: boolean = true` (string-aware converter, same as `lr-model-select`), `autocapitalize:
string = ''`, `autoCorrect: string = ''` (attribute `autocorrect`), `autocomplete: string = 'off'`,
`inputMode: string = ''` (attribute `inputmode`), `enterKeyHint: string = ''` (attribute
`enterkeyhint`), and `open: boolean = false` (reflected) — all mirror `lr-model-select`'s
identically-named properties. `size: LyraSize = 'm'` (reflected) selects the shared
`2xs`/`xs`/`s`/`m`/`l`/`xl` control ladder; `small`/`medium`/`large` render as aliases of
`s`/`m`/`l`. It scales both closed and free-text field chrome through the shared
`--lr-form-control-*` metrics. The separate preview button retains the library-wide 40px minimum
hit area at compact tiers and grows with `l`/`xl`.

The `label` property and `label` slot share one native label in the standard `form-control` frame.
Slotted label content participates in the accessible name in both closed-dropdown and free-text
modes; an explicit host `aria-label` remains the highest-precedence name.

**Form association:** hand-rolled via `attachInternals()`, mirroring `lr-model-select`: live,
non-reflecting `value: string = ''` (the current voice id), reflected
`defaultValue: string = ''` (attribute `value`, the current reset default), reflected
`customError: string | null = null` (`custom-error`), `name`, `disabled`
(reflected), and `required` (reflected — enforced via `internals.setValidity()`). Their exact
signatures are `name: string = ''`, `disabled: boolean = false`, and `required: boolean = false`.
It also exposes `form: HTMLFormElement | null = null`, readonly `labels: NodeList`, `validity:
ValidityState`, `validationMessage: string`, `willValidate: boolean`, and `effectiveDisabled:
boolean`, plus
`checkValidity()`/`reportValidity()` and `setCustomValidity(message: string)`. The last is the
standard channel for a server-side rejection ("that voice is not enabled for your account") no
client-side constraint can express: a non-empty `message` raises `customError` and becomes
`validationMessage`, so the control fails `checkValidity()`, blocks submission, and matches
`:state(invalid)`; `''` clears only that consumer layer, leaving a `required` picker with no value
still `valueMissing`. The custom error survives every intrinsic recomputation in between and a
`form.reset()`, matching a native control, and the message is used verbatim, never localized.
`getForm()` returns the browser-resolved owning form.

**Methods:** `click()` (override) — closed-dropdown mode forwards a real `.click()` to the trigger
`<button>`, whose own `@click` handler opens it; free-text mode calls `.focus()` on the combobox
`<input>`, since a synthetic `.click()` on a text input never dispatches `focus` the way a real
click's `mousedown` default action does, and this mode's open behavior is wired to the input's
native `focus` event, not a `click` handler on the input itself. Mirrors `<lr-button>`'s host
`click()` forwarding while retaining voice-picker's focus-only free-text behavior.
`focus(options?)` and `blur()` forward to whichever internal control the active mode renders.
In free-text mode, `input: HTMLInputElement | null`, `selectionStart: number | null`,
`selectionEnd: number | null`, and `selectionDirection: LyraVoicePickerSelectionDirection | null`
mirror the native input. `select()`, `setSelectionRange(start, end, direction?)`, and overloaded
`setRangeText(replacement[, start, end, selectMode])` likewise forward native editing operations;
`setRangeText()` synchronizes the picker `value`, form entry, and validity without emitting user
`input`/`change` events. Those text APIs return `null` or are no-ops in closed-dropdown mode and
before the input renders.

**Events:** `lr-change` — `detail: { value, inCatalog }`. `lr-preview-request` — `detail: {
voiceId, previewUrl? }`, cancelable. `lr-preview-change` — `detail: { voiceId }`, internal playback
started (`voiceId`, only after `play()` fulfills) or stopped (`null`); a pending rejection emits
neither. Plus owner-realm native `input`/`change` (retaining each free-text `InputEvent` payload)
and native `FocusEvent` `focus`/`blur` (retaining `relatedTarget`), with `lr-focus`/`lr-blur`
compatibility aliases. The trigger/input, listbox popup, and sibling preview control form one focus
boundary, so moving within them does not close or touch the picker and only leaving the component
emits the outer pair. One bubbling/composed `lr-invalid` alias fires when native validity fails.

**Slots:** `label` (custom visible label content), `hint`, `error`.

**The required marker and barred validity.** Identical to `lr-model-select`'s (see that section): a
`required` picker with a non-empty `label` paints the shared required marker on
`[part="form-control-label"]`, retunable or suppressible through
`--lr-form-control-required-content`, `--lr-form-control-required-color` and
`--lr-form-control-required-offset`; and while the picker is barred from
constraint validation (own `disabled`, or an ancestor `<fieldset disabled>` — there is no `readonly`
here) it reports no violation and publishes neither `:state(invalid)` nor `:state(user-invalid)`.

**CSS parts:** `form-control` (the complete field frame), `form-control-label`, `trigger` (closed-dropdown mode), `combobox`/`combobox-input`
(free-text mode), `provider-badge`, `listbox`, `option`, `option-label`, `option-meta` (the quiet
`language · description` second line), `option-badge` (the "not in catalog" badge on a synthetic
stale-value row), `option-preview` (a pointer-only per-row preview icon, `tabindex="-1"`,
`aria-hidden`), `preview-button` (the standalone, keyboard-reachable preview toggle beside the
trigger), `expand-icon`, `empty`, `hint`, `error`.

```html
<lr-voice-picker provider="elevenlabs" .catalog=${voices} allow-custom
  @lr-change=${(e) => setVoice(e.detail.value)}
  @lr-preview-request=${(e) => {
    if (!e.detail.previewUrl) {
      e.preventDefault();
      playSample(e.detail.voiceId);
    }
  }}
></lr-voice-picker>
```

**Known gotchas:**

- Listbox options must not contain tab-focusable controls, so preview is accessible via the
  standalone `[part="preview-button"]` beside the trigger (previews the active option while open,
  else the committed value) — the per-row `[part="option-preview"]` icon is a pointer-only
  duplicate (`tabindex="-1"`, `aria-hidden="true"`).
- `catalog` must be homogeneous — the same shared `LyraCatalog<T>` constraint documented for
  `lr-model-select`.

**Additional API surface:**

- `--lr-voice-picker-gap` — Gap between the field and preview action, and between trigger,
  combobox, and option children. Default: `var(--lr-space-xs)`.
- `--lr-voice-picker-radius` — Trigger, combobox, listbox, option, and preview-action corner radius.
  Default: `var(--lr-form-control-radius)`.
- `--lr-voice-picker-preview-active-border` — Active preview border. Default: `var(--lr-color-brand)`.
- `--lr-voice-picker-preview-active-color` — Active preview icon. Default: `var(--lr-color-brand)`.
- `--lr-voice-picker-open-border-color` — Open trigger border color. Default: `var(--lr-color-brand)`.
- `--lr-voice-picker-option-active-bg` — Active option fill. Default: `var(--lr-color-brand-quiet)`.
- `--lr-voice-picker-option-selected-border` — Selected option border. Default: `var(--lr-color-brand)`.
- `--lr-voice-picker-option-selected-color` — Selected option text. Default: `var(--lr-color-brand)`.
- `--lr-voice-picker-option-selected-bg` — Selected option fill. Default: `transparent`.
- `--lr-voice-picker-option-selected-font-weight` — Selected option label weight. Default: `var(--lr-font-weight-semibold)`.
- `--lr-voice-picker-option-synthetic-border-style` — Synthetic stale-value row border style. Default: `dashed`.
- `--lr-voice-picker-option-synthetic-border-color` — Synthetic stale-value row border color. Default: `var(--lr-color-border)`.
- `--lr-voice-picker-option-synthetic-font-style` — Synthetic stale-value option-label font style. Default: `italic`.
- `--lr-voice-picker-preview-hover-bg` — Preview hover fill. Default: `var(--lr-color-brand-quiet)`.
- `--lr-voice-picker-preview-hover-color` — Preview hover icon. Default: `var(--lr-color-brand)`.

## `lr-agent-workspace`

Responsive, fully controlled shell for an AI conversation and its supporting run, tool, retrieval,
grounding, and context state: transcript + composer in the main pane, and a details pane composing
`lr-agent-run`, `lr-tool-timeline`, `lr-retrieval-results`, `lr-grounding-summary`, and
`lr-context-inspector`. Performs no network requests, model calls, retrieval, or persistence —
assign new data to the properties as the host receives updates.

This is the single component that binds the most of the provider-neutral vocabulary exported from
`@aceshooting/lyra-ui/ai` (`src/ai/types.ts`) at once; a host that already holds `ChatMessage[]`,
`AgentRun`, `RetrievalChunk[]`, `Citation[]`, and `GroundingAssessment` can wire this up with no
adapters.

**Properties (transcript):**

- `messages: ChatMessage[] = []` (attribute: false) — **`ChatMessage` from
  `@aceshooting/lyra-ui/ai`**: `{ id: string; role: ChatMessageRole; status?: ChatMessageStatus;
timestamp?: Date | string; text?: string; attachments?: DocumentRef[]; parts?: MessagePart[];
metadata?: Record<string, unknown> }`. Each entry renders as an `lr-chat-message` whose
  `role`/`status`/`timestamp` come straight across. A nonempty `parts` array renders in order through
  `lr-message-parts` and takes precedence over the legacy `text` shortcut; otherwise `text` renders
  as sanitized Markdown through `lr-markdown`. Replace the whole region with the `messages` slot for
  richer bodies. Empty ids and later duplicates are omitted first-wins before the latest 500 valid
  identities are chosen, so malformed tail rows cannot evict earlier valid messages. Host owns
  ordering, updates, and persistence
- `follow: boolean = true` (reflected) — forwarded to the internal `lr-chat-viewport`
- `unreadStartIndex: number | null = null` (attribute `unread-start-index`) — forwarded to the viewport

**Properties (details pane):**

- `run: AgentRun | null = null` (attribute: false) — **`AgentRun` from `@aceshooting/lyra-ui/ai`**:
  `{ id: string; status: AgentStatus; startedAt?: number; endedAt?: number; model?: string;
costEstimate?: number; steps: AgentStep[] }` (epoch-ms timestamps). `null` omits the run section
- `metrics: AgentRunMetric[] = []` (attribute: false) — `lr-agent-run`'s own
  `AgentRunMetric { id: string; label: string; value: string | number; variant?: BadgeVariant }`,
  e.g. token counts or latency
- `tools: ToolTimelineEntry[] = []` (attribute: false) — `lr-tool-timeline`'s
  `ToolTimelineEntry extends ToolInvocation` (i.e. `{ id, name, args, status, result?, error? }` from
  `@aceshooting/lyra-ui/ai`) plus `{ startedAt?: number; endedAt?: number; retryCount?: number;
redactedFields?: string[]; needsApproval?: boolean; approved?: boolean }`
- `retrievalChunks: RetrievalChunk[] = []` (attribute: false) — **`RetrievalChunk` from
  `@aceshooting/lyra-ui/ai`**: `{ id, text, score, source: DocumentRef, metadata? }`, forwarded to
  `lr-retrieval-results`
- `selectedRetrievalIds: string[] = []` (attribute: false) — controlled selection forwarded to
  `lr-retrieval-results.selectedIds`
- `retrievalLoading: boolean = false` (attribute `retrieval-loading`), `retrievalHasMore: boolean =
false` (attribute `retrieval-has-more`), `retrievalErrorText: string = ''` (attribute
  `retrieval-error-text`, caller-supplied text) — all forwarded to `lr-retrieval-results`
- `groundingAssessment: GroundingAssessment | null = null` (attribute: false) — **`GroundingAssessment`
  from `@aceshooting/lyra-ui/ai`**: `{ supportedClaims, unsupportedClaims, coverage, confidence?,
warnings? }`
- `citations: Citation[] = []` (attribute: false) — **`Citation` from `@aceshooting/lyra-ui/ai`**,
  shown alongside the grounding summary
- `contextSegments: ContextInspectorSegment[] = []` (attribute: false) — `lr-context-inspector`'s
  `{ id: string; label: string; text: string; tokens: number; tone?: ContextMeterTone; citation?:
Citation; truncated?: boolean; omittedTokens?: number; redactions?: ContextInspectorRedaction[] }`
- `contextTotal: number = 0` (attribute `context-total`) — the overall context-window token budget
- `showDetails: boolean = true` (attribute `show-details`, reflected) — whether the details pane is
  available at all when data is present

**Properties (composer / chrome):**

- `showComposer: boolean = true` (attribute `show-composer`, reflected) — whether the built-in
  plain-frame composer renders when no `composer` slot is supplied. Its workspace-owned dock supplies
  the border and padding; a supplied `composer` slot keeps its own frame.
- `composerValue: string = ''` (attribute `composer-value`) — controlled composer value
- `composerStatus: ChatComposerStatus = 'idle'` (attribute `composer-status`) — `'idle' | 'sending' |
'streaming'`, `lr-chat-composer`'s own union
- `composerPlaceholder: string = ''` (attribute `composer-placeholder`)
- `composerMinRows: number = 1` (attribute `composer-min-rows`), `composerMaxRows: number = 8`
  (attribute `composer-max-rows`)
- `label: string = ''` — accessible name and visible heading
- `accessibleLabel: string | null = null` (attribute `aria-label`) — host-level accessible-name
  override for the internal `role="region"` root

**Events:**

- `lr-input` (`detail: { value: string }`) / `lr-submit` (`detail: { value: string }`) / `lr-stop`
  (`detail: null`) — forwarded from the built-in composer.
- `lr-message-retry` (`detail: { messageId: string }`) — a data-driven message's retry action.
- `lr-follow-change` (`detail: { following: boolean }`) — forwarded from the transcript viewport.
- `lr-retrieval-select` (`detail: RetrievalResultsSelectDetail` = `{ ids: string[]; chunks:
RetrievalChunk[] }`) — forwarded from the built-in retrieval results.
- `lr-citation-select` (`detail: CitationSelectEventDetail` = `{ citation: Citation }`, from
  `@aceshooting/lyra-ui/ai`) — forwarded from the built-in grounding summary.
- `lr-tool-approval-decide` (`detail: ToolTimelineApprovalDetail` = `ToolApprovalEventDetail &
{ args?: unknown }` = `{ invocationId: string; approved: boolean; args?: unknown }`) — forwarded
  from the built-in tool timeline; `args` is present only on approval and may differ from what the
  entry originally proposed (the dialog's inline edit step).
- `lr-cancel` (`detail: CancelEventDetail = { reason?: string }`) / `lr-run-retry` (`detail: RetryEventDetail` =
  `{ attempt: number; messageId?: string }`, from `@aceshooting/lyra-ui/ai`) — forwarded from the
  built-in agent run. The distinct retry name prevents a rendered message or attachment retry from
  being mistaken for a whole-run retry.

**Slots:** `messages` (replaces the data-driven transcript message list; assign ordinary messages
directly, or exactly one `lr-virtual-list` when the slot itself owns virtualization), `details` (replaces the
built-in run/tool/retrieval/grounding/context details pane while keeping the responsive shell),
`composer` (replaces the built-in plain-frame `lr-chat-composer`; supplied content keeps its own
frame), `header-actions` (model selection, settings, export controls).

**CSS parts:** `base`, `header`, `heading`, `header-actions`, `body`, `conversation`, `viewport` (the
composed `lr-chat-viewport`), `messages`, `messages-empty`, `details`, `details-content`, `section`
(one run/tools/retrieval/grounding/context section), `section-heading`, `composer`, `composer-input`,
`message`
(the composed `lr-chat-composer`).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none of its own; the composed `lr-markdown` keeps its `marked`/`dompurify`
optional-peer fallback.

Every public data/value property is controlled: forwarded child intents bubble without mutating
`messages`, `composerValue`, selections, run state, or persistence-owned data inside the shell.

## `lr-message-parts`

Ordered renderer for provider-neutral `MessagePart[]`: text, reasoning, tool call/result, citation,
attachment, data/widget, audio, and error parts can interleave without flattening stream order.
Built-in text and reasoning Markdown receives each part's `state === 'streaming'` hint, coalescing
parse/highlight work; replacing that same-id part with `state: 'complete'` flushes the final content.
Citation badge ranks are precomputed in one linear pass per render, rather than rescanning and
allocating every preceding part for each citation in a citation-heavy or growing message.

**Properties:** `parts: MessagePart[] = []` (attribute: false); `contentMode: 'plain' | 'markdown' =
'markdown'` (attribute `content-mode`, reflected) and `showReasoning: boolean = true` (attribute
`show-reasoning`, reflected, with string-aware true-default conversion);
`renderPart?: MessagePartRenderer` (attribute: false), where returning `undefined` delegates that
part to the built-in renderer; `accessibleLabel: string | null = null` (attribute `aria-label`).

`MessagePartRenderer = (part: MessagePart, index: number) => unknown`; `MessagePart` and its
discriminated part shapes come from the `@aceshooting/lyra-ui/ai` subpath. Tool results are a strict
success/error union: a success has `result` and cannot have `error`; an error has `error` and may
retain partial `result`. Audio is a single `{ type: 'audio'; src?; transcript?; mimeType? }` part,
and data parts carry exactly one of `data` or `widget`. Empty ids and later duplicate occurrences
are ignored so each rendered identity and announcement remains unambiguous.

**Events:** `lr-citation-select` (`{ citation }`), `lr-part-retry` (`{ part }`). Composed child
events pass through unchanged: `lr-anchor-result`, `lr-citation-open`, `lr-copy`,
`lr-highlight-activate`, `lr-link-click`, `lr-preview-request`, `lr-remove`, `lr-render-error`, `lr-retry`,
`lr-search-change`, `lr-text-select`, `lr-toggle`, `lr-tool-call-chip-select`, `lr-widget-action`,
and `lr-widget-state-change`. The `lr-tool-chip-select` alias passthrough was removed in 9.0.0.

**CSS parts:** `base`, `part`, `part-streaming`, `text`, `reasoning`, `tool-call`, `tool-result`,
`tool-result-error`, `citation`, `attachment`, `data`, `audio`, `audio-control`,
`audio-transcript`, `error`, `retry`.

**Themeable custom properties:** `--lr-message-parts-streaming-color` (default
`var(--lr-color-text-quiet)`) controls a streaming wrapper's inherited text color.
`--lr-message-parts-audio-transcript-color` (default `var(--lr-color-text-quiet)`) controls an
audio transcript's text color. Error parts have separate
`--lr-message-parts-error-border-color` (default `var(--lr-color-danger)`),
`--lr-message-parts-error-background` (default `var(--lr-color-danger-quiet)`), and
`--lr-message-parts-error-color` (default `var(--lr-color-danger)`) hooks. All five are inline
fallbacks, so setting one on an ancestor rethemes only that state longhand.

**Slots:** none. **Optional peer deps:** those of composed content only: Markdown can use
`marked`/`dompurify`, and code content can use `shiki`; every composed primitive retains its own
fallback.

Error parts remain ordinary visible content. After the initial baseline, each newly added error-part
`id` is also appended through the shared assertive light-DOM announcement sink, using the caller's
message or the localized fallback. Existing history and reconnect renders stay silent; removing an
error id and later adding it again creates a new announcement.

```ts
import "@aceshooting/lyra-ui/components/conversation/message-parts/message-parts.js";
```

**Additional API surface:**

- `lr-anchor-result` event — Passthrough from rendered Markdown.
- `lr-citation-open` event — Passthrough from a rendered citation's full-preview action.
- `lr-copy` event — Passthrough from rendered JSON content.
- `lr-highlight-activate` event — Passthrough from rendered Markdown.
- `lr-link-click` event — Passthrough from rendered Markdown.
- `lr-preview-request` event — Cancelable passthrough from a rendered attachment.
- `lr-remove` event — Passthrough from a rendered attachment.
- `lr-render-error` event — Passthrough from rendered Markdown, tool-result, or widget content.
- `lr-retry` event — Passthrough from a rendered attachment.
- `lr-search-change` event — Passthrough from rendered JSON content.
- `lr-text-select` event — Passthrough from rendered Markdown.
- `lr-toggle` event — Passthrough from a rendered reasoning panel.
- `lr-tool-call-chip-select` event — Passthrough from a rendered tool-call chip. The
  `lr-tool-chip-select` alias it replaced was removed in 9.0.0.
- `lr-widget-action` event — Passthrough from a rendered declarative widget.
- `lr-widget-state-change` event — Passthrough from a rendered controlled widget.

## `lr-prompt-input`

The composed prompt surface: chat composer, attachment controls/chips, model and voice pickers,
retrieval-source scope, mention/slash-command popup, and queued follow-up prompts. It performs no
upload, retrieval, or model call. It is deliberately not form-associated: the complete interaction
state includes attachments, source scope, model, voice, and queued turns rather than one successful
string form entry. Observe `lr-input` for controlled text and handle `lr-submit` as the submission
request. `label` names the prompt section; it is not generic field chrome.

**Properties:** `value: string = ''`; `status: 'idle' | 'sending' | 'streaming' = 'idle'`;
`placeholder: string = ''`; `disabled: boolean = false` (reflected); `readOnly: boolean = false`
(attribute `readonly`, reflected); `minLength?: number` (attribute `minlength`) and
`maxLength?: number` (attribute `maxlength`);
`submitOnEnter: boolean = true` (attribute `submit-on-enter`, string-aware true-default converter);
`spellcheck: boolean = true` (string-aware true-default converter), `autocapitalize: string = ''`,
`autocorrect: boolean = true` (legacy string writes `'off'`/`'false'` normalize to `false`),
`wrap: 'hard' | 'soft' | 'off' = 'soft'`,
`autocomplete: string = ''`, `inputMode: string = ''` (attribute `inputmode`), and
`enterKeyHint: string = ''` (attribute `enterkeyhint`) forward unchanged to the composed native
textarea; empty string hints preserve the browser default.
`attachments: readonly LyraPromptInputAttachment[] = []` — `attachmentId` must be nonempty and
unique; malformed rows and later duplicates are omitted first-wins before rendering and attachment
events, and surviving chips reconcile by `attachmentId`. `attachmentCapabilities: readonly
LyraAttachmentCapability[] = ['files', 'image', 'audio']`, `mentionItems: readonly LyraPromptSuggestion[] =
[]`, `commandItems: readonly LyraPromptSuggestion[] = []`,
`modelCatalog?: LyraCatalog<LyraModelCatalogEntry>`,
`voiceCatalog?: LyraCatalog<LyraVoiceCatalogEntry>`,
`sources: readonly LyraSourceEntry[] = []`, `selectedSourceIds: readonly string[] = []`, and `queue:
readonly PromptQueueItem[] = []` (all attribute: false); `model: string = ''`; `voice: string = ''`;
`label: string = ''`; `accessibleLabel: string | null = null` (attribute `aria-label`).

Every array-valued property above is a clone-owned, bounded, frozen readonly snapshot, including
nested source children and queued attachments. Mutating a previously assigned collection has no
effect; create and reassign a new array after changes.

`LyraPromptSuggestion` extends `LyraMentionItem { suggestionId, label, description?, icon? }` with
optional `insertText` (defaults to `label`). The selected occurrence's original, pre-filter `index`
is preserved in the event detail. `LyraPromptInputAttachment` replaces `DocumentRef.id` with
`attachmentId` and adds `file?`, `bytes?`, `status?: 'pending' | 'uploading' | 'error' | 'success'`,
and numeric `progress?`.

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the composed chat input;
`select()` selects its native text surface. `click()` is inert while disabled. `input:
HTMLTextAreaElement | null`, `selectionStart: number | null`, `selectionEnd: number | null`, and
`selectionDirection: ChatComposerSelectionDirection | null` mirror the composed textarea.
`setSelectionRange(start, end, direction?)` and overloaded
`setRangeText(replacement[, start, end, selectMode])` use the same native range-editing contract;
`setRangeText()` synchronizes outer `value` without emitting `lr-input`. Selection and range calls
are no-ops before the textarea has rendered.

**Events:** native `input`, `change`, `focus`, and `blur` are each relayed once from the primary
textarea, paired with `lr-input`, `lr-change`, `lr-focus`, and `lr-blur`; `lr-submit` (`{ value }`),
`lr-stop` (`null`), `lr-mention-select` (`{ suggestionId, index, label, trigger }`),
`lr-attachments-add` (`{ capability, files }`), `lr-attachment-remove` (`{ attachmentId }`),
`lr-model-change`/`lr-voice-change`
(`{ value, inCatalog }`), `lr-sources-change` (`{ selectedIds }`), `lr-queue-change`
(`{ items, reason, itemId }`), `lr-send-now` (`{ item }`), `lr-camera-request`,
`lr-audio-request`, `lr-attachment-retry` (`{ attachmentId }`), and cancelable
`lr-attachment-preview-request` (`{ attachmentId, name, mimeType, src }`). Child events are stopped
and re-emitted from `lr-prompt-input`; all composed interactions are suppressed while `disabled`,
including a child event dispatched in the same turn that disables the host.

**Slots:** `controls`; `start` (attachment-control content before the textarea); `chips`; `end`
(custom send/stop action); and `footer`. `start` replaces the default attachment trigger and `end`
replaces the built-in composer action.

**CSS parts:** `base`, `controls`, `sources`, `sources-summary`, `source-picker`, `queue`,
`composer`, `start`, `chips`, `footer`.

**Themeable custom properties:** `--lr-prompt-input-control-width` (default `--lr-size-12rem`) is
the preferred width of each generated model, voice, and source control before wrapping.

Mention-popover focus transfer is generation-guarded: closing, disabling, disconnecting, adopting,
or replacing the query/data before its awaited focus step prevents stale focus. Empty `chips` and
`footer` wrappers are not rendered, so an absent optional region cannot create phantom spacing.

**Optional peer deps:** none of its own.

```ts
import "@aceshooting/lyra-ui/components/conversation/prompt-input/prompt-input.js";
```

## `lr-prompt-queue`

Controlled editable queue of follow-up turns. Reordering, editing, and removal emit a complete
proposed queue; send-now emits the complete selected item.

When a focused row action requests removal and the host applies the proposed queue, focus moves to
the equivalent action on the nearest surviving row. If the queue becomes empty, its stable region
receives focus. Removing an unfocused row does not move focus.

**Properties:** `items: readonly PromptQueueItem[] = []` (attribute: false); `editable: boolean = true`
(reflected, string-aware true-default converter); `disabled: boolean = false` (reflected);
`label: string = ''`; `accessibleLabel: string | null = null` (attribute `aria-label`).
`PromptQueueItem = { id: string; value: string; attachments?: readonly DocumentRef[]; createdAt?: number;
metadata?: Record<string, unknown> }`.

Item ids are occurrence identities. Empty ids and later duplicates are ignored before rendering or
proposing a mutation, preserving one unambiguous `itemId`. Attachment names render visibly for both
editable and read-only rows; the host `label` is also the visible queue heading.

**Events:** `lr-queue-change` (`PromptQueueChangeDetail = { items, reason, itemId }`, with
`reason: 'edit' | 'remove' | 'reorder'`), `lr-send-now` (`{ item }`). The queue is controlled:
these events propose complete next values without mutating `items`.

**CSS parts:** `base`, `heading`, `list`, `item`, `value`, `editor`, `attachments`, `attachment`,
`actions`, `action`, `empty`.

**Slots:** none. **Optional peer deps:** none.

```ts
import "@aceshooting/lyra-ui/components/conversation/prompt-queue/prompt-queue.js";
```

## `lr-selection-toolbar`

Nonmodal, Escape-dismissible text-selection toolbar carrying selected text plus a format-neutral
`DocumentLocator` into ask, quote, cite, and copy actions.

**Properties:** `open: boolean = false` (reflected); `text: string = ''`;
clone-owned `anchor: DocumentLocator | null = null`, `rect: DOMRectReadOnly | null = null`, and
clone-owned `actions: readonly SelectionAction[] = ['ask', 'quote', 'cite', 'copy']` (attribute: false);
`label: string = ''`; `accessibleLabel: string | null = null` (attribute `aria-label`).
`SelectionAction = 'ask' | 'quote' | 'cite' | 'copy'`. Duplicate built-in names are omitted
first-wins before rendering, roving focus, and action events. The anchor (including any path) and
actions are bounded frozen snapshots; reassign a new record or array after changes.

When a controlled `actions` refresh replaces the focused action, focus follows the same action id
through reordering, otherwise moves to the nearest surviving action, or to the stable toolbar when
the action set becomes empty. The same repair applies when a slotted action is removed or becomes
disabled, hidden, inert, `aria-disabled`, or no longer actionable. Availability and `tabindex`
changes are observed live, stale stops are cleared, and a newer focus destination is never
overridden. Observation is rebound to the current document realm when the toolbar is adopted.

**Events:** `lr-selection-action` (`SelectionActionDetail = { action, text, anchor }`);
`lr-dismiss` (`null`, Escape); `lr-copy` (frozen `{ ok: true, text }`, only after the clipboard
write fulfills); and, on failure, `lr-error` (`null`) plus frozen `lr-copy-error`
(`{ ok: false, text, reason, error }`). A failed copy does not emit the action event.
Detaching and later reinserting the same open instance re-establishes positioning and Escape
ownership even when the detach lasts past an event-loop turn.

**CSS parts:** `toolbar`, `action`, `action-ask`, `action-quote`, `action-cite`, `action-copy`.

The four built-in actions are the shipped set, and `actions` only reorders or subsets them. A
product-specific fifth action ("translate", "define", "search web") goes in the `actions` slot
instead: slotted elements render after the built-ins **inside** the same `role="toolbar"` element
and join the same roving-tabindex group (Home/End/Arrow, RTL-mirrored), so adding one does not mean
reimplementing the toolbar's positioning, keyboard, and dismissal behavior. A slotted action brings
its own accessible name and click handling; this component only manages its tab stop, and re-derives
the group whenever the slot's assigned elements change. The group resolves actual composed action
targets through open shadow roots and forwarding slots; decorative wrappers are not accepted as
stops, while multiple actionable descendants remain independently arrow-reachable. Keyboard
movement starts from the action that received the event rather than stale controlled state.

`rect` is the sole public positioning input. Internal computed coordinates are intentionally
private so controlled rect updates cannot be silently overridden by stale authored CSS.
**Themeable custom properties:** `--lr-selection-toolbar-placement-gap` (default
`var(--lr-space-s)`) is the non-negative distance from the selection and from viewport edges while
the toolbar avoids collisions. It accepts unitless pixel values and `px`, `rem`, and `em` values; unsupported
values fall back to the default and negative values clamp to `0`. Collision math uses the active
`visualViewport` bounds and offsets when available, including after visual-viewport changes.

**Slots:** `actions` — extra actions rendered after the built-in ask/quote/cite/copy buttons,
inside the same `role="toolbar"` element and roving-tabindex group. **Optional peer deps:** none.

```ts
import "@aceshooting/lyra-ui/components/conversation/selection-toolbar/selection-toolbar.js";
```

## `lr-realtime-session`

Provider-neutral realtime voice shell composing connection state, `lr-audio-visualizer`,
`lr-push-to-talk`, and `lr-transcript-feed`. Transport/authentication/playback remain host-owned.

**Properties:** `state: RealtimeConnectionState = 'disconnected'` (reflected), where the closed set
is `'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'`; `voiceState:
AudioVisualizerState = 'idle'` (attribute `voice-state`); `level: number | null = null` (finite,
clamped by the composed visualizer); `stream: MediaStream | null = null`; `sessionId: string = ''`
(attribute `session-id`) — forwarded to the transcript feed so changing sessions resets finalized
entry announcement identity; `entries: LyraTranscriptEntry[] = []` (attribute: false);
`muted: boolean = false` (reflected);
`showCapture: boolean = true` (attribute `show-capture`, reflected, string-aware true-default
converter); `label: string = ''`. Invalid attribute or direct-property values for `state` and
`voiceState` normalize to their safe defaults (`'disconnected'` and `'idle'`) through the same
closed-set converter.

When a state transition removes a focused session action, focus moves to the replacement
connect/disconnect action. Setting `showCapture` to `false` applies that handoff only when the
capture control owned focus; a surviving built-in, slotted, or external focus destination is not
moved.

**Events:** session intents are `lr-connect`, `lr-disconnect`, `lr-mute-change` (`{ muted }`), and
`lr-interrupt`. The composed capture's complete public event surface bubbles through unchanged and
is also included in `LyraRealtimeSessionEventMap`: `lr-record-start` (`{ stream }`),
`lr-record-chunk` (`{ blob }`), `lr-record-stop` (`{ blob, durationMs }`), `lr-record-cancel` (no
detail), `lr-record-error` (`{ error }`), `lr-level` (`{ level }`), and
`lr-record-state-change` (`{ state }`). These are the child's original bubbling/composed events rather than
parent re-emissions;
normal Shadow DOM retargeting means a listener outside the session observes the session as `target`.

**CSS parts:** `base`, `header`, `status`, `activity`, `controls`, `connect`, `disconnect`, `mute`,
`interrupt`, `capture`, `transcript`, `error`.

Visible status and error text remain ordinary, non-live content. After the initial baseline,
non-error `state` transitions are appended to the shared polite light-DOM announcement sink and a
transition to `error` uses the shared assertive sink instead. Initial and reconnect renders stay
silent, and sinks follow the component's `ownerDocument` when it is adopted.

**Slots:** `controls` — provider-specific actions appended to the built-in session controls.
**Optional peer deps:** none. Transport, credentials, capture permission, and media playback
remain host-owned.

```ts
import "@aceshooting/lyra-ui/components/conversation/realtime-session/realtime-session.js";
```

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`components-conversation-chat-message-chat-message-contracts`** — Supporting data types and helpers for this component family.
  `ChatMessageToggleDetail {
    collapsed: unknown;
  }`

- **`components-conversation-checkpoint-checkpoint-contracts`** — Supporting data types and helpers for this component family.
  `CheckpointRestoreDetail {
    checkpointId: unknown;
    label: unknown;
  }`

- **`components-conversation-code-block-code-loader-contracts`** — Supporting data types and helpers for this component family.
  `loadShikiHighlighter(): unknown`
  `loadShikiLanguage(/* public names: hl, lang */): unknown`

- **`components-conversation-code-block-shiki-types-contracts`** — Supporting data types and helpers for this component family.
  `loadShikiHighlighterCore(/* public names: languages */): unknown`
  `normalizeShikiLanguage(/* public names: lang */): unknown`
  `ShikiHighlighter {
    codeToHtml: unknown;
    code: unknown;
    options: unknown;
    getLoadedLanguages: unknown;
    loadLanguage: unknown;
    language: unknown;
  }`
  `ShikiLanguageInput {
    name: unknown;
    scopeName: unknown;
    displayName: unknown;
    aliases: unknown;
    patterns: unknown;
    repository: unknown;
  }`

- **`components-conversation-conversation-item-conversation-item-contracts`** — Supporting data types and helpers for this component family.
  `ConversationItemRenameDetail {
    conversationId: unknown;
    label: unknown;
  }`
  `ConversationItemSelectDetail {
    conversationId: unknown;
  }`

- **`components-conversation-markdown-markdown-loader-contracts`** — Supporting data types and helpers for this component family.
  `getMarkdownDepsIfLoaded(): unknown`
  `loadMarkdownAndSanitizer(/* public names: importMarked, importDompurify */): unknown`
  `loadMarkdownDeps(): unknown`
  `LyraMarkedParser {
    defaults: unknown;
    use: unknown;
    extensions: unknown;
    parse: unknown;
    source: unknown;
    options: unknown;
    async: unknown;
  }`
  `MarkdownDeps {
    marked: unknown;
    DOMPurify: unknown;
  }`
  `MarkedExtension {
    renderer: unknown;
    extensions: unknown;
  }`
  `MarkedModule {
    Marked: unknown;
  }`
  `MarkedParserContext {
    parser: unknown;
    parse: unknown;
    tokens: unknown;
    parseInline: unknown;
    renderer: unknown;
    textRenderer: unknown;
    listitem: unknown;
    token: unknown;
    tablecell: unknown;
    tablerow: unknown;
    text: unknown;
  }`
  `MarkedRenderer {
    heading: unknown;
    this: unknown;
    token: unknown;
    depth: unknown;
    paragraph: unknown;
    list: unknown;
    ordered: unknown;
    start: unknown;
    items: unknown;
    code: unknown;
    lang: unknown;
    text: unknown;
    escaped: unknown;
    codespan: unknown;
    blockquote: unknown;
    table: unknown;
    header: unknown;
    align: unknown;
    rows: unknown;
    link: unknown;
    href: unknown;
    title: unknown;
    image: unknown;
    html: unknown;
  }`
  `preloadMarkdown(): unknown`

- **`components-conversation-message-actions-toolbar-actions-contracts`** — Supporting data types and helpers for this component family.
  `isLyraToolbarActionProvider(/* public names: value */): unknown`
  `LyraToolbarAction {
    id: unknown;
    disabled: unknown;
    focus: unknown;
    options: unknown;
    setTabIndex: unknown;
    tabIndex: unknown;
    matchesEventPath: unknown;
    path: unknown;
  }`
  `LyraToolbarActionProvider {
    getToolbarActions: unknown;
  }`

- **`components-conversation-message-feedback-message-feedback-contracts`** — Supporting data types and helpers for this component family.
  `MessageFeedbackDetailConfiguration {
    reasons: unknown;
    commentable: unknown;
  }`
  `MessageFeedbackReason {
    id: unknown;
    label: unknown;
  }`
  `MessageFeedbackSubmitDetail {
    rating: unknown;
    reasonIds: unknown;
    comment: unknown;
  }`

- **`components-conversation-model-select-model-select-contracts`** — Supporting data types and helpers for this component family.
  `LyraModelCatalogEntry {
    icon: unknown;
    id: unknown;
    label: unknown;
  }`

- **`components-conversation-model-settings-panel-model-settings-panel-contracts`** — Supporting data types and helpers for this component family.
  `ModelSettingsChangeDetail {
    model: unknown;
    inCatalog: unknown;
    temperature: unknown;
  }`

- **`components-conversation-prompt-input-prompt-input-contracts`** — Supporting data types and helpers for this component family.
  `LyraPromptInputAttachment {
    attachmentId: unknown;
    file: unknown;
    bytes: unknown;
    status: unknown;
    progress: unknown;
    name: unknown;
    mimeType: unknown;
    uri: unknown;
    version: unknown;
  }`
  `LyraPromptSuggestion {
    insertText: unknown;
    suggestionId: unknown;
    label: unknown;
    description: unknown;
    icon: unknown;
  }`

- **`components-conversation-prompt-queue-prompt-queue-contracts`** — Supporting data types and helpers for this component family.
  `PromptQueueChangeDetail {
    items: unknown;
    reason: unknown;
    itemId: unknown;
  }`
  `PromptQueueItem {
    id: unknown;
    value: unknown;
    attachments: unknown;
    createdAt: unknown;
    metadata: unknown;
  }`

- **`components-conversation-selection-toolbar-selection-toolbar-contracts`** — Supporting data types and helpers for this component family.
  `SelectionActionDetail {
    action: unknown;
    text: unknown;
    anchor: unknown;
  }`

- **`components-conversation-streaming-text-streaming-text-contracts`** — Supporting data types and helpers for this component family.
  `looksLikeMarkdown(/* public names: text */): unknown`

- **`components-conversation-suggestion-chips-suggestion-chips-contracts`** — Supporting data types and helpers for this component family.
  `LyraChatSuggestion {
    suggestionId: unknown;
    label: unknown;
    icon: unknown;
    detail: unknown;
  }`

- **`components-conversation-transcript-feed-transcript-feed-contracts`** — Supporting data types and helpers for this component family.
  `LyraTranscriptEntry {
    id: unknown;
    speaker: unknown;
    text: unknown;
    interim: unknown;
    timestamp: unknown;
  }`

- **`components-conversation-voice-picker-voice-picker-contracts`** — Supporting data types and helpers for this component family.
  `LyraVoiceCatalogEntry {
    language: unknown;
    description: unknown;
    previewUrl: unknown;
    id: unknown;
    label: unknown;
  }`

- **`internal-catalog-picker-contracts`** — Shared utility contracts.
  `LyraCatalogEntry {
    id: unknown;
    label: unknown;
  }`
