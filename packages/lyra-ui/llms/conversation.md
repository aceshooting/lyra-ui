## `lr-markdown`

Sanitized Markdown-to-HTML rendering (GFM tables, fenced code blocks, links, blockquotes) built on
two optional peer dependencies — `marked` (parsing) and `dompurify` (sanitizing) — both lazy-loaded
independently via `markdown-loader.ts`'s `loadMarkdownDeps()` on first connect, cached per page the
same way `chart-loader.ts`/`map-loader.ts` cache their load promise so every `<lr-markdown>`
instance on a page shares one load. `heading`/`code`/`blockquote`/`table`/`link`/`image` tokens are
rendered through a `marked` renderer override that injects `part="..."` attributes directly into the
produced HTML in a single pass (no second DOM walk after insertion).

Fenced code blocks are also syntax-highlighted via the same optional `shiki` peer `<lr-code-block>`
uses, gated by `highlightCode` (default `true`). This is a pure upgrade, not a separate opt-in: it's
already transparently gated by whether `shiki` is installed at all, so an app that never installs the
peer sees byte-identical output to before this property existed. The very first render of any content
is always plain text/code (identical to today's output); highlighting arrives as an asynchronous
upgrade one render later once shiki resolves and the block's language is tokenized. No highlighting
is attempted while `streaming` is `true` — it applies once a stream settles, adding no per-chunk cost
while content is still arriving.

**Properties:**
- `content: string = ''` — the Markdown source to render
- `sanitize: boolean = true` — sanitize `marked`'s HTML output with DOMPurify before rendering
- `escapeHtml: boolean = false` (attribute `escape-html`) — when `true`, overrides `marked`'s `html`
  renderer hook to emit the HTML-escaped source text instead of passing raw/sanitized markup through
  — for rendering arbitrary already-written content (e.g. a historical chat/agent transcript full of
  code/XML/HTML snippets) where a stray angle bracket should render as visible text, not a real DOM
  element. GFM tables/lists/etc. still render normally — only raw embedded HTML is affected. `false`
  (the default) reproduces the exact `marked`-default (sanitized-when-`sanitize`) passthrough
  behavior.
- `gfm: boolean = true` — GitHub-flavored Markdown (tables, strikethrough, autolinks, task lists)
- `linkTarget: string | null = '_blank'` (attribute `link-target`) — `target` applied to every
  rendered `<a>`, with `rel="noopener noreferrer"` always added alongside it whenever a `target` is
  emitted. `'_blank'` (the default) preserves the original output; a falsy value (`null`, or the
  empty string via `link-target=""`) omits `target`/`rel` entirely instead of always defaulting to
  `_blank`, so rendered links open in the same tab
- `internalLinkPrefix: string = ''` (attribute `internal-link-prefix`) — when set, a rendered link
  whose `href` *attribute* (not the browser-resolved `.href` property) starts with this prefix is
  intercepted on click and reported via `lr-link-click` instead of navigating; empty (the default)
  means every link is treated as external
- `headingOffset: number = 0` (attribute `heading-offset`) — added to every rendered heading's
  source `token.depth` before emitting `<h${depth}>` (e.g. `heading-offset="2"` renders a source `#`
  as `<h3>`); clamped to `[1, 6]` so a source `######` with a positive offset stays at `<h6>` rather
  than overflowing past the HTML heading levels. `0` (the default) preserves the original
  `<h${token.depth}>` output
- `eagerLoad: boolean = false` (attribute `eager-load`) — when `true`, `connectedCallback()` skips
  awaiting the async `loadMarkdownDeps()` import and renders synchronously if the shared
  `marked`/`dompurify` module cache is *already* warm (e.g. an earlier `<lr-markdown>` instance on
  the page already finished loading); falls back to the normal async path (with its brief
  plain-text-fallback first paint) when the cache isn't warm yet. `false` (the default) is
  byte-identical to always taking the async path
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
- `languagesOnly: boolean = false` (attribute `languages-only`) — same purpose as
  `<lr-code-block>`'s own `languagesOnly`: skips the default full-bundle loader entirely, so a
  fenced block whose language isn't in `languages` falls back to plain unhighlighted text rather
  than reaching for the full bundle. No effect unless `languages` is also set
- `headingAnchors: boolean = false` (attribute `heading-anchors`) — stamps a computed
  GitHub-slugger-style slug as `id` on every rendered heading.
- `math: boolean = false` — renders `$inline$` and `$$block$$` TeX via the optional `katex` peer,
  lazy-loaded the same way as `marked`/`dompurify`/`shiki`.
- `anchorKinds: readonly ('fragment' | 'text-quote')[]` (readonly) — the anchor kinds this
  component resolves for the shared anchor-target contract.

**Methods:** `getHeadingTree()` returns the document-ordered heading outline (`{ level, text, slug
}[]`) computed on every parse, regardless of `headingAnchors`.

**Events:**
- `lr-link-click` (`detail: { href: string; internal: true }`) — fired, with the click prevented,
  when a rendered link's `href` starts with `internal-link-prefix`; ordinary external links navigate
  normally and never fire this
- `lr-render-error` (`detail: { error: unknown }`) — rendering fell back to plain text (see the
  fallback matrix below), or `math` is set but the `katex` peer isn't installed
- `lr-highlight-activate` (`detail: { id: string }`) — a painted `text-quote` highlight was clicked
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

**Themeable custom properties:** `--lr-markdown-font-mono` (default `ui-monospace, SFMono-Regular,
Menlo, Consolas, monospace` — the code/code-block font; component-specific since no shared
`--lr-*` monospace token exists), `--lr-code-block-tab-size` (default `2` — tab width inside a
rendered fenced or indented `code-block`), plus shared tokens `--lr-space-xs/-s/-m/-l`,
`--lr-color-brand-quiet`, `--lr-color-brand`, `--lr-color-border`, `--lr-color-text-quiet`,
`--lr-radius`.

**Optional peer deps:** `marked`, `dompurify` (both lazy-loaded via `markdown-loader.ts`'s
`loadMarkdownDeps()`, mirroring `chart-loader.ts`'s two-independent-optional-peers shape). Each half
is loaded and caught independently — a consumer who installs only `marked` and explicitly sets
`sanitize="false"` (so `dompurify` is never needed) is a valid, supported combination. Also `shiki`,
the same optional peer `<lr-code-block>` uses, for `highlightCode`'s fenced-block syntax
highlighting — independent of the `marked`/`dompurify` pair, and its absence never blocks rendering
(fenced blocks simply stay unhighlighted).

```html
<lr-markdown
  content="# Report&#10;&#10;See the [setup guide](/docs/setup) for details."
  internal-link-prefix="/docs/"
></lr-markdown>
<script>
  document.querySelector('lr-markdown').addEventListener('lr-link-click', (e) => {
    router.navigate(e.detail.href);
  });
</script>
```

Rendering never ships unsanitized or broken markup silently. If `marked` fails to load, or throws
while parsing malformed input, the component falls back to plain text (`white-space: pre-wrap`, no
HTML parsing at all — the raw `content` string itself) and fires `lr-render-error`. If `sanitize`
is `true` (the default) and `dompurify` fails to load, the component *also* falls back to plain text
+ `lr-render-error` — it never renders `marked`'s raw HTML output when sanitization was requested
(or defaulted to) but is unavailable, even though `marked` itself loaded fine. If `sanitize` is
explicitly `false`, `marked`'s raw output renders as-is regardless of whether `dompurify` is
installed. While the optional peers are still resolving, the host carries `aria-busy="true"` (set/
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
can cover the other. The same value can still *look* different between the two — a markdown code
block inherits `white-space: pre-wrap` while `<lr-code-block>` is `white-space: pre`, and tab stops
restart at the beginning of each visual line, so a wrapped line's tabs land differently.

**Known gotchas:**
- a malformed percent-escape or lone UTF-16 surrogate in a link's raw `href` makes the internal
  `encodeURI`-based validity guard throw, silently dropping just that anchor (the link text still
  renders, with no `href`) — mirrors `marked`'s own default `link()` renderer's defensive behavior.
- `target` is not in DOMPurify's default attribute allowlist (unlike `part`/`rel`/`class`, which
  already are), so sanitization is called with `ADD_ATTR: ['target']` — without that, every rendered
  link's `target` would be silently stripped by sanitization even though the anchor itself survives.
- a fresh `marked.Marked()` instance (with a fresh renderer) is built on every single parse rather
  than cached, specifically so the renderer's `link()` override always closes over the *current*
  `linkTarget` — `marked`'s `.use()` otherwise persists whatever renderer it was given for the
  instance's lifetime, which would go stale if `linkTarget` changed after a cached instance's first use.
- `internal-link-prefix` matching compares against the raw `href` *attribute*, not the resolved
  `.href` IDL property (always an absolute URL in the browser) — a prefix like `/docs/` matches a
  relative markdown link but would never match against the resolved property.
- rendered output goes through `unsafeHTML`; with `sanitize="false"` the component renders whatever
  HTML `marked` produces from `content` completely unsanitized, so untrusted `content` must never be
  paired with `sanitize="false"`.

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
statically narrow away even when a consumer's `languagesOnly` flag makes it unreachable at runtime —
this component's own module never imports or calls that function at all; it only ever calls
`loadShikiHighlighterCore(languages)`, so a consumer importing this entry point instead of
`markdown.js` gets a build genuinely free of shiki's full language table.

A fenced code block whose language isn't a key in `languages` always renders the plain-text fallback
— there is no default/full-table highlighter here to fall back to, the same default (not degraded)
rendering path as `<lr-code-block-core>`'s identical contract. Every other capability — GFM tables,
links, blockquotes, images, heading anchors, `getHeadingTree()`, `fragment`/`text-quote` anchor-target
support (`highlights`, `activeHighlightId`, `scrollToAnchor()`, the `lr-highlight-activate`/
`lr-text-select`/`lr-anchor-result` events), math via the optional `katex` peer, the sanitize/
`escapeHtml`/streaming fallback matrix and known gotchas — is identical to `<lr-markdown>`; see that
section above for the full write-up of shared behavior. There is no `languagesOnly` property here —
meaningless without a full-table fallback to gate, matching `<lr-code-block-core>` having none
either.

**Properties:** `content: string = ''`, `sanitize: boolean = true`, `escapeHtml: boolean = false`
(attribute `escape-html`), `gfm: boolean = true`, `linkTarget: string | null = '_blank'` (attribute
`link-target`), `internalLinkPrefix: string = ''` (attribute `internal-link-prefix`),
`headingOffset: number = 0` (attribute `heading-offset`), `eagerLoad: boolean = false` (attribute
`eager-load`), `streaming: boolean = false` (reflected), `highlightCode: boolean = true` (attribute
`highlight-code`), `languages: Record<string, ShikiLanguageInput> = {}` (attribute: false) — required,
unlike `<lr-markdown>`'s optional `languages?:`; empty (the default) means every fenced block stays
unhighlighted permanently, `headingAnchors: boolean = false` (attribute `heading-anchors`),
`math: boolean = false`, `anchorKinds: readonly ('fragment' | 'text-quote')[]` (readonly).

**Methods:** `getHeadingTree()` — same contract as `<lr-markdown>`'s own.

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
differently on a wrapped line.

**Optional peer deps:** `marked`, `dompurify` (both lazy-loaded, same as `<lr-markdown>`), `katex`
(for `math`). Does *not* depend on the full `shiki` package's default entry point — only
`shiki/core`/`shiki/engine/oniguruma`/`shiki/langs/*`, the same fine-grained subset
`<lr-code-block-core>` depends on.

```html
<lr-markdown-core
  content="# Report&#10;&#10;\`\`\`python&#10;print('hi')&#10;\`\`\`"
  .languages=${{ python }}
></lr-markdown-core>
<script type="module">
  import python from 'shiki/langs/python.mjs';
</script>
```

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

A role-based message bubble *shell* for a chat/agent conversation surface. It renders none of the
message content itself — the default slot carries whatever a consumer wants to display (plain text,
a `<lr-markdown>`, a custom template, anything) and this component only supplies the surrounding
chrome: alignment/coloring by `role`, an avatar/badges header row, an optional collapse toggle, an
attachments strip, and a status-aware footer (a live-updating status dot + text, the formatted
`timestamp`, a built-in retry affordance for `status="failed"`, and an `actions` slot for everything
else). No built-in copy button is rendered — slot a copy control into `actions` and fire
`lr-copy` (`detail: { text: string }`) from it if you want one (matching `<lr-json-viewer>`'s
and `<lr-code-block>`'s copy-affordance event name/shape, for anything listening at the
conversation-surface level).

**Properties:**
- `role: ChatMessageRole = 'assistant'` (`'user' | 'assistant' | 'system'`) — reflects to
  `data-role`, **not** the bare `role` attribute (those role strings aren't valid ARIA role tokens
  and reflecting to `role` would collide with the element's own ARIA role); a plain `role="..."`
  attribute set directly in markup is ignored entirely
- `status: ChatMessageStatus = 'sent'` (`'sending' | 'sent' | 'failed' | 'streaming'`, reflected) —
  drives the footer's status dot/text, `status="failed"`'s danger treatment on the bubble, and the
  built-in retry button
- `timestamp?: Date | string` (attribute: false) — accepts a `Date` or anything `new Date()` can
  parse; invalid input is treated the same as unset (no timestamp rendered)
- `formatTimestamp?: (date: Date) => string` (attribute: false) — overrides the default
  `hour:minute` (`Intl.DateTimeFormat`, runtime locale) rendering of `timestamp`
- `collapsible: boolean = false` (reflected) — shows the built-in collapse/expand toggle in the header
- `collapsed: boolean = false` (reflected) — whether the message body is hidden; effective whenever
  set, independent of `collapsible` (which only controls whether the toggle button itself is
  rendered) — mirrors `lr-widget`'s identical `collapsible`/`collapsed` pair
- `attachmentsPosition: 'before'|'after' = 'after'` (attribute `attachments-position`) — places the
  `attachments` slot before or after the message body; both the visual and reading order follow it
- `actionsOutsideBubble: boolean = false` (attribute `actions-outside-bubble`, reflected) — renders
  the `actions` slot's content as a sibling immediately after `[part="bubble"]` instead of nested
  inside `[part="footer"]`'s own padding/background box, for a consumer whose action row (e.g. a
  hover-reveal copy button) must sit visually outside the bubble's chrome
- `messageId: string = ''` (attribute `message-id`, reflected) — optional stable application id;
  included in `lr-retry` detail when the built-in retry control is activated

**Events:** `lr-retry` (`detail: { messageId?: string }`; fired by the built-in retry button, only
rendered when `status="failed"`), `lr-collapse-toggle` (`detail: boolean`, the new `collapsed` state — fired when
the user activates the built-in collapse button)

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
after `bubble` when `actionsOutsideBubble` is set), `failure` (`display: contents` wrapper for the
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

**Use these instead of a `::part(bubble)` padding/radius override.** A `::part` declaration written
in the consumer's tree outranks *every* rule inside this component's shadow tree, so a
`::part(bubble) { padding: … }` rule silently suppresses the per-`status` treatments layered on the
same element — `status="failed"`'s danger tint, `status="streaming"`'s border — along with the
per-role fills above. The two properties are declared as `var()` fallbacks at the point of use and
never on `:host`, both so they can't shadow an inherited value and so a container can set them once
above a whole transcript rather than per message.

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
> wrapper's *direct* children, not a nested `<lr-*>` host's shadow DOM.

**Optional peer deps:** none. Internally renders a `<lr-live-region>` (a first-party sibling
component, auto-imported alongside this one, not an npm peer) for the status-transition
announcements described below.

```html
<lr-chat-message data-role="assistant" status="streaming">
  <span slot="avatar">🤖</span>
  <span slot="badges">gpt-5.4 · 1.2s</span>
  <lr-markdown content="Here's what I found…"></lr-markdown>
  <button slot="actions">Copy</button>
</lr-chat-message>
<script>
  document.querySelector('lr-chat-message').addEventListener('lr-retry', () => resend());
</script>
```

Accessibility of `status`: the current status is always available as plain visible text
(`[part="status-text"]`), never color alone. A transition *to* `"failed"`, or *from* `"streaming"` to
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
  **not** announce anything — only a genuine *later* transition (`changed.get('status') !==
  undefined`, i.e. not the very first update) triggers the live-region announcement.
- `lr-retry` fires with no detail payload at all (`undefined`), not e.g. `{ status: 'failed' }`.
- the header/footer/avatar/badges/attachments/actions wrappers are shown/hidden via the `hidden`
  attribute, not conditional templating. Whether each slot currently has content is checked once via
  a light-DOM children scan on the very first update (`willUpdate`, gated on `!this.hasUpdated`) and
  thereafter only via each slot's own `slotchange` listener — content added directly with
  `appendChild` after first paint still triggers native `slotchange`, so this works transparently,
  but any code that manually re-parents already-slotted nodes without a real slot-assignment change
  won't refresh the corresponding wrapper's visibility.
- `role` intentionally reflects to `data-role`; CSS or selectors that key off role must target
  `[data-role="user"]` etc., not `[role="user"]`.

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
- `variant: TypingIndicatorVariant = 'dots'` (`'dots' | 'pulse' | 'cursor'`, reflected)
- `label: string = 'Thinking…'` — the accessible name, exposed via `role="status"`; not re-announced
  on every animation frame, only on mount and on any later change to this property
- `size: TypingIndicatorSize = 'md'` (`'sm' | 'md'`, reflected) — compact sizing for dense layouts

**Events:** none — purely presentational.

**Slots:** none.

**CSS parts:** `base` (the decorative, `aria-hidden`, wrapper around the animated shape), `dot`
(each of the three dots in the `dots` variant), `pulse` (the single pulsing dot in the `pulse`
variant), `cursor` (the blinking bar in the `cursor` variant)

**Themeable custom properties:** `--lr-typing-dot-size` (default `0.5rem`, `0.375rem` at
`size="sm"`), `--lr-typing-gap` (default `0.25rem`, `0.1875rem` at `size="sm"`),
`--lr-typing-cursor-width` (default `0.125rem`, `0.09375rem` at `size="sm"`),
`--lr-typing-cursor-height` (default `1em`, unaffected by `size`),
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
<lr-typing-indicator variant="pulse" size="sm"></lr-typing-indicator>
<lr-typing-indicator variant="cursor"></lr-typing-indicator>
<lr-typing-indicator
  style="--lr-typing-duration: 900ms ease-in-out; --lr-typing-dot-stagger-1: 300ms; --lr-typing-dot-stagger-2: 600ms"
></lr-typing-indicator>
```

Accessibility: since this indicator typically mounts and unmounts around a real generation lifecycle
(appears when a response starts, disappears once one arrives) rather than emitting a stream of
updates of its own, it does **not** route through `<lr-live-region>`/the internal `Announcer` —
that machinery exists to coalesce many rapidly-changing announcements into one, and there is only
ever a single announcement here: the mount itself. `role="status"` plus an accessible name derived
from `label` is set both as `aria-label` on the host *and* as a visually-hidden text node
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
- `size="sm"` shrinks the dot size, gap, and cursor width, but **not** `--lr-typing-cursor-height`
  (still `1em` at any size) — the cursor bar's height is meant to track surrounding text size via
  `1em`, not the component's own `size` property.

---

## `lr-chat-composer`

The message input for a chat/agent conversation surface: an auto-resizing `<textarea>` plus a
built-in send/stop button. Deliberately no label/hint/error chrome — a composite chat-input
control, not a labeled form field; wrap it in your own layout for that context. **Form-associated**
via the shared `FormAssociated` mixin (same shape as
`<lr-date-input>`) — `name: string = ''`, `value: string = ''`, `disabled: boolean = false`
(reflected), `required: boolean = false` (reflected) are all inherited, along with
`checkValidity()`/`reportValidity()`, so it participates in native `<form>` submission/validation/
reset like any other text control.

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
- `appearance: ChatComposerAppearance = 'card'` (reflected) — `'card' | 'plain'`; `'plain'` drops
  `[part="base"]`'s border, background, padding and corner radius so a composer docked inside a chat
  panel, dialog footer or toolbar that already draws its own border doesn't double the frame. The
  focus affordance is swapped, not dropped — see **Known gotchas**
- `submitOnEnter: boolean = true` (reflected, attribute `submit-on-enter`) — when `false`, Enter
  always inserts a newline instead of submitting
- `submitDisabled: boolean = false` (reflected, attribute `submit-disabled`) — consumer-controlled
  validation gate; while idle, disables the built-in Send button and suppresses Enter/click
  submission without disabling the textarea or a busy-state Stop action
- `stoppable: boolean = true` (reflected) — when false, busy states keep a disabled Send button
  instead of exposing a Stop action
- `accessibleLabel: string | null = null` (attribute `aria-label`) — names the internal textarea;
  wins over placeholder and the localized composer label
- `spellcheck: boolean = true` — forwarded to the internal `<textarea>`
- `autocapitalize: string = ''` — forwarded to the internal `<textarea>`; empty omits the attribute
- `autoCorrect: string = ''` (attribute `autocorrect`) — forwarded to the internal `<textarea>`
  (Safari/WebKit-specific); empty omits the attribute. Named `autoCorrect`, not `autocorrect`, only
  to dodge a `lib.dom.d.ts` collision with `HTMLElement`'s own `boolean`-typed `autocorrect` IDL
  member; the host attribute is explicitly mapped to plain `autocorrect`.
- `wrap: 'hard' | 'soft' | 'off' = 'soft'`, `autocomplete: string = ''`, `inputMode: string = ''`
  (attribute `inputmode`), and `enterKeyHint: string = ''` (attribute `enterkeyhint`) — forwarded to
  the native textarea
- `selectionStart`, `selectionEnd`, and `selectionDirection` — native selection getters/setters

**Methods (own):** `focus(options?)`, `blur()`, `select()`, `setSelectionRange()`, and
`setRangeText()` forward to the textarea; `setRangeText()` synchronizes reactive/form value and
auto-sizing. `checkValidity()`/`reportValidity()` remain inherited.

**Events:**
- `lr-input` (`detail: { value }`) — fired on every user-driven edit of the textarea, not a
  programmatic `.value` assignment
- `lr-submit` (`detail: { value }`) — fired by Enter (per `submit-on-enter`) or the built-in
  button while `status="idle"` and `submitDisabled` is false. `detail.value` is always the exact, untrimmed current value;
  trimming is left to the consumer. Submitting does **not** clear `value`
- `lr-stop` (no detail) — fired by the built-in button while `status` is `"sending"` or
  `"streaming"`
- `blur` (no detail) — re-dispatched from the internal `<textarea>`'s own `blur`, bubbling and
  composed unlike the native event
- `focus` (no detail) — re-dispatched from the internal `<textarea>`'s own `focus`, for the same
  reason as `blur`

**Slots:** `leading` (content before the textarea, e.g. an attach-file trigger button), `chips` (an
attachment tray rendered above the input row), `trailing` (overrides the built-in send/stop button
entirely when it has assigned content)

**CSS parts:** `base`, `chips`, `row`, `leading`, `textarea`, `trailing`, `action-button`

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
  const composer = document.getElementById('composer');
  composer.addEventListener('lr-submit', (e) => {
    sendMessage(e.detail.value);
    composer.value = ''; // the composer never clears itself
    composer.status = 'sending';
  });
  composer.addEventListener('lr-stop', () => stopGeneration());
</script>
```

Auto-resize (`resizeTextarea()`) reads the textarea's own *computed* line-height/padding/border at
call time rather than assuming a fixed px-per-row constant, so it stays correct under a consumer's
own font-size/line-height overrides; it grows between `min-rows` and `max-rows`, then switches to
internal scrolling (`overflow-y: auto`) past `max-rows`. A `ResizeObserver` on the textarea itself
also re-runs this fit (one animation frame later, to avoid a `ResizeObserver`-loop console error)
whenever the textarea's own *width* changes — a sidebar collapsing, a responsive breakpoint, a
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
- The `trailing` slot fully replaces the built-in action button rather than rendering alongside it —
  once it has assigned content, the library's send/stop icon, its `aria-label`, and its
  `status`-driven busy styling all disappear, so a custom trailing control needs its own send/stop
  handling.
- `[part="chips"]`/`[part="leading"]` are hidden via a JS-tracked `[hidden]` attribute rather than a
  CSS `:empty` selector, because each always contains a literal `<slot>` child regardless of
  assigned content.
- Under `appearance="card"` the only focus affordance is a border-color shift on `[part="base"]`
  (the internal `<textarea>` sets `outline: none`). `appearance="plain"` removes that border, so it
  swaps in a different affordance rather than losing focus visibility: an underline across the whole
  input row, drawn as an inset `box-shadow` from `--lr-focus-ring-width`/`--lr-focus-ring-color` so
  it costs no layout. If you restyle `[part="base"]` under `plain`, keep a focus indicator.

---

## `lr-stream-status`

A compact status indicator for a single streaming connection (SSE, WebSocket, long-poll, …), with
built-in heartbeat-aware stall detection. First-party invention (no Web Awesome equivalent). The
host drives `phase` directly for `idle`/`connecting`/`streaming`, and calls the imperative
`recordActivity()` method on every *semantic* frame received while streaming — a real content
chunk, never a transport-level keep-alive ping. This component has no payload-inspection logic of
its own: "ignore heartbeats" is entirely call-site discipline, which is exactly why a connection
that's only sending keep-alives (no real content) for longer than `stall-threshold-ms` correctly
reads as stalled.

**Properties:**
- `phase: 'idle' | 'connecting' | 'streaming' | 'stalled' = 'idle'` (reflected) — current
  connection phase. Fully public and directly settable by the host at any time, including a manual
  override to `'stalled'`; the component never fights a host-driven reassignment.
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
  - While `phase === 'stalled'`: recovers — `phase` becomes `'streaming'` again (firing
    `lr-recover` and arming the timer fresh, via the same transition handling a direct host
    assignment would also go through).
  - While `phase` is `'idle'` or `'connecting'`: a no-op. Safe to call defensively before formally
    flipping to `'streaming'`; it never throws or starts a timer early.

**Events:** `lr-stall` (no detail payload) — fires whenever `phase` transitions into `'stalled'`
from any other phase, whether timer-driven or via a direct host assignment. `lr-recover` (no
detail payload) — fires whenever `phase` transitions out of `'stalled'` to any other phase,
whether via `recordActivity()` or a direct host assignment. Neither fires for a same-value
reassignment, and neither fires for whatever phase the element happens to *mount* with — only a
later change counts as a transition.

**Slots:** default (custom copy shown only while `phase="stalled"`, e.g. "Taking longer than
usual…" — falls back to a built-in default message when nothing is slotted), `actions` (a
stop/retry button row; always present in the template regardless of `phase` — its wrapper's
visibility is driven purely by whether anything is slotted into it, not by `phase`)

**CSS parts:** `base`, `indicator`, `message`, `actions`

**Themeable custom properties:** shared tokens only — `--lr-color-text-quiet` (idle dot color),
`--lr-color-brand` (connecting/streaming dot color), `--lr-color-warning` (stalled dot color,
message text color, stalled border), `--lr-color-warning-quiet` (stalled background tint),
`--lr-space-s` / `--lr-space-xs` (base gap, stalled padding, actions gap), `--lr-radius`
(base corner radius), `--lr-transition-base` (background/border-color transitions and the
streaming pulse animation's cycle length). The component also sets two internal, phase-driven
custom properties (`--lr-stream-status-dot-color`, `--lr-stream-status-dot-opacity`) on
`:host`, but its own `:host([phase="..."])` rules outrank a page-level override for every phase
except the default `idle`, so these aren't a practical external theming hook.

**Optional peer deps:** none.

```html
<lr-stream-status phase="streaming" stall-threshold-ms="8000">
  <span slot="actions"><button>Stop</button></span>
</lr-stream-status>
```
```ts
const status = document.querySelector('lr-stream-status')!;
status.addEventListener('lr-stall', () => console.warn('stream stalled'));
status.addEventListener('lr-recover', () => console.info('stream recovered'));

// on every real content chunk from the transport (never on a keep-alive ping):
status.recordActivity();
```

Internally, the inactivity timer runs only while `phase === 'streaming'`. It's (re)armed whenever
the phase transitions to `'streaming'` (directly, or via `recordActivity()` recovering from
`'stalled'`) and on every subsequent `recordActivity()` call while already streaming; it's disarmed
the instant `phase` becomes anything else, including a host-driven reassignment away from
`'streaming'` — so a stale timer can never fire a stall transition after the host has already moved
on. Phase transitions into/out of `'stalled'` are announced through an internal
`<lr-live-region>` rather than a hand-rolled `aria-live` region: entering `'stalled'` announces
"Connection stalled." with `mode="assertive"` (a stall can need the user's attention before they
give up and navigate away). Leaving `'stalled'` always announces with `mode="polite"` (good news
doesn't need to interrupt), but the *wording* depends on the destination phase: "Connection
restored." only when leaving `'stalled'` for `'streaming'` (a genuine recovery, typically via
`recordActivity()`); a neutral "No longer stalled." when the destination is `'idle'`/`'connecting'`
instead (the host gave up on the stream, which is not the same thing as it recovering — a
screen-reader user must not be told the opposite of what a sighted user sees). Calling
`recordActivity()` itself never announces anything, no
matter how often the host calls it — only the phase *transition* announces, exactly once. The
decorative indicator dot is `aria-hidden` (a color/motion cue only) and only pulses while
`phase="streaming"`; `'stalled'` is styled as a warning tone, not danger, since a stall is usually
recoverable — a host that wants to escalate after N stalls can scope its own CSS off
`[phase="stalled"]`, or stop rendering this component and show its own danger-styled error state
instead. The pulse animation is suppressed under `prefers-reduced-motion: reduce`.

**Known gotchas:**
- `recordActivity()` is a plain instance method, not a reactive property — there's nothing to bind
  to in a template; call it directly from streaming/application code on every real chunk received.
- Never call `recordActivity()` for a heartbeat/keep-alive ping. This component has no
  payload-inspection logic of its own, so a connection that's only sending pings (no real content)
  for longer than `stall-threshold-ms` is *supposed* to read as stalled — that's the entire
  point of the API.
- Setting `stallThresholdMs` to `0`, a negative number, or a non-finite value disables the stall
  timer outright; the component will stay `'streaming'` forever until the host manually changes
  `phase`.
- `phase` remains directly settable at all times; assigning `'stalled'` yourself fires `lr-stall`
  and the assertive announcement exactly as if the timer had fired.
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
- `title: string = ''` — the session's display title. Falls back to "Untitled conversation" when empty
  (display only — the property itself is never mutated by that fallback).
- `excerpt: string = ''` — a short preview snippet of the last message. Omit for no excerpt line.
  Ignored entirely once the `excerpt` slot has assigned content.
- `timestamp?: Date | string` (attribute: false) — accepts a `Date` or anything `new Date()` can parse
  (e.g. an ISO 8601 string); invalid input is treated as unset (no `<time>` rendered).
- `formatTimestamp?: (date: Date) => string` (attribute: false) — overrides the default absolute-time
  rendering (clock time for same-day timestamps, otherwise a calendar date). Not a fuzzy "2 hours ago"
  relative string — bucketed relative grouping is a list-level concern, not this row's job.
- `active: boolean = false` (reflected) — whether this is the currently-selected/open session; drives
  the brand-quiet background treatment.
- `editable: boolean = true` (reflected) — whether inline-rename is available at all. When `false`, the
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
  size plus the compact padding, while a row with `editable=false` and no actions collapses much
  further.
- `spellcheck: boolean = true` — forwarded to the in-place rename `<input>`; `spellcheck="false"` is
  parsed as false (not Lit's default boolean-attribute behavior)
- `autocapitalize: string = ''` — forwarded to the in-place rename `<input>`; empty omits the attribute
- `autoCorrect: string = ''` (attribute `autocorrect`) — forwarded to the in-place rename `<input>`
  (Safari/WebKit-specific); empty omits the attribute. Named `autoCorrect` to avoid
  `HTMLElement.autocorrect`'s incompatible DOM typing.

**Events:** `lr-select` (no detail payload — identify the row via the platform `id` attribute on the
event's `target`/`currentTarget`, the same convention `<lr-attachment-chip>` uses; fires on a click on
`[part="option"]` outside the rename button/`actions` slot, or Enter/Space while it's focused, only
while not currently renaming), `lr-rename` (`detail: { title: string }` — an in-place rename was
committed via Enter or blur-while-editing; does not mutate `title` itself, this is a controlled
component — not fired when the trimmed draft is empty or unchanged from the original `title`, treated
as an implicit cancel), `blur` (no detail — re-dispatched from the in-place rename `<input>`'s own
`blur`, bubbling and composed unlike the native event), `focus` (no detail — re-dispatched from the
in-place rename `<input>`'s own `focus`, for the same reason as `blur`)

**Slots:**
- `actions` — overflow/icon-button controls rendered at the trailing edge of the row (e.g. a
  pin/delete control); only visually shown once it actually has assigned elements. The only slot that
  may hold focusable content.
- `leading` — non-interactive leading content (avatar, purpose icon, status dot), rendered inside the
  selectable region before the title/excerpt content.
- `content` — replaces the built-in title + excerpt + meta content area with host-supplied
  non-interactive row content.
- `excerpt` — full override of the excerpt presentation (e.g. a search-hit snippet with `<mark>`);
  wins over the `excerpt` property whenever it has assigned content.
- `meta` — small, non-focusable structured fields below the title/excerpt (a day label, cost, request
  count); entirely app-supplied, this component computes none of it.

`leading`/`content`/`excerpt`/`meta` must all stay non-focusable — see the `role="button"` note below.

**CSS parts:** `base`, `active-indicator` (decorative, rendered only while `active`), `option`,
`content`, `title`, `title-input`, `rename-button`, `excerpt`, `timestamp`, `actions`

**Themeable custom properties:** `--lr-conversation-item-active-bg` (default
`var(--lr-color-brand-quiet)`) — the row's background while `active`. `--lr-conversation-item-active-color`
(default `var(--lr-color-text)`) — the text color of `[part='excerpt']` and `[part='timestamp']`
while `active`. Both are declared as inline `var()` fallbacks at the point of use and never on
`:host`, so either can be set on the element *or on any ancestor* (a thread-list wrapper, a page
theme layer); `::part(base)[active]` is not valid CSS — Shadow Parts forbids an attribute selector
after `::part()` — so the only previous lever was overriding the library-wide `--lr-color-brand-quiet`
token and repainting everything else reading it. Unset, each falls back to exactly the token its rule
used before.

**These two are a contrast-sensitive pair — override them together, never one alone.** The
`-active-color` hook exists precisely because the quiet text tone only reaches about 4.25:1 against
the default active background; keep any override at 4.5:1 or better against it. And note that
`[part='title']` is *not* restyled by the pair — it keeps `--lr-color-text` regardless — so a dark
custom active background needs its own title color set alongside them, or the title drops below
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
[part='base']` is ordered *before* `:host([active]) [part='base']` (equal specificity), so a row that
is both compact and active keeps the active background and the promoted excerpt/timestamp contrast.

Plus shared tokens — `--lr-space-xs/-s/-m`, `--lr-radius`,
`--lr-transition-fast`, `--lr-color-text/-text-quiet/-brand/-brand-quiet/-surface`,
`--lr-focus-ring-width/-color/-offset`, `--lr-icon-button-size`.

**Optional peer deps:** none.

```html
<lr-conversation-item
  id="sess_123"
  title="Q3 roadmap planning"
  excerpt="Let's revisit the timeline for the launch…"
  .timestamp=${session.updatedAt}
  ?active=${session.id === currentSessionId}
  @lr-select=${(e) => openSession(e.currentTarget.id)}
  @lr-rename=${(e) => renameSession(e.currentTarget.id, e.detail.title)}
>
  <button slot="actions" aria-label="Delete conversation">✕</button>
</lr-conversation-item>
```

`role="button"` (not `"option"`) lives on `[part="option"]` — despite the part name — so the row has
valid semantics both standalone and inside a larger history-list layout: it activates one current
session rather than being a listbox option, so it requires no particular owner role. Selection is
conveyed via `aria-current="true"` while `active`, not `aria-selected`. Because `role="button"`
forbids focusable descendants (axe-core's `nested-interactive` rule), the rename button and the
`actions` slot are rendered as DOM *siblings* of `[part="option"]` inside `[part="base"]`, not nested
inside it — the same constraint the in-place rename `<input>` runs into one level deeper, which is
why `[part="option"]` sheds its `role`/`tabindex`/`aria-current`/`aria-label` entirely for the
duration of an edit rather than just visually swapping content (a row mid-edit *is* a text field).

**Known gotchas:**
- `lr-select` carries no detail payload at all — read the session id off the event's own `target`/
  `currentTarget`, not a `detail` field.
- Renaming is a controlled interaction: committing `lr-rename` never updates `title` locally: the
  consumer must apply the new title once it's actually persisted.
- An empty or unchanged (post-trim) rename draft is treated as an implicit cancel — no `lr-rename`
  fires, and the row silently reverts to showing `title`.
- Rename is triggered only by the dedicated pencil-icon button, never a double-click on the title —
  double-click has no keyboard/screen-reader equivalent and would also swallow the row's own
  single-click `lr-select`.
- While renaming, `[part="option"]` has no `role`/`tabindex`/`aria-current`/`aria-label` at all — a
  screen reader briefly stops announcing it as a button for the duration of the edit.
- The part is named `option` for historical reasons but carries `role="button"`; don't write CSS or
  ARIA assumptions that expect a listbox option.
- Setting `editable = false` mid-rename silently discards the in-progress draft (no `lr-rename`
  fires) — a consumer toggling `editable` off (e.g. in response to some other row entering rename
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

**Exported types:**
- `LyraModelCatalogEntry { id: string; label: string }` — one catalog row.
- `LyraModelCatalog = string[] | LyraModelCatalogEntry[]` — either every entry is a plain string (used
  as both id and label) or every entry is a full `{ id, label }` row; the two shapes are not meant to be
  mixed within one array.

**Properties:**
- `provider: string = ''` — informational only (e.g. `'ollama'`); rendered as a small leading badge.
- `catalog?: LyraModelCatalog` (attribute: false) — the full model list. Omit (or leave empty) to fall
  back to plain free-text entry.
- `allowCustom: boolean = false` (attribute `allow-custom`, reflected) — let the user type/commit a
  value that isn't in `catalog`, even when `catalog` is non-empty.
- `label: string = ''` — optional visible title above the control, mirroring `<lr-select>`'s own
  `label` exactly: rendered via a `[part="form-control-label"]` `<label>` paired with the control's
  id, and once non-empty it takes over as the accessible-name source (an `aria-label` override is
  then only consulted as the fallback). Empty (the default) keeps the original
  `aria-label || placeholder || 'Model'` accessible-name chain untouched.
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
- `autocomplete: string = 'off'`, `inputMode: string = ''` (`inputmode`), and `enterKeyHint: string = ''`
  (`enterkeyhint`) — forwarded to the free-text mode's native `<input>`.
- `name: string = ''` (reflected)
- `disabled: boolean = false` (reflected)
- `required: boolean = false` (reflected — enforced via `internals.setValidity()`)
- `open: boolean = false` (reflected)
- `size: 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected) — visual size; same `xs`–`xl` scale as
  `<lr-select>`'s own `size`, scaling `[part="trigger"]`/`[part="combobox"]`'s padding/min-height/
  font-size and `[part="expand-icon"]`'s box size (see the themeable custom properties below).
- `value: string` — getter/setter (hand-rolled, not the `FormAssociated` mixin); the current model id,
  `''` when nothing is selected. Writing it calls `internals.setFormValue()` synchronously. A named,
  untouched model-select contributes `''` to `FormData` instead of omitting its key.

**Methods:** `click()` (override) — forwards to whichever internal control the active mode renders,
since `HTMLElement.prototype.click()` is otherwise a no-op on a custom element with no native click
semantics of its own (mirrors `<lr-button>`'s identical host `click()` forwarding, so a generic
form-automation helper or another component calling `.click()` on the host actually opens the picker
instead of silently doing nothing). Closed-dropdown mode forwards a real `.click()` to the trigger
`<button>`, whose own `@click` handler opens it. Free-text mode instead calls `.focus()` on the
combobox `<input>`: unlike a genuine pointer click, `HTMLElement.click()` never moves focus (that's a
`mousedown` side effect the browser applies only to real pointer interaction), and this mode's open
behavior is wired to the input's `focus` event (`onInputFocus`), not a `click` handler on the input
itself.

**Mode switching:** `closedMode` (private) is `true` whenever `normalizedCatalog.length > 0 &&
!allowCustom` — a non-empty `catalog` with `allowCustom` left `false` renders the closed dropdown
trigger-button UI (`[part="trigger"]`, `role="combobox"` on a `<button>`, no typing). Any other
combination (`catalog` empty/unset, or `allowCustom` true) renders the free-text `<input>` UI
(`[part="combobox"]`/`[part="combobox-input"]`) with live substring filtering against the catalog (id or
label, case-insensitive). The mode is re-evaluated on every render, so toggling `allowCustom` or clearing
`catalog` at runtime switches modes live, repositioning the shared `[part="listbox"]` popover against
whichever element is the active anchor.

A `value` that isn't present in `catalog` (e.g. a model id saved from a provider whose live catalog has
since changed) is never silently dropped: it's appended to the rendered option list as a synthetic,
visually-distinct row (dashed border, italic label, "not in catalog" badge) computed fresh from
`catalog` + `value` on every access, without ever mutating the `catalog` property itself.

**Events:**
- `lr-change` (`detail: { value: string; inCatalog: boolean }` — fired when a value is selected
  from the listbox or committed in free-text mode; `inCatalog` reflects whether that value was
  actually present in `normalizedCatalog`, so a consumer can flag a freshly-typed custom value
  distinctly from a real catalog pick)
- `blur` (no detail) — re-dispatched from the free-text mode's internal `<input>`'s own `blur`,
  bubbling and composed unlike the native event. Closed-dropdown mode's trigger `<button>` has no
  equivalent re-dispatch, matching `<lr-select>`'s own trigger.
- `focus` (no detail) — re-dispatched from the free-text mode's internal `<input>`'s own `focus`,
  for the same reason as `blur`.

**Slots:** `hint` (custom hint content), `error` (custom error content).

**CSS parts:** `form-control-label` (the `<label>` element — only rendered, and only contributes to
the accessible name, once `label` is non-empty), `trigger` (closed-dropdown mode's
`<button role="combobox">`, also its positioning anchor), `combobox` (free-text mode's input
container, also its positioning anchor), `combobox-input` (the free-text `<input>`),
`provider-badge` (the optional leading `provider` label), `listbox` (the options popover, shared by
both modes), `option`, `option-label`, `option-badge` (the "not in catalog" badge on a synthetic
stale-value row), `expand-icon` (the dropdown chevron, present in both modes), `hint` (the hint
message), `error` (the error message)

**Themeable custom properties:** `--lr-model-select-trigger-padding` (default `var(--lr-space-xs)
var(--lr-space-s)`) — `[part="trigger"]`/`[part="combobox"]`'s padding shorthand.
`--lr-model-select-trigger-min-height` (default `var(--lr-size-2-5rem)`) — their block-size floor.
`--lr-model-select-font-size` (default `var(--lr-font-size-md)`) — their font size.
`--lr-model-select-expand-size` (default `var(--lr-size-1-75rem)`) — `[part="expand-icon"]`'s
decorative box size (clamped against `--lr-icon-button-size` via `min()`). All four are declared on
`:host` at these `size="m"` (the default) values and re-declared inside each
`:host([size="xs"|"s"|"l"|"xl"])` block at that tier's own value — same xs–xl scale `<lr-select>`
uses — so `size` is the primary lever; override the cssprop directly only to retune a single tier or
step outside the scale entirely. `--lr-model-select-option-active-bg` (default
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
    { id: 'gpt-4o', label: 'GPT-4o' },
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
- `catalog` must be homogeneous — an array of plain strings, or an array of `{ id, label }` objects, not
  a mix; `LyraModelCatalog` is a union of two array *types*, not an array of a union item type.
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
equivalent). The host is expected to assign the *entire* current text on every update to `content`,
not a delta — this component does no accumulation or ordering of its own.

**Properties:**
- `content: string = ''` — the full current text so far.
- `streaming: boolean = false` (reflected) — shows the blinking cursor after the rendered text;
  reflects so a host can also target `lr-streaming-text[streaming]` in CSS.
- `coalesceMs: number = 50` (attribute `coalesce-ms`) — trailing-edge coalesce window, in ms, for
  `content` updates (see prose below).
- `markdown?: boolean` (attribute `markdown`, tri-state via a custom `ComplexAttributeConverter`) —
  `undefined` (attribute absent, the default) auto-detects via `looksLikeMarkdown`; the attribute
  present with no value or `="true"` forces `true`; `markdown="false"` forces `false`. An explicit
  `true`/`false` always wins over the heuristic.

**Exported helper:** `looksLikeMarkdown(text: string): boolean` — runs a fixed, ordered list of
lightweight regexes (ATX heading, fenced code block, `**bold**`, `_italic_`, inline code, bullet
list item, numbered list item, `[text](url)` link, blockquote) against the whole string and returns
`true` on the first match. Used internally whenever `markdown` is left unset; exported standalone
so the heuristic is directly testable without going through the component's render cycle. None of
the patterns need to be airtight — a false positive just routes ordinary prose harmlessly through
`<lr-markdown>`; a false negative just shows literal `**`/backticks/etc. as plain text until more
of the stream arrives.

**Events:** none.

**Slots:** none — content renders from `content`, not a slot.

**CSS parts:** `base`, `cursor` (only rendered while `streaming` is `true`)

**Themeable custom properties:** `--lr-streaming-text-cursor-width` (default `0.125rem` — the
cursor bar's inline size), `--lr-streaming-text-cursor-height` (default `1em`) — both
component-specific, since no shared "inline cursor bar" token exists, the same pattern
`<lr-typing-indicator>`'s own `--lr-typing-cursor-width`/`-height` use, plus shared
`--lr-space-xs` (cursor's `margin-inline-start`) and `--lr-transition-base` (blink animation
cycle length).

**Optional peer deps:** none — internally imports and auto-registers `<lr-markdown>` for
Markdown-mode rendering (a side-effect import; the host never needs to import or register it
itself).

```html
<lr-streaming-text id="out" coalesce-ms="80" streaming></lr-streaming-text>
<script type="module">
  const out = document.getElementById('out');
  let text = '';
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
class's usual DOM/ARIA plumbing. Within any `coalesce-ms` window, only the *last* `content` value
assigned actually reaches the rendered DOM. Two cases always bypass the throttle and flush
immediately: the very first `content` assignment after mount, and any transition of `streaming`
between `true` and `false` in *either* direction — so the final chunk of a finished stream can
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
- Only the very *first* `content` assignment after mount bypasses `coalesceMs` unconditionally —
  every later assignment is throttled normally except when it lands in the same update as a
  `streaming` transition (either `true → false` or `false → true`), which also forces an immediate
  flush.
- `markdown="false"` (any string value other than exactly `"false"` is treated as `true` by the
  converter) forces plain-text mode even if the text obviously contains Markdown syntax.
- Purely presentational: no events, and it does not announce anything to assistive tech itself — a
  host that needs streamed text announced needs `<lr-live-region>` for that (e.g. composed inside
  `<lr-chat-message>`).

---

## `lr-generation-status`

A compact, ticking status readout shown alongside an in-progress AI response: elapsed time, token
count, and token-throughput, plus a built-in Stop button. First-party invention (no Web Awesome
equivalent). Renders as e.g. `12.3s · 340 tokens · 27 tok/s [Stop]`.

**Properties:**
- `active: boolean = false` (reflected) — whether generation is currently in progress. The
  elapsed-time ticker (a ~1s `setInterval`) runs only while this is `true`.
- `startedAt?: number` (attribute `started-at`) — epoch-ms timestamp of when generation began.
  Optional — when unset, or set to a value that fails to parse as a finite number (e.g. an ISO-8601
  date string, which `type: Number` conversion turns into `NaN`), while `active` is `true`, this
  component captures `Date.now()` itself the moment `active` becomes `true` and counts from there
  instead — an invalid value is treated identically to "unset", never rendered as literal `"NaNs"`.
- `tokenCount?: number` (attribute `token-count`) — running token count so far. Omitted from the
  readout entirely (no `tokens` segment) while unset.
- `tokensPerSecond?: number` (attribute `tokens-per-second`) — host-computed tokens/sec figure,
  used as-is when set. When unset, derived from `token-count`/elapsed time instead (see prose).
- `showStop: boolean = true` (attribute `show-stop`, **not reflected**) — whether the built-in Stop
  button renders at all. Uses a string-value-aware `ComplexAttributeConverter` (not Lit's default
  presence-based `type: Boolean`), so a plain-HTML `show-stop="false"` content attribute correctly
  turns it off — the literal string `"false"` maps to `false`; the attribute's mere presence with any
  other value (or no value) maps to `true`. A Lit template can instead use a `.showStop=${false}`
  property binding. **Caveat:** a `?show-stop=${false}` boolean-attribute *binding* still can't turn
  it off when the attribute was never present in markup to begin with — that binding only ever
  removes the attribute when falsy, and removing an attribute that's already absent fires no
  `attributeChangedCallback` (see AGENTS.md); use `.showStop=${false}` or the plain
  `show-stop="false"` string form instead.

**Events:** `lr-stop` (no detail payload — `this.emit('lr-stop')` is called with no second
argument, so `event.detail` is `null`, not `undefined`) — fired when the built-in Stop button is
clicked.

**Slots:** none.

**CSS parts:** `base`, `elapsed` (always rendered, reads `"0.0s"` before the component has ever
been active), `tokens` (only rendered when `token-count` is set), `throughput` (only rendered when
a value is available, host-supplied or derived), `stop-button` (only rendered while `show-stop` is
`true`)

**Themeable custom properties:** shared tokens only — `--lr-color-text-quiet` (base readout and
tokens/throughput text color), `--lr-color-text` (the elapsed segment's higher-contrast color,
and the stop-button's icon color), `--lr-space-s` (stop-button margin), `--lr-icon-button-size`
(stop-button min sizing, capped at `1.75rem`), `--lr-color-border`/`-surface`/`-brand`
(stop-button border/background/hover), `--lr-focus-ring-width`/`-color`/`-offset`,
`--lr-transition-fast`.

**Optional peer deps:** none.

```html
<lr-generation-status active started-at="1732000000000" token-count="340" show-stop></lr-generation-status>
<script type="module">
  document.querySelector('lr-generation-status').addEventListener('lr-stop', () => {
    controller.abort(); // stop the host's own generation
  });
</script>
```

This is deliberately a *different* concern than `<lr-stream-status>`: that component is about
transport/connection health (idle/connecting/streaming/stalled, heartbeat-aware stall detection),
while this one is a user-facing metrics readout for a generation both components' hosts typically
already know is healthily in progress. Neither imports or depends on the other; compose both side
by side rather than picking one. `tokens-per-second`, when supplied directly, is always used as-is;
when omitted, this component derives a live figure from `token-count` divided by elapsed seconds,
but only once at least one full second of elapsed time has accumulated (dividing by a sub-second
window can produce wildly-swinging early readings, e.g. 3 tokens in 40ms reading as "75 tok/s").
The elapsed clock is frozen, not reset, once `active` goes `false` — a static "Generated in 12.3s"
reads better as a completed-state summary than the readout blanking out the instant generation
ends.

This readout ticks roughly once per second while active, which is exactly the kind of
high-frequency update `<lr-live-region>`/`Announcer` exists to *prevent* from being read aloud
verbatim — this component therefore carries no `role="status"`/`aria-live` of its own and never
announces anything. A host that wants generation-start/-end announced should pair this with
something that announces state *transitions* instead. The Stop button gets a normal, always-present
`aria-label="Stop generating"`, no different from any other icon-only button in this library.

**Known gotchas:**
- `showStop` defaults to `true` and is not a reflected property. Its `ComplexAttributeConverter`
  makes the plain content attribute `show-stop="false"` work correctly, but a `?show-stop=${false}`
  Lit boolean-attribute *binding* still can't turn it off starting from absent markup — see the
  property list above for the exact footgun.
- The derived `tokens-per-second` figure only appears once `elapsedMs >= 1000`; before that, the
  `throughput` part simply doesn't render — supply `tokens-per-second` yourself for a stable figure
  from the very first tick.
- The elapsed-time display is never reset to `"0.0s"` when `active` goes `false` — it freezes at
  its last value. A host that wants a blank readout between generations must reset `started-at`/
  `token-count` itself (or unmount/remount the element).
- `started-at` only re-baselines the ticker at the moment it's read: mounting the component with
  `active` already `true` but no `started-at` captures `Date.now()` at that first update, not at
  whatever earlier instant generation may actually have begun.

---

## `lr-code-block`

Fenced code display with optional lazy syntax highlighting and a copy button. First-party invention
(no Web Awesome equivalent). It lazy-loads the optional peer dependency `shiki` (see
`code-loader.ts`) for the actual tokenizing, and includes a compact GreyCat/GCL grammar because
Shiki does not bundle one. It falls back to a plain `<pre><code>` when that peer isn't installed or
`language` is unset/unrecognized. That
fallback is the *default* rendering path, not a degraded one: unhighlighted code is perfectly usable,
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
- `accessibleLabel: string = ''` (attribute `aria-label`) — names the internal focusable code-body
  region; otherwise a localized filename/language description is generated
- `collapsible: boolean = false` (reflected) — shows the collapse/expand chevron button
- `collapsed: boolean = false` (reflected) — only has a visible effect while `collapsible` is also
  true
- `copyable: boolean = true` (reflected) — shows the copy-to-clipboard button (assign `false` via a
  PROPERTY binding, e.g. `.copyable=${false}` — a `?copyable=${false}` boolean-attribute binding
  cannot override a true default)
- `maxHeight: string = ''` (attribute `max-height`) — a CSS length (e.g. `"20rem"`); once set, the
  code scrolls internally past this height instead of growing the page
- `lineNumbers: boolean = false` (attribute `line-numbers`, reflected) — displays one-based line
  numbers for both highlighted output and the plain-text fallback
- `highlightLines: string = ''` (attribute `highlight-lines`) — comma-separated 1-based inclusive
  line ranges (e.g. `"3-5,7"`) to visually emphasize. Declarative sugar over `highlights` — merges
  with, and renders identically to, any `line-range` entries there.
- `interactiveLines: boolean = false` (attribute `interactive-lines`) — turns the
  (`lineNumbers`-gated) gutter into a roving-tabindex group of buttons emitting `lr-line-click`.
  Has no effect while `lineNumbers` is unset.
- `highlights: LyraHighlight[] = []` (attribute: false) — host-supplied highlights to paint over the
  code (the shared anchor-target `LyraHighlight` contract from `document-viewer/anchors.ts`). Only
  `line-range` anchors are meaningful here — every other `LyraAnchor` kind is ignored.
- `activeHighlightId: string | null = null` (attribute `active-highlight-id`) — the `highlights`
  entry, if any, currently treated as active (`data-active` on its lines).
- `anchorKinds: LyraAnchor['kind'][]` — readonly `['line-range']`, for the shared anchor-target
  contract.
- `languages?: Record<string, ShikiLanguageInput>` (attribute: false) — a map of language id to an
  already-imported shiki grammar module (e.g. `{ bash: bashGrammar }` from a module-scope
  `import bash from 'shiki/langs/bash.mjs'`). When `language` matches a key here, highlighting is
  seeded from exactly that pre-supplied grammar via a fine-grained `createHighlighterCore()`
  highlighter, bypassing the default ~200-language dynamic-import path (`loadShikiHighlighter()`)
  for that language — an additive, opt-in escape hatch for a build scoped to just the languages a
  consumer actually needs. A `language` absent from this map (or `languages` left unset) falls back
  to the default dynamic-import path unchanged.
- `languagesOnly: boolean = false` (attribute `languages-only`) — skips the default shiki loader;
  use when every requested language is supplied through `languages`

**Methods:** `scrollToAnchor(target)` — resolves a `line-range` anchor (or a `highlights` id string
resolving to one) by scrolling its start line into view within `[part="body"]`; resolves `false`
when the anchor isn't a `line-range`, the id isn't found, or the start line is out of bounds.

**Events:** `lr-copy` (`detail: { text: string }` — always the raw `code` value, never the
highlighted HTML, and always fires regardless of whether the actual OS clipboard write succeeded),
`lr-toggle` (`detail: { collapsed: boolean }` — fired when the built-in collapse/expand header
button is activated, same event name/shape convention as `<lr-thinking-panel>`'s own `lr-toggle`),
`lr-line-click` (`detail: { line: number }` — a gutter line number was activated while
`interactiveLines` is set), `lr-highlight-activate` (`detail: { id: string }` — declared for
parity with this library's other anchor-target viewers; not currently emitted by this component),
`lr-text-select` (`detail: { text, anchor, rects }` — a text selection inside the code body ended;
`anchor` is a `line-range` anchor covering the selected lines)

**Slots:** none.

**CSS parts:** `base`, `header`, `filename`, `language`, `copy-button`, `toggle`, `body`, `pre`,
`code`, `line-highlight` (a line marked by `highlightLines` or a `line-range` entry in `highlights`),
`line-button` (a gutter line-number button, only rendered while `interactiveLines` and `lineNumbers`
are both set)

**Themeable custom properties:** `--lr-code-block-max-height` (default `none` — the consumer-tunable
scroll cap; only takes effect once `max-height` is set), `--lr-code-block-font` (default
`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` — no shared `--lr-*` monospace
token exists to resolve through), `--lr-code-block-tab-size` (default `2` — tab width for the
rendered code, applied to `[part='pre']`), `--lr-code-block-active-line-outline-color` (default
`var(--lr-color-brand)` — the outline around the line marked active by `active-highlight-id`), plus shared tokens `--lr-color-border`, `--lr-radius`,
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

**Optional peer deps:** `shiki` (lazy-loaded and cached once per page by `code-loader.ts`'s
`loadShikiHighlighter()`, which builds a single `Highlighter` seeded with the bundled `github-light`/
`github-dark` "dual themes" and *zero* language grammars up front; each `language` a
`<lr-code-block>` actually requests is loaded incrementally on first use via
`loadShikiLanguage()`, and a language id that fails to load once is remembered and never retried. If
`shiki` isn't installed, `loadShikiHighlighter()` resolves to `null` with a one-time `console.warn`
and every instance falls back to plain text — install it with `pnpm add shiki` to enable
highlighting).

```html
<lr-code-block
  language="typescript"
  filename="sum.ts"
  collapsible
  max-height="20rem"
  .code=${`export function sum(a: number, b: number) {\n  return a + b;\n}`}
  @lr-copy=${(e) => console.log('copied', e.detail.text)}
></lr-code-block>
```

Set `line-numbers` when source context benefits from numbered lines. The option does not change the
raw `code` value or the `lr-copy` event payload.

A `<lr-skeleton variant="rect">` placeholder (with `aria-busy="true"` on the host) stands in only
while shiki itself is loading for the very first time on the page and `language` is set — it is
deliberately *not* shown again for a later per-language grammar fetch (that's typically fast, and the
plain-text fallback already reads fine as a placeholder for it). Internally, a shiki `transformer`
(`partTransformer`) rewrites shiki's generated `<pre>`/`<code>` nodes in a single pass to carry this
component's own `part="pre"`/`part="code"` hooks and strips shiki's default `tabindex="0"` from
`<pre>`, since `[part="body"]` is already the single scrollable/focusable region (`role="group"`,
`tabindex="0"`) for the code area. Dark mode is handled via shiki's own "dual themes" feature: every
token carries its light color as a plain inline `color`/`background-color` and its dark color in
`--shiki-dark`/`--shiki-dark-bg` custom properties, which an `!important` media-query rule in
`code-block.styles.ts` reassigns under `prefers-color-scheme: dark` — the one deliberate exception in
this component to every other color being a `--lr-*` token, since these values come from shiki's own
theme data.

**Known gotchas:**
- `copyable` defaults to `true` and reflects — see the property note above about overriding it with a
  property binding, not a boolean-attribute binding.
- an in-flight per-language grammar load is guarded by an internal token so a `code`/`language` change
  that arrives before a previous load resolves never applies a stale result — only the load matching
  the *current* `language` is ever rendered.
- a malformed `code`/`language` combination that makes shiki's `codeToHtml()` throw falls back to
  plain text silently, not a blank code block.
- the "Copied!" label reverts to "Copy" after a fixed 1500ms, regardless of whether the clipboard
  write actually succeeded — `navigator.clipboard` is absent in insecure contexts/older browsers, and
  `lr-copy` still fires either way.

---

## `lr-code-block-core`

A build-lean sibling of `<lr-code-block>` above, for a consumer whose `languages` map already
covers every language it will ever render. Where `<lr-code-block>` unconditionally calls
`loadShikiHighlighter()` — the default ~200-language dynamic-import table loader, whose bundled
lookup table a bundler can't statically narrow away even when a consumer never actually uses it —
this component's own module never imports or calls that function at all. It only ever calls
`loadShikiHighlighterCore(languages)` (shiki's "fine-grained bundle" recipe: `createHighlighterCore()`
plus an explicit oniguruma engine, seeded with *only* the grammars in `languages`), so a consumer
importing this entry point instead of `code-block.js` gets a build genuinely free of shiki's full
language table.

A `language` value absent from `languages` always renders the plain `<pre><code>` fallback — there is
no default/full-table highlighter here to fall back to, unlike `<lr-code-block>`'s dynamic-import
path for an unmapped language. That fallback is the *default* rendering path, not a degraded one,
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
- `accessibleLabel: string = ''` (attribute `aria-label`) — names the internal focusable code-body
  region; otherwise a localized filename/language description is generated.
- `collapsible: boolean = false` (reflected) — shows the collapse/expand chevron button.
- `collapsed: boolean = false` (reflected) — only has a visible effect while `collapsible` is also
  true.
- `copyable: boolean = true` (reflected) — shows the copy-to-clipboard button.
- `maxHeight: string = ''` (attribute `max-height`) — a CSS length (e.g. `"20rem"`); once set, the
  code scrolls internally past this height instead of growing the page.
- `lineNumbers: boolean = false` (attribute `line-numbers`, reflected) — displays one-based line
  numbers for highlighted and plain output.
- `highlightLines: string = ''` (attribute `highlight-lines`) — comma-separated 1-based inclusive
  line ranges (e.g. `"3-5,7"`) to visually emphasize. Declarative sugar over `highlights` — merges
  with, and renders identically to, any `line-range` entries there.
- `interactiveLines: boolean = false` (attribute `interactive-lines`) — turns the
  (`lineNumbers`-gated) gutter into a roving-tabindex group of buttons emitting `lr-line-click`.
  Has no effect while `lineNumbers` is unset.
- `highlights: LyraHighlight[] = []` (attribute: false) — host-supplied highlights to paint over the
  code. Only `line-range` anchors are meaningful here — every other `LyraAnchor` kind is ignored.
- `activeHighlightId: string | null = null` (attribute `active-highlight-id`) — the `highlights`
  entry, if any, currently treated as active (`data-active` on its lines).
- `anchorKinds: LyraAnchor['kind'][]` — readonly `['line-range']`, for the shared anchor-target
  contract, identical to `<lr-code-block>`.
- `languages: Record<string, ShikiLanguageInput> = {}` (attribute: false) — grammar definitions this
  instance can highlight, e.g. `{ json: jsonGrammar }` (import from `shiki/langs/<name>.mjs`). Empty
  (the default) never highlights at all — every `language` renders the plain-text fallback.

**Methods:** `scrollToAnchor(target)` — resolves a `line-range` anchor (or a `highlights` id string
resolving to one) by scrolling its start line into view within `[part="body"]`; resolves `false`
when the anchor isn't a `line-range`, the id isn't found, or the start line is out of bounds.
Identical behavior to `<lr-code-block>`'s own method.

**Events:** `lr-copy` (`detail: { text: string }` — always the raw `code` value, never the
highlighted HTML, and always fires regardless of whether the actual OS clipboard write succeeded),
`lr-toggle` (`detail: { collapsed: boolean }` — fired when the built-in collapse/expand header
button is activated), `lr-line-click` (`detail: { line: number }` — a gutter line number was
activated while `interactiveLines` is set), `lr-highlight-activate` (`detail: { id: string }` —
declared for parity with this library's other anchor-target viewers; not currently emitted by this
component), `lr-text-select` (`detail: { text, anchor, rects }` — a text selection inside the code
body ended; `anchor` is a `line-range` anchor covering the selected lines).

**Slots:** none.

**CSS parts:** `base`, `header`, `filename`, `language`, `copy-button`, `toggle`, `body`, `pre`,
`code`, `line-highlight`, `line-button` — identical set to `<lr-code-block>`.

**Themeable custom properties:** identical to `<lr-code-block>` — `--lr-code-block-max-height`,
`--lr-code-block-font`, `--lr-code-block-tab-size` (default `2`, applied to `[part='pre']`),
`--lr-code-block-active-line-outline-color` (default `var(--lr-color-brand)`), plus the same shared
tokens. Both of the last two are inline `var()` fallbacks at the point of use rather than `:host`
declarations, so a page-, container-, or theme-level value reaches them; see `<lr-code-block>` above
for the full rationale, including why `<lr-markdown>`/`<lr-markdown-core>` must declare the tab-size
fallback separately.

**Optional peer deps:** `shiki` (specifically its `shiki/core`, `shiki/engine/oniguruma`,
`shiki/wasm`, and `shiki/themes/github-{light,dark}.mjs` subpaths — never `shiki`'s main entry point,
which is what carries the ~200-language table this component exists to avoid). Building the
fine-grained highlighter is cached per `languages` object identity (a `WeakMap`), so passing the same
module-level `languages` constant on every render builds it only once.

```html
<script type="module">
  import jsonGrammar from 'shiki/langs/json.mjs';
</script>
<lr-code-block-core
  language="json"
  .languages=${{ json: jsonGrammar }}
  .code=${'{"ok": true}'}
></lr-code-block-core>
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
- `catalog?: LyraModelCatalog` (attribute: false, JS-only) — `string[] | { id: string; label: string
  }[]` (every entry must be one shape or the other, never mixed); passed straight through to the
  internal `lr-model-select`.
- `modelValue: string = ''` (attribute `model-value`) — the current model id.
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
- `disabled: boolean = false` (reflected) — disables the panel as a unit by forwarding to *both*
  internal `lr-model-select` and `lr-slider`; a wrapping `<fieldset disabled>` alone would not
  reach either, since a form-associated control's own `disabled` IDL property/attribute is never
  mutated by fieldset cascading.

**Events:** `lr-change` — `detail: { modelValue: string; inCatalog: boolean; temperature: number }`.
Fires whenever *either* child control's own `lr-change` fires, and always carries the full current
settings snapshot, not just whichever field actually changed. `inCatalog` is recomputed fresh from
`catalog`/`modelValue` on every emission (mirroring `lr-model-select`'s own `effectiveEntries` logic)
rather than cached from the last child event, so it's still correct even when `modelValue` was just
assigned directly instead of via the child's own event.

**Slots:** none — this is a fixed two-control composition, not a generic layout shell.

**CSS parts:** `base`, `model-row`, `temperature-row`, `temperature-label`, `temperature-value`

**Themeable custom properties:** no component-specific custom properties; consumes shared tokens
`--lr-space-l/-m/-s/-xs`, `--lr-color-border`, `--lr-radius`, `--lr-color-surface`,
`--lr-color-text`, `--lr-color-text-quiet`.

**Optional peer deps:** none — it composes the library's own `<lr-model-select>` and `<lr-slider>`
internally (both imported unconditionally as side effects, not optional).

```html
<lr-model-settings-panel
  provider="OpenAI"
  .catalog=${['gpt-4o', 'gpt-4o-mini', 'gpt-4.1']}
  model-value="gpt-4o"
  temperature="0.7"
  @lr-change=${(e) => console.log(e.detail)}
></lr-model-settings-panel>

<lr-model-settings-panel layout="compact" .catalog=${catalog}></lr-model-settings-panel>
```

The internal `lr-slider` renders with its own value readout suppressed (`.showValue=${false}`);
the current temperature is instead shown via this component's own `[part="temperature-value"]` span,
which interpolates `temperature` verbatim with no `toFixed`/formatting applied — a value like `0.1`
shows as `0.1`, and any floating-point noise a slider drag produces would render digit-for-digit. The
panel's own `temperature` property mirrors the nested slider's *live* value on every one of its
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
animation and per-state coloring; `variant: 'bars' | 'waveform' = 'bars'` (reflected); `barCount:
number = 5` (attribute `bar-count`); `gain: number = 1` — multiplier applied to the resolved
amplitude; `label: string = ''` — the host's accessible name.

**Methods:** `refreshTheme()` re-reads themeable custom properties after a runtime theme change (the
canvas resolves token values at paint time and cannot inherit `var()` directly).

**Events:** none — purely presentational.

**Slots:** none.

**CSS parts:** `base` (the root wrapper) and `canvas` (the drawing surface, `aria-hidden`; the host
itself carries `role="img"` and the accessible name).

**Themeable custom properties:** `--lr-audio-visualizer-color` (default `--lr-color-brand` —
active bar/waveform color), `--lr-audio-visualizer-quiet-color` (default
`--lr-color-brand-quiet` — inactive/idle color), and `--lr-audio-visualizer-height` (default
`var(--lr-size-3rem)` — the host's block size).

## `lr-branch-picker`

The "‹ 2 / 5 ›" navigator across regenerated/edited variants of one message. Pure controlled: it
never mutates its own `index` — the same contract `<lr-pagination>` already establishes for
`page`. The host listens for `lr-branch-change`, swaps the displayed branch content, and applies
the new `index` back. Renders nothing at all while `count < 2`, so a host can bind it unconditionally
on every message regardless of whether that message actually has multiple branches yet.

**Properties:** `index: number = 0` (reflected) and `count: number = 1` (reflected) — the current
0-based branch and the total branch count. `label: string = ''`.

**Methods:** `focus()` and `blur()` forward to the group wrapper.

**Events:** `lr-branch-change` — a branch navigation was requested. `detail: { index }`, always a
valid target (never past either bound); the consumer applies `index` after switching the displayed
branch content.

**CSS parts:** `base` (the group wrapper, `role="group"`), `previous-button`, `next-button`,
`previous-glyph` and `next-glyph` (the chevron inside each button — target these to swap the
arrow without restyling the button), and `position` (the visible "2 / 5" text).

**Additional API surface:**

- `click()` — Activates the currently enabled chevron, matching a click on the shadow control.

## `lr-message-actions`

The per-message action toolbar for `lr-chat-message`'s `actions` slot: opt-in built-ins (copy /
regenerate / edit / feedback) that emit intent events, plus a default slot for custom controls (e.g.
a slotted `lr-branch-picker`). `role="toolbar"` with WAI-ARIA APG roving-tabindex; ArrowLeft/
ArrowRight (RTL-aware) plus Home/End move focus across every stop — built-ins and slotted controls
alike — via `.focus()`. Only the plain-button built-ins (`regenerate`/`edit`) get their `tabindex`
toggled by this component itself; a composite child (`lr-copy-button`, the `feedback` built-in, any
slotted custom element) remains independently reachable via the page's native Tab order alongside the
toolbar's single roving stop, since a shadow-root-internal focusable element can't be suppressed from
outside its own component.

**Properties:** `controls: MessageActionControl[] = []` (attribute: false) —
`MessageActionControl = 'copy' | 'regenerate' | 'edit' | 'feedback'` (exported here); which built-ins
render, in that order. `copyText: string = ''`
(attribute `copy-text`) — required for the `copy` built-in to render at all. `feedbackValue: 'up' |
'down' | null = null` (attribute `feedback-value`) — forwarded to the embedded, thumbs-only
`lr-message-feedback` (its `reasons`/`commentable`/`detailFor` are never forwarded, so its detail
panel never opens). `revealOnHover: boolean = false` (reflected, attribute `reveal-on-hover`) — hides
the bar until the closest `lr-chat-message` ancestor is hovered or a control inside has focus.
`label: string = ''` — accessible name override for the toolbar. `accessibleLabel: string | null =
null` (attribute `aria-label`) — overrides the toolbar's computed accessible name, winning over
`label` and the localized default; attribute-reflects from a host-level `aria-label`.

**Events:** `lr-regenerate`/`lr-edit` — a built-in was activated, no detail. `lr-copy` —
`detail: { text }`, surfaced by the embedded `lr-copy-button` (bubbles/composed already, not
re-emitted). `lr-change`/`lr-submit` — bubble unchanged from the embedded, thumbs-only
`lr-message-feedback`.

**Slots:** default — additional controls (e.g. `lr-copy-button`, `lr-icon-button`,
`lr-branch-picker`) appended after the built-ins; they participate in the toolbar's arrow-key
navigation.

**CSS parts:** `base` (the toolbar, `role="toolbar"`), `copy-button` (the embedded
`lr-copy-button`), `regenerate-button`, `edit-button`, and `feedback` (the embedded
`lr-message-feedback`).

## `lr-message-feedback`

Thumbs up/down for one assistant message, with an optional inline detail step (categorical reason
chips + a free-text comment) that opens as a disclosure directly below the thumbs. Emits; never
persists — a host reflects a previously-recorded rating back via `value` (+ `disabled` for a
read-only display). Activating the pressed thumb again toggles it off to `null` unless its own detail
panel is currently open, in which case that click re-opens the panel instead.

**Properties:** `value: 'up' | 'down' | null = null` (reflected), `reasons: MessageFeedbackReason[] =
[]` (attribute: false, each `{ id, label }`), `commentable: boolean = false` (reflected) adds a
free-text comment field, `detailFor: 'down' | 'both' = 'down'` (attribute `detail-for`) — which
rating opens the detail panel, and `disabled: boolean = false` (reflected) for a read-only display.

**Methods:** `focus()` focuses the thumb matching the current `value` (the up thumb when `null`);
`blur()` blurs both thumbs.

**Events:** `lr-change` — `detail: { value: 'up' | 'down' | null }`, fired when a thumb's rating
changes or clears. `lr-submit` — `detail: { value: 'up' | 'down'; reasonIds: string[]; comment:
string }`, fired by the panel's submit button (`value` is never `null` here — the panel only exists
for a set rating).

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
fallbacks at the point of use and never on `:host`, so each can be set on the element *or on any
ancestor* — a whole transcript's feedback controls retint from one declaration. That shape is
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

**Properties:** `mode: 'hold' | 'toggle' = 'hold'` (reflected), `timesliceMs: number = 0` (attribute
`timeslice-ms`) — `> 0` passes a timeslice to `MediaRecorder.start()` and emits `lr-record-chunk` per
slice, `mimeType: string = ''` (attribute `mime-type`) — a `MediaRecorder` MIME type, `deviceId:
string = ''` (attribute `device-id`) — a specific input device, `audioConstraints?:
MediaTrackConstraints` (attribute: false) — merged into the `getUserMedia` audio constraints,
`levelEvents: boolean = false` (attribute `level-events`) — opt in to `lr-level`, `maxDurationMs:
number = 0` (attribute `max-duration-ms`) — auto-stop cap, `0` disables it, `showTimer: boolean =
true` (attribute `show-timer`), `disabled: boolean = false` (reflected), plus two readonly
properties: `state: 'idle' | 'requesting' | 'denied' | 'recording' | 'error' = 'idle'` (reflected to
`data-state`) and `stream: MediaStream | null` (the live capture stream, assignable straight onto
`lr-audio-visualizer.stream`).

**Methods:** `start()`, `stop()`, and `cancel()` drive the capture lifecycle imperatively (mirroring
the pointer/keyboard gestures).

**Slots:** `icon` (replaces the default mic glyph) and `recording-icon` (replaces the default
recording-state pulse glyph).

**Events:** `lr-record-start` (`detail: { stream: MediaStream }`), `lr-record-chunk` (`detail: { blob:
Blob }`, only when `timeslice-ms > 0`), `lr-record-stop` (`detail: { blob: Blob; durationMs: number
}`), `lr-record-cancel` (no detail), `lr-record-error` (`detail: { error: unknown }`), `lr-level`
(`detail: { level: number }` — 0–1 amplitude, opt-in via `level-events`), and `lr-state-change`
(`detail: { state: 'idle' | 'requesting' | 'denied' | 'recording' | 'error' }`).

**CSS parts:** `trigger` (the capture button), `icon`, `pulse` (rendered only while recording),
`timer` (the `M:SS` elapsed-time readout, only while recording and `show-timer`), and `status`
(visible status text for the `requesting`/`denied`/`error`/unsupported states).

**Themeable custom properties:** `--lr-push-to-talk-size` (default `var(--lr-size-3rem)`) — the
trigger button's inline and block size. `--lr-push-to-talk-recording-color` (default
`var(--lr-color-danger)`) — the border and text color of `[part='trigger']` while `state` is
`recording`; it recolors only the recording treatment and leaves every other danger-toned surface on
the page untouched. Like the library's other state hooks it is an inline `var()` fallback at the
point of use rather than a `:host` declaration, so it can be set on the element or on any ancestor —
`::part(trigger)[data-state='recording']` is invalid CSS (Shadow Parts forbids an attribute selector
after `::part()`), so re-pointing the shared `--lr-color-danger` token was previously the only way,
and it repainted every other danger surface with it.

**Additional API surface:**

- `blur()` — Forwards host blur to the internal push-to-talk control.
- `focus()` — Forwards host focus to the internal push-to-talk control.

## `lr-transcript-feed`

Live captions for an in-progress voice session: speaker-grouped entries, interim-vs-final styling
with in-place upgrades keyed by `id`, and a stick-to-bottom auto-scroll with release, the same
`follow`/`lr-follow-change` contract `<lr-terminal>` uses. Live captions only — recorded-media
transcript sync is a separate concern.

**Properties:** `entries: LyraTranscriptEntry[] = []` (attribute: false) — `LyraTranscriptEntry { id:
string; speaker?: string; text: string; interim?: boolean; timestamp?: number }` (exported by this
module; `timestamp` is epoch **milliseconds**). Reconciled keyed by `id` via Lit's `repeat()`: a
same-`id` entry with new `text` replaces in place, and a same-`id` entry whose `interim` flips from
`true` to unset/`false` moves from the interim area into the `role="log"` region and announces
exactly once. Interim entries render *after* the log container — visible, but structurally outside
it — so per-token mutations are never spoken by assistive tech. `follow: boolean = true`
(reflected), `showTimestamps: boolean = false` (attribute `show-timestamps`), `formatTimestamp?:
(epochMs: number) => string` (attribute: false), `maxRenderedEntries: number = 0` (attribute
`max-rendered-entries`) — `0` renders every entry; a positive value keeps only the newest N,
`label: string = ''` — accessible name for the `role="log"` region
(default: the localized `transcriptFeedLabel`), and `accessibleLabel: string | null = null`
(attribute `aria-label`) — overrides the log's computed accessible name, winning over `label` and
the localized default; attribute-reflects from a host-level `aria-label`.

**Methods:** `scrollToBottom()` re-engages `follow` and scrolls to the latest entry.

**Slots:** `empty` — custom empty state (default: the localized "No transcript yet").

**Events:** `lr-follow-change` — `detail: { following }`, fires on every `follow` transition.

**CSS parts:** `base` (the scroll container), `log` (the `role="log"` region wrapping final entries
only), `entry`, `speaker` (omitted for a row repeating the previous row's speaker), `text`
(`dir="auto"`), `timestamp` (only while `show-timestamps`), `interim` (present alongside `entry` on
an interim row), `interim-area` (the wrapper holding the interim row, present whether or not an
interim entry is showing), `jump-button` (shown only while `follow` is `false`), and `empty`.

## `lr-handoff-divider`

A labeled semantic separator marking control transfer between agents in a transcript ("Transferred
to Research Agent"), with an optional agent avatar. Purely presentational: no events, no
interactivity, no restore semantics. The computed label is announced once, on first connect,
through an internal `<lr-live-region>`.

**Properties:** `agent: string = ''`, `fromAgent: string = ''` (attribute `from-agent`), and `label:
string = ''`.

**Slots:** `avatar` — the incoming agent's `<lr-avatar>` (or icon), hidden entirely while empty.

**CSS parts:** `base` (the separator root, `role="separator"`), `line` (each of the two flanking
rules), `chip` (the visual `aria-hidden` chip wrapping the avatar and label), `avatar` (wrapper
around the `avatar` slot, only shown while the slot has content), and `label`.

## `lr-chat-viewport`

The transcript scroll container: owns stick-to-bottom behavior while an answer streams, the "jump to
latest" pill, and the unread divider. Two supported content shapes, auto-detected: ordinary element
children (typically `lr-chat-message`s — *slotted mode*), or exactly one `lr-virtual-list`
(*virtual mode*, detected via `instanceof`). In virtual mode this component defers all scrolling to
the slotted list's own `scrollToIndex()`. Follow/release state machine: while `follow` is engaged,
content growth re-scrolls to the end; release happens only on a user-intent gesture (wheel,
touchmove, scrollbar-drag, or PageUp/ArrowUp/Home while the log region has focus) that leaves the
view more than `bottomThreshold` from the end — a scroll caused by this component's own programmatic
scrolling, or by a layout shift, never releases it. Reaching the bottom again by any means re-engages
`follow`. The internal log defaults to `live="off"`, which avoids announcing every streaming token;
consumers that append complete messages at an announcement-safe cadence can opt into `polite` or
`assertive`.

**Properties:** `follow: boolean = true` (reflected) — component-managed stick-to-bottom state,
host-writable: setting `true` scrolls to the end and re-engages following, setting `false` releases
it. `bottomThreshold: number = 24` (attribute `bottom-threshold`) — px distance from the end still
counted as "at bottom." `unreadStartIndex: number | null = null` (attribute `unread-start-index`) —
index of the first unread item (element-child index in slotted mode, `items` index in virtual mode);
`null` disables both the divider and the pill's unread count. `live: 'off' | 'polite' | 'assertive' =
'off'` (reflected) — live-region policy forwarded to the internal `role="log"`; keep `off` for
token-by-token streaming and opt in only when messages are committed at an announcement-safe cadence.
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

**Slots:** default — the transcript: ordinary element children, or exactly one `lr-virtual-list`.

**CSS parts:** `base` (the positioning root), `scroll` (the scroll container, `role="log"`,
`tabindex="0"`; in virtual mode it stops scrolling itself but keeps the role), `content` (the
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
flex-basis through `::part(base)`, which is not available here — that list lives in the *consumer's*
light DOM, and `::slotted()` cannot be followed by `::part()`. Virtual mode therefore inherits this
component's existing requirement of a height-bounded parent, exactly as slotted mode's own
`[part='scroll']` already does. A document-tree declaration on the list (a consumer's own rule or an
inline style) still wins over the built-in one.

```html
<lr-chat-viewport unread-start-index="12" @lr-follow-change=${(e) => console.log(e.detail.following)}>
  <lr-chat-message role="user">…</lr-chat-message>
  <lr-chat-message role="assistant" status="streaming">
    <lr-streaming-text streaming .content=${partial}></lr-streaming-text>
  </lr-chat-message>
</lr-chat-viewport>
<lr-chat-composer status="streaming"></lr-chat-composer>
```

## `lr-suggestion-chips`

Starter prompts (empty thread) and follow-up suggestions (after a response) as a horizontally
scrollable chip row; activation hands the prompt to the host, which decides whether to compose it
into an input or send it directly. Never writes into a composer or sends anything itself.
Streaming-friendly: chips render through a keyed `repeat()` on `id`, so replacing follow-ups
mid-conversation preserves focus on any chip whose `id` survives.

**Properties:** `suggestions: ChatSuggestion[] = []` (attribute: false) — `ChatSuggestion { id:
string; label: string; detail?: string }` (exported here); `detail` is an optional secondary line.
Empty renders nothing at all. `wrap: boolean = false`
(reflected) — wraps into multiple rows instead of a single horizontally scrollable line. `label:
string = ''` — accessible name for the group, defaults to the localized `suggestionsLabel`.

**Events:** `lr-suggestion-select` — `detail: { id, label }`.

**CSS parts:** `base` (the labeled group), `chip` (each suggestion button), `chip-label` (the primary
text), `chip-detail` (the secondary line, only rendered when `detail` is set).

**Themeable custom properties:** `--lr-suggestion-chips-hover-bg` (default
`var(--lr-color-brand-quiet)`) — a `chip`'s background on hover. `--lr-suggestion-chips-hover-border`
(default `var(--lr-color-brand)`) — a `chip`'s border color on hover. Both are declared as `var()`
fallbacks at the point of use, not on `:host`. Plus shared tokens `--lr-space-xs/-m/-2xs`,
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
affordances. *Data mode* (non-empty `threads`, or empty `threads` with nothing slotted) renders every
row as a `lr-conversation-item` inside an internal `lr-virtual-list` — virtualized by
construction, scroll position and per-row state survive a `threads` replacement; zero rows renders
the built-in empty state. *Slotted mode* (empty `threads` *and* real slotted content) renders
host-supplied `lr-conversation-item`s from the default slot as-is: no grouping, virtualization, or
row actions in that mode. No thread CRUD or persistence — every mutation
(`lr-thread-pin`/`-archive`/`-delete`/`-rename`) is a controlled event carrying the *requested* new
state; the host mutates `threads`.

**Properties:** `threads: ChatThread[] = []` (attribute: false) — `ChatThread { id: string; title:
string; excerpt?: string; timestamp?: Date | string; pinned?: boolean; archived?: boolean }`
(exported here). `activeId: string = ''` (attribute `active-id`) — data mode:
marks the matching row `active`/`aria-current` and scrolls it into view. `searchable: boolean =
false` (reflected) — shows the built-in search field. `filter?: (thread, query) => boolean`
(attribute: false) — overrides the default case-insensitive `title` + `excerpt` substring match.
`grouping: 'date' | 'custom' | 'none' = 'date'` — data mode: bucket rows under localized date headers
(Pinned/Today/Yesterday/Previous 7 days/Previous 30 days/one bucket per month/Archived), use the
arbitrary grouping callbacks below, or render a flat list. `groupBy?: (thread: ChatThread) => string`
(attribute: false) derives each group id in `grouping="custom"`; omitting it leaves the custom mode
flat. `formatGroup?: (id: string, threads: ChatThread[]) => string | TemplateResult` (attribute:
false) renders non-interactive custom group-label content. `groupOrder?: string[] | ((a: string, b:
string) => number)` (attribute: false) supplies an explicit order or comparator; ids omitted from an
array follow in first-seen order. `collapsedGroupIds: string[] = []` (attribute: false) is the
controlled collapsed state for both date and custom groups. A collapsed group's header remains in
the virtual list while its conversation rows are removed from the virtual-list item/measurement
set; `lr-group-toggle` requests the matching state change. `rowActions: ThreadRowAction[] = []`
(attribute: false, each `'pin' | 'archive' | 'delete'`) —
data mode only: built-in icon buttons rendered into each row's `actions` slot. `showArchived: boolean
= false` (attribute `show-archived`, reflected) — data mode: include `archived` threads (in their own
trailing group). `editable: boolean = true` (reflected) — forwarded to each data-mode row's inline
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
defaults to the localized `threadListLabel`. `wrapRow?: (thread: ChatThread, row: TemplateResult) =>
TemplateResult` (attribute: false) — data mode only: wraps each row's built-in
`lr-conversation-item` with host-supplied content that has no home in the item's own `title`/`excerpt`/`meta`/`actions` surface (e.g. a leading purpose
icon — the item has no default slot to receive one); unset renders the built-in row unwrapped.
`renderActions?: (thread: ChatThread) => TemplateResult` (attribute: false) — data mode only:
appends host-supplied content (re-invoked per row on every render, e.g. a `lr-menu` with custom
actions) after the built-in `rowActions` output in each row's `actions` slot; events it fires reach
the host normally and never trigger `lr-select`. Unset renders only the built-in `rowActions`.
`renderLeading?: (thread: ChatThread) => TemplateResult` (attribute: false) — renders non-interactive
leading content in each virtualized row. `renderExcerpt?: (thread: ChatThread) => TemplateResult`
(attribute: false) — renders rich content into the row item's own `excerpt` slot, winning over the
plain-string `excerpt` property (e.g. a server-highlighted search-match snippet), while leaving the
built-in title layout and inline-rename affordance untouched. `renderMeta?: (thread: ChatThread) =>
TemplateResult` (attribute: false) — appends structured metadata in the row's meta region.
`renderRowContent?: (thread: ChatThread) => TemplateResult` (attribute: false) — replaces the
conversation item's title/excerpt/meta content area with custom non-interactive row content.
`formatGroupLabel?: (key: ThreadBucketKey, date?: Date) => string` (attribute: false) — overrides
built-in date-group labels (use `formatGroup` for custom groups). `formatDate?: (date: Date) =>
string` (attribute: false) — overrides month-group date formatting. `wrapRow` remains wholly
host-owned and therefore receives no library-added wrapper part; use the focused `row-*` hook parts
or add the host's own styling hook inside that callback.

**Slots:** default — slotted mode only: host-supplied `lr-conversation-item`s, rendered in order.
`empty` — replaces the built-in empty state.

**Events:** (data mode; slotted mode only ever fires `lr-filter-change`) `lr-select` (`detail: {
id }`), `lr-thread-pin` (`detail: { id, pinned }` — the requested new state), `lr-thread-archive`
(`detail: { id, archived }`), `lr-thread-delete` (`detail: { id }`, no built-in confirmation),
`lr-thread-rename` (`detail: { id, title }`, re-emitted from the row's `lr-rename`),
`lr-filter-change` (`detail: { text, matchCount }`), `lr-group-toggle` (`detail: { id, collapsed }` —
controlled intent; native group buttons provide Enter/Space activation and explicit
`aria-expanded="true"|"false"`). `searchable` only: `blur`/`focus` (no detail) — re-dispatched from
the internal search `<input>`'s own `blur`/`focus`, bubbling and composed unlike the native events,
which are neither.

**CSS parts:** `base`, `search`/`search-input` (the search field wrapper and `<input
type="search">`), `list` (the list region), `empty`, `viewport` (the actual internal virtual-list
scroll container, suitable for scrollbar styling), `row-action` (a built-in pin/archive/delete icon
button), `pin-glyph` (the small pin indicator on a pinned row), `group-header`, `group-toggle`,
`group-label`, `group-icon`, `group-sticky` (`sticky-groups` only: the pinned copy of the current
group's header, exported from the internal `lr-virtual-list`'s sticky layer — it wraps a full copy of
the `group-header`/`group-toggle`/`group-label`/`group-icon` markup, so those parts style the real
header row and the pinned copy alike, and the band itself is where a shadow or bottom border
belongs), `row` (all exported across the internal `lr-virtual-list` shadow
boundary), `row-wrapper` (the wrapper around `wrapRow` output, only present when `wrapRow` is set;
row-only — group headers are never passed through `wrapRow`, so they never carry it), and
`row-leading`/`row-excerpt`/`row-content`/`row-meta`/`row-actions` (the library-owned wrappers around
their corresponding render-hook output; inherited fonts, layout values, and theme custom properties
reach callback-rendered descendants through these parts). `row-excerpt` wraps `renderExcerpt`
output, which is slotted into the row item's own `excerpt` slot.

Data mode additionally forwards each row `<lr-conversation-item>`'s own parts under a `row-item-`
prefix: `row-item-base`, `row-item-active-indicator`, `row-item-option`, `row-item-leading`, `row-item-content`,
`row-item-title`, `row-item-title-input`, `row-item-rename-button`, `row-item-excerpt`,
`row-item-meta`, `row-item-timestamp`, `row-item-actions`.

**Keep the two prefixes straight — they are different surfaces.** The `row-*` parts wrap *this*
component's own render-callback output (`wrapRow`, `renderLeading`, `renderExcerpt`,
`renderRowContent`, `renderMeta`, `renderActions`); the `row-item-*` parts are the row item's
*internals*. Row density
in particular lives in `row-item-base`'s padding and `row-item-title`'s font size, so
`::part(row-item-base)` is the supported way to build a dense sidebar.

For plain row density, prefer the `compact` property above — it forwards straight to the row item's
own density knob. The `row-item-*` parts remain the lever for tuning beyond it (a different font
size, a different padding ratio):

```css
lr-thread-list::part(row-item-base) { padding-block: 0.25rem; }
lr-thread-list::part(row-item-title) { font-size: 0.8125rem; }
```

Do **not** reach for `::part(row) { --lr-theme-space-s: … }` instead. That is a whole-subtree
retheme: it shrinks everything nested inside the row, including the items of a `renderActions` menu,
which pushes their touch targets below the accessible minimum. The `row-item-*` parts exist so row
density can be tuned without that blast radius.

**Sizing:** the internal list fills whatever height this component is given, with no consumer CSS —
`[part='viewport']` is the real scroll container, and it falls back to `lr-virtual-list`'s own `24rem`
default only when the container has no resolvable height. This is deliberately *not* implemented by
setting `--lr-virtual-list-height: 100%`: that percentage resolves against this host, which is a flex
item, so in an auto-height container it chains to `auto` and the viewport either collapses to zero
(with no rows) or grows to the full un-virtualized content height (with rows) — defeating
virtualization in both directions. Instead the list host is made a column flex container, which turns
the shipped `24rem` into a *flex-basis*: it grows to fill a bounded pane, shrinks below `24rem` in a
short one, and falls back to exactly `24rem` in an auto-height container.

`sticky-groups` keeps the current date group's header visible while scrolling through a long sidebar;
style the pinned band with `lr-thread-list::part(group-sticky)`.

```html
<lr-thread-list
  searchable
  sticky-groups
  .threads=${threads}
  active-id=${activeThreadId}
  .rowActions=${['pin', 'archive', 'delete']}
  @lr-select=${(e) => openThread(e.detail.id)}
></lr-thread-list>
```

Composed with `lr-split` (or `lr-app-rail` + `lr-responsive-panel`): thread-list in the start
pane driving `activeId`, `lr-chat-viewport` + `lr-chat-composer` in the main pane.

## `lr-checkpoint`

An inline conversation restore point: a labeled marker between messages whose Restore affordance
confirms inline, then hands the host a `lr-restore` event. This component persists and restores
nothing itself — host state in, events out. Not a handoff or plain rule
(`lr-handoff-divider`/`lr-divider`); not branch navigation across regenerated variants
(`lr-branch-picker`); not recorded-run playback (`lr-playback`).

**Properties:** `checkpointId: string = ''` (attribute `checkpoint-id`) — opaque id echoed in the
`lr-restore` event detail. `label: string = ''` — checkpoint name; the localized `checkpointLabel`
fallback renders while empty. `timestamp?: Date | string` (attribute: false) — optional creation
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

**CSS parts:** `base` (`role="group"`), `line` (each of the two flanking rules), `icon` (bookmark
glyph), `label`, `timestamp`, `restore-button` (only while `restorable`), `confirm-group`,
`confirm-prompt`, `confirm-button`, `cancel-button`.

**Themeable custom properties:** `--lr-checkpoint-spin-duration` (default `1s`) — duration of one
restoring-spinner rotation; stopped under reduced motion.

```html
<lr-checkpoint checkpoint-id="ck_18" label="Before refactor" .timestamp=${t}
  @lr-restore=${(e) => restoreTo(e.detail.checkpointId)}></lr-checkpoint>
```

## `lr-usage-badge`

Compact, static resource strip for one message or run — tokens in/out, cost, latency — with a
hover/focus tooltip breakdown. Purely formatting: computes no counts, rates, or prices; every segment
is independently optional, and with nothing set, nothing renders at all (not even a focusable shell).
The tooltip reuses `lr-tool-call-chip`'s hover/focus/Escape/`aria-describedby` contract wholesale.
Not `lr-context-meter` (occupancy of a fixed capacity); not `lr-generation-status` (live, with a
Stop button) — this is static after the fact.

**Properties:** `tokensIn?: number` (attribute `tokens-in`) — input tokens, normalized to a
non-negative integer, locale-formatted; segment omitted while unset/non-finite. `tokensOut?: number`
(attribute `tokens-out`) — same rules. `costText: string = ''` (attribute `cost-text`) —
pre-formatted cost (e.g. `"$0.012"`), rendered verbatim. `latencyMs?: number` (attribute
`latency-ms`) — formatted with the shared duration algorithm (`820 -> "820ms"`, `1500 -> "1.5s"`), or
`formatLatency` when set. `formatLatency?: (ms: number) => string` — overrides the built-in duration
algorithm (which has no minutes/hours tier) in both the visible strip and the tooltip row; mirrors
`lr-activity-feed`'s `formatTimestamp` convention. `compact: boolean = false` — token counts render
via `Intl.NumberFormat` `notation: 'compact'`; the tooltip always shows full grouped figures.

**Slots:** default — extra rows appended below the built-in tooltip breakdown (e.g. cache-read
tokens); the visible strip itself is prop-driven only.

**CSS parts:** `base` (a focusable non-button `role="group"`, only rendered while at least one
segment or the default slot has content), `tokens-in`, `tokens-out`, `cost`, `latency`, `tooltip`.

```html
<lr-chat-message role="assistant" status="sent">
  <lr-usage-badge slot="badges" tokens-in="1204" tokens-out="386"
    cost-text="$0.012" latency-ms="2350"></lr-usage-badge>
  <lr-markdown .content=${answer}></lr-markdown>
</lr-chat-message>
```

## `lr-widget-renderer`

Renders an agent-streamed declarative JSON widget tree through an allowlisted `type -> lyra tag`
registry: safe generative UI with exactly one action event out. A mapped node's real element is
created via `document.createElement()` with every prop assigned as a plain JS property (never
`setAttribute`, never `innerHTML`), and reused by key across a re-resolve so a mapped widget's own
internal state (an open `<details>`, focus, scroll position) survives a streamed `tree` update.
Built-in `row`/`col`/`text` structural nodes render through ordinary nested templates instead. Not a
form runtime (no input/select/form types in the default registry), no expression language or
data-binding, no remote widget/schema fetching, and it never renders arbitrary HTML or navigates (no
`href` props are allowlisted anywhere).

**Exported types:** `WidgetNode { type: string; id?: string; props?: Record<string, unknown>;
children?: (WidgetNode | string)[]; slot?: string; actionId?: string; payload?: unknown }` — `id` is
a stable reconciliation key (falling back to a structural path), `slot` is honored only when the
parent type allowlists it, `actionId` arms the type's declared action trigger, and `payload` is
echoed back in `lr-widget-action`.

**Properties:** `tree: WidgetNode | null = null` (property only) — the declarative widget tree to
render; `null` renders an empty base. `registry?: WidgetTypeRegistry` (attribute: false) — a
per-instance override of the module-level default registry.

**Registry module (`widget-renderer/registry.js`):** `registerWidgetType(type, def)` registers (or
overwrites) a type in the default registry; `def: WidgetTypeDefinition { tag?: string; props?:
Record<string, 'string' | 'number' | 'boolean'>; forcedProps?: Record<string, unknown>; slots?:
string[]; action?: { event: string } }` — `tag` is resolved prefix-aware, `props` is a prop allowlist
(a prop absent here, or whose runtime type doesn't match, is silently skipped — never assigned),
`forcedProps` always apply and are never overridable by `WidgetNode.props`, `slots` allowlists child
`slot` names (a disallowed one renders unslotted rather than being dropped), and `action.event` is
the native/custom DOM event that arms `lr-widget-action` when a node also sets `actionId`.
`getDefaultWidgetTypeRegistry()` returns the module-level registry `registerWidgetType()` writes to.

**Default registry** (populated by the side-effect entry's `registerDefaultWidgetTypes()`): `text`
(plain text node), `row`/`col` (internal flex wrappers; props `gap: 's'|'m'|'l'`, `align:
'start'|'center'|'end'|'stretch'`, `justify: 'start'|'center'|'end'|'between'`), `card` →
`lr-card` (`appearance`), `badge` → `lr-badge` (`variant`), `button` → `lr-button` (`variant`,
`appearance`, `size`, `disabled`, `loading`; action: `click`), `stat` → `lr-stat` (`label`,
`value`, `unit`, `variant`, `caption`, `sub`), `result-card` → `lr-result-card` (`title`),
`result-field` → `lr-result-field` (`label`, `value`), `markdown` → `lr-markdown` (`content`;
forced `{ sanitize: true }`), `image` → `lr-media-card` (`src`, `alt`, `filename`; forced `{ kind:
'image' }`).

**Events:** `lr-widget-action` — `detail: { actionId, payload }`, the single bubbling action
channel. `lr-render-error` — `detail: { error }`, the root value was structurally unusable
(non-object, or the depth/size caps made it empty). `lr-widget-state-change` — `detail: { path,
value, nodeId, prop }`, emitted when a state-bound mapped control requests a controlled update.

**CSS parts:** `base` (the root wrapper, `display: contents`), `row`, `col`, `text` (built-in
structural nodes only — a mapped lyra component exposes its own parts instead).

Caps: depth 32, 5,000 nodes — excess is skipped with a deduped `console.warn` per type/prop per
instance. Reconciliation is keyed by `id ?? structural path`, so a streamed re-send patches in
place and user state (an open `<details>`, focus, scroll) survives.

```ts
registerWidgetType('sparkline', { tag: tag('sparkline'), props: { data: 'string' } });
```
```html
<lr-widget-renderer .tree=${msg.widget}
  @lr-widget-action=${(e) => sendToAgent(e.detail.actionId, e.detail.payload)}
></lr-widget-renderer>
```

**Optional peer deps:** none new — the default-registry entry directly imports the eight mapped
components (`markdown` keeps its own `marked`/`dompurify` optional-peer fallback). A host wanting a
leaner dependency graph registers a custom registry (via the `registry` property) and imports only
the components it maps.

## `lr-voice-picker`

A TTS voice selector over a host-supplied `catalog`, mirroring `lr-model-select`'s
closed-dropdown/free-text-combobox dual mode, stale-value handling, and form-association verbatim
(see that section for the full mode-switching contract this one shares), extended with a
TTS-agnostic preview affordance. Preview is event-first: `lr-preview-request` always fires first
and is cancelable — left un-prevented, a `previewUrl` plays through one internal native `<audio>`
(validated by `safeMediaSrc()` first); `preventDefault()` or no URL leaves playback to the host's own
TTS. Requesting the same voice while it's already playing internally stops it instead of
re-requesting; requesting a different voice switches. Does not synthesize speech, fetch catalogs, or
persist selection; not a persona picker; `lr-model-select` stays for LLMs.

**Exported types:** `LyraVoiceCatalogEntry { id: string; label: string; language?: string;
description?: string; previewUrl?: string }` — `language`/`description` render as a quiet
`[part="option-meta"]` second line. `LyraVoiceCatalog = string[] | LyraVoiceCatalogEntry[]` —
homogeneous, same union contract as `LyraModelCatalog`.

**Properties:** `provider: string = ''` — informational only (e.g. `'elevenlabs'`); rendered as a
small leading badge. `catalog?: LyraVoiceCatalog` (attribute: false) — the full voice list; omit (or
leave empty) to fall back to plain free-text entry. `allowCustom: boolean = false` (attribute
`allow-custom`, reflected) — let the user type/commit a value that isn't in `catalog`. `preview:
boolean = true` (reflected) — whether to render preview affordances at all. `label: string = ''`,
`hint: string = ''`, `errorText: string = ''` (attribute `error-text`), `placeholder: string = ''`,
`spellcheck: boolean = true` (string-aware converter, same as `lr-model-select`), `autocapitalize:
string = ''`, `autoCorrect: string = ''` (attribute `autocorrect`), `autocomplete: string = 'off'`,
`inputMode: string = ''` (attribute `inputmode`), `enterKeyHint: string = ''` (attribute
`enterkeyhint`), and `open: boolean = false` (reflected) — all mirror `lr-model-select`'s
identically-named properties.

**Form association:** hand-rolled via `attachInternals()`, mirroring `lr-model-select`: `value`
getter/setter (the current voice id, `''` when nothing is selected), `name` (reflected), `disabled`
(reflected), `required` (reflected — enforced via `internals.setValidity()`).

**Methods:** `click()` (override) — same forwarding contract as `lr-model-select`'s own `click()`
override (see that section for the full rationale): closed-dropdown mode forwards a real `.click()`
to the trigger `<button>`, whose own `@click` handler opens it; free-text mode instead calls
`.focus()` on the combobox `<input>`, since a synthetic `.click()` on a text input never dispatches
`focus` the way a real click's `mousedown` default action does, and this mode's open behavior is
wired to the input's native `focus` event, not a `click` handler on the input itself. Mirrors
`<lr-button>`'s identical host `click()` forwarding.

**Events:** `lr-change` — `detail: { value, inCatalog }`. `lr-preview-request` — `detail: {
voiceId, previewUrl? }`, cancelable. `lr-preview-change` — `detail: { voiceId }`, internal playback
started (`voiceId`) or stopped (`null`). Plus mirrored native `input`/`change` and re-dispatched
`focus`/`blur` (picker-family contract, same as `lr-model-select`).

**Slots:** `hint`, `error`.

**CSS parts:** `form-control-label`, `trigger` (closed-dropdown mode), `combobox`/`combobox-input`
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
- `catalog` must be homogeneous — the same constraint `lr-model-select`'s `LyraModelCatalog` union
  documents.

**Additional API surface:**

- `--lr-voice-picker-preview-active-border` — Active preview border. Default: `var(--lr-color-brand)`.
- `--lr-voice-picker-preview-active-color` — Active preview icon. Default: `var(--lr-color-brand)`.
- `--lr-voice-picker-option-active-bg` — Active option fill. Default: `var(--lr-color-brand-quiet)`.
- `--lr-voice-picker-option-selected-border` — Selected option border. Default: `var(--lr-color-brand)`.
- `--lr-voice-picker-option-selected-color` — Selected option text. Default: `var(--lr-color-brand)`.
- `--lr-voice-picker-option-selected-bg` — Selected option fill. Default: `transparent`.
- `--lr-voice-picker-option-selected-font-weight` — Selected option label weight. Default: `var(--lr-font-weight-semibold)`.
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
  timestamp?: Date | string; text?: string; attachments?: DocumentRef[] }`. Each entry renders as an
  `lr-chat-message` whose `role`/`status`/`timestamp` come straight across, with `text` rendered as
  sanitized Markdown through `lr-markdown`. Replace the whole region with the `messages` slot for
  richer bodies. Host owns ordering, updates, and persistence
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
  false` (attribute `retrieval-has-more`), `retrievalError: string = ''` (attribute
  `retrieval-error`, caller-supplied text) — all forwarded to `lr-retrieval-results`
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
  composer renders when no `composer` slot is supplied
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
  (`detail: undefined`) — forwarded from the built-in composer.
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
- `lr-cancel` (`detail: undefined`) / `lr-retry` (`detail: RetryEventDetail` = `{ attempt: number;
  messageId?: string }`, from `@aceshooting/lyra-ui/ai`) — forwarded from the built-in agent run.

**Slots:** `messages` (replaces the data-driven transcript message list), `details` (replaces the
built-in run/tool/retrieval/grounding/context details pane while keeping the responsive shell),
`composer` (replaces the built-in `lr-chat-composer`), `header-actions` (model selection, settings,
export controls).

**CSS parts:** `base`, `header`, `heading`, `header-actions`, `body`, `conversation`, `viewport` (the
composed `lr-chat-viewport`), `messages`, `messages-empty`, `details`, `details-content`, `section`
(one run/tools/retrieval/grounding/context section), `section-heading`, `composer`, `composer-input`
(the composed `lr-chat-composer`).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none of its own; the composed `lr-markdown` keeps its `marked`/`dompurify`
optional-peer fallback.

## `lr-message-parts`

Ordered renderer for provider-neutral `MessagePart[]`: text, reasoning, tool call/result, citation,
attachment, data/widget, audio, and error parts can interleave without flattening stream order.

**Properties:** `parts: MessagePart[]`; `renderMarkdown: boolean = true`; `showReasoning: boolean =
true`; `renderPart?: (part, index) => unknown`; `label`; `accessibleLabel` (attribute
`aria-label`).

**Events:** `lr-citation-select` (`{ citation }`), `lr-part-retry` (`{ part }`).

**CSS parts:** `base`, `part`, `part-streaming`, `text`, `reasoning`, `tool-call`, `tool-result`,
`citation`, `attachment`, `data`, `audio`, `audio-transcript`, `error`, `retry`.

```ts
import '@aceshooting/lyra-ui/components/conversation/message-parts/message-parts.js';
```

**Additional API surface:**

- `lr-anchor-result` event — Passthrough from rendered Markdown.
- `lr-citation-open` event — Passthrough from a rendered citation's full-preview action.
- `lr-copy` event — Passthrough from rendered JSON content.
- `lr-highlight-activate` event — Passthrough from rendered Markdown.
- `lr-link-click` event — Passthrough from rendered Markdown.
- `lr-preview` event — Passthrough from a rendered attachment.
- `lr-remove` event — Passthrough from a rendered attachment.
- `lr-render-error` event — Passthrough from rendered Markdown, tool-result, or widget content.
- `lr-retry` event — Passthrough from a rendered attachment.
- `lr-search-change` event — Passthrough from rendered JSON content.
- `lr-text-select` event — Passthrough from rendered Markdown.
- `lr-toggle` event — Passthrough from a rendered reasoning panel.
- `lr-tool-call-chip-select` event — Passthrough from a rendered tool-call chip.
- `lr-tool-chip-select` event — Deprecated tool-call selection alias passthrough.
- `lr-widget-action` event — Passthrough from a rendered declarative widget.
- `lr-widget-state-change` event — Passthrough from a rendered controlled widget.

## `lr-prompt-input`

The composed prompt surface: chat composer, attachment controls/chips, model and voice pickers,
retrieval-source scope, mention/slash-command popup, and queued follow-up prompts. It performs no
upload, retrieval, or model call.

**Properties:** `value`, `status`, `placeholder`, `disabled`, `submitOnEnter`, `attachments`,
`attachmentCapabilities`, `mentionItems`, `commandItems`, `modelCatalog`, `model`, `voiceCatalog`,
`voice`, `sources`, `selectedSourceIds`, `queue`, `label`, `accessibleLabel` (attribute
`aria-label`).

**Methods:** `focus(options)`, `blur()`, and `click()` forward to the composed chat input;
`select()` and its selection APIs forward to the same native text surface.

**Events:** `lr-input`, `lr-submit`, `lr-stop`, `lr-mention-select`, `lr-attachments-add`,
`lr-attachment-remove`, `lr-model-change`, `lr-voice-change`.

**Slots:** `controls`, `leading`, `chips`, `trailing`, `footer`.

**CSS parts:** `base`, `controls`, `sources`, `sources-summary`, `source-picker`, `queue`,
`composer`, `leading`, `chips`, `footer`.

```ts
import '@aceshooting/lyra-ui/components/conversation/prompt-input/prompt-input.js';
```

## `lr-prompt-queue`

Controlled editable queue of follow-up turns. Reordering, editing, and removal emit a complete
proposed queue; send-now emits the complete selected item.

**Properties:** `items: PromptQueueItem[]`; `editable: boolean = true`; `disabled`; `label`;
`accessibleLabel` (attribute `aria-label`).

**Events:** `lr-queue-change` (`{ items, reason, itemId }`), `lr-send-now` (`{ item }`).

**CSS parts:** `base`, `heading`, `list`, `item`, `value`, `editor`, `actions`, `action`, `empty`.

```ts
import '@aceshooting/lyra-ui/components/conversation/prompt-queue/prompt-queue.js';
```

## `lr-selection-toolbar`

Nonmodal, Escape-dismissible text-selection toolbar carrying selected text plus a format-neutral
`DocumentLocator` into ask, quote, cite, and copy actions.

**Properties:** `open`, `text`, `anchor`, `rect`, `actions`, `label`, `accessibleLabel` (attribute
`aria-label`).

**Events:** `lr-selection-action` (`{ action, text, anchor }`), `lr-dismiss`, `lr-copy-error`.

**CSS parts:** `toolbar`, `action`, `action-ask`, `action-quote`, `action-cite`, `action-copy`.

**Themeable custom properties:** `--lr-selection-toolbar-inline-start` and
`--lr-selection-toolbar-block-start` are normally computed from `rect`; hosts may override them to
provide their own fixed-position anchor.

```ts
import '@aceshooting/lyra-ui/components/conversation/selection-toolbar/selection-toolbar.js';
```

**Additional API surface:**

- `--lr-selection-toolbar-inline-shift` — Computed inline collision-avoidance offset.
- `--lr-selection-toolbar-block-shift` — Computed block collision-avoidance offset.

## `lr-realtime-session`

Provider-neutral realtime voice shell composing connection state, `lr-audio-visualizer`,
`lr-push-to-talk`, and `lr-transcript-feed`. Transport/authentication/playback remain host-owned.

**Properties:** `state`, `voiceState`, `level`, `stream`, `entries`, `muted`, `showCapture`,
`errorCode`, `label`.

**Events:** `lr-connect`, `lr-disconnect`, `lr-mute-change` (`{ muted }`), `lr-interrupt`; the
composed push-to-talk events continue bubbling.

**Slots:** `controls` adds provider-specific actions beside the built-in session controls.

**CSS parts:** `base`, `header`, `status`, `activity`, `controls`, `connect`, `disconnect`, `mute`,
`interrupt`, `capture`, `transcript`, `error`.

```ts
import '@aceshooting/lyra-ui/components/conversation/realtime-session/realtime-session.js';
```
