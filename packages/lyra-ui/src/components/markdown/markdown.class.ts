import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../internal/lyra-element.js';
import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';
import { loadMarkdownDeps, getMarkdownDepsIfLoaded, type MarkdownDeps } from './markdown-loader.js';
import { styles } from './markdown.styles.js';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/**
 * Mirrors marked's own default `link()` renderer's `cleanUrl()`: a malformed
 * percent-escape or lone UTF-16 surrogate in the raw href throws inside
 * `encodeURI`, and marked's default renderer responds by dropping the anchor
 * (rendering the link text alone) rather than emitting a broken `href` —
 * returning `null` here lets the caller do the same. The
 * `.replace(/%25/g, '%')` compensates for `encodeURI` re-escaping the `%` of
 * an href that was already percent-encoded (the common case for a real
 * markdown link) — without it, every existing `%XX` escape would become
 * `%25XX`, double-encoding it.
 */
function cleanHref(href: string): string | null {
  try {
    return encodeURI(href).replace(/%25/g, '%');
  } catch {
    return null;
  }
}

export interface LyraMarkdownEventMap {
  'lyra-render-error': CustomEvent<{ error: unknown }>;
  'lyra-link-click': CustomEvent<{ href: string; internal: boolean }>;
}
/**
 * `<lyra-markdown>` — sanitized Markdown-to-HTML rendering (GFM tables,
 * fenced code blocks, links, blockquotes) built on the optional peer
 * dependencies `marked` (parsing) and `dompurify` (sanitizing), both
 * lazy-loaded via `markdown-loader.ts` on first connect.
 *
 * Rendering never ships unsanitized or broken markup silently:
 * - If `marked` fails to load, or throws while parsing malformed input, the
 *   component falls back to plain text (`white-space: pre-wrap`, no HTML
 *   parsing at all) and fires `lyra-render-error`.
 * - If `sanitize` is `true` (the default) and `dompurify` fails to load, the
 *   component *also* falls back to plain text + `lyra-render-error` — it
 *   never renders marked's raw HTML output when sanitization was requested
 *   (or defaulted to) but is unavailable, even though `marked` itself loaded
 *   fine.
 * - If `sanitize` is explicitly `false`, marked's raw output renders as-is
 *   regardless of whether `dompurify` is installed — the consumer opted out
 *   of sanitization, so `dompurify`'s absence is irrelevant to that path.
 *
 * That same plain-text fallback rendering (`data-fallback` on the `content`
 * part) is also, unconditionally and by default, a brief *transient* state on
 * every connect, not just a failure path: `connectedCallback()`'s dynamic
 * `import()` of `marked`/`dompurify` (see `markdown-loader.ts`) is
 * asynchronous, so the very first paint of any `<lyra-markdown>` on a page
 * shows plain text for at least one microtask — even when both peers are
 * already installed and load without error — until that import resolves and
 * a second render replaces it with the real Markdown output. Set
 * `eager-load` to skip that window once the shared dependency cache is
 * already warm; see that property's doc for exactly what "warm" requires.
 *
 * `heading`/`code`/`blockquote`/`table`/`link`/`image` tokens are rendered
 * through a `marked` renderer override that injects `part="..."` attributes
 * directly into the produced HTML — a single pass, not a second DOM walk
 * after insertion.
 *
 * @customElement lyra-markdown
 * @event lyra-link-click - Fired (and the click prevented) when a rendered
 *   link's `href` starts with `internal-link-prefix`. `detail: { href:
 *   string, internal: true }`. Ordinary external links navigate normally
 *   (in `link-target`) and never fire this event.
 * @event lyra-render-error - Fired whenever rendering falls back to plain
 *   text. `detail: { error: unknown }`.
 * @csspart content - The wrapper around the rendered (or plain-text
 *   fallback) output.
 * @csspart heading - Every rendered `<h1>`–`<h6>` (shifted by
 *   `heading-offset`).
 * @csspart paragraph - Every rendered `<p>`.
 * @csspart list - Every rendered `<ul>`/`<ol>`.
 * @csspart code-block - Every rendered fenced/indented `<pre>`.
 * @csspart inline-code - Every rendered inline `<code>` span (backtick spans, not fenced blocks).
 * @csspart link - Every rendered `<a>`.
 * @csspart table - Every rendered `<table>`.
 * @csspart blockquote - Every rendered `<blockquote>`.
 * @csspart img - Every rendered `<img>`.
 */
export class LyraMarkdown extends LyraElement<LyraMarkdownEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The Markdown source to render. */
  @property() content = '';

  /** Sanitize marked's HTML output with DOMPurify before rendering. See the
   *  class doc for what happens when this is `true` (the default) but the
   *  `dompurify` peer isn't installed. */
  @property({ type: Boolean }) sanitize = true;

  /** When `true`, overrides marked's `html` renderer hook to emit the HTML-escaped source text
   *  instead of passing raw/sanitized markup through -- for a consumer rendering arbitrary
   *  already-written content (e.g. a historical chat/agent transcript full of code/XML/HTML
   *  snippets) where a stray angle bracket should render as visible text, not a real DOM element.
   *  Still lets GFM tables/lists/etc. render normally -- only raw embedded HTML is affected.
   *  `false` (the default) reproduces today's exact `marked`-default (sanitized-when-`sanitize`)
   *  passthrough behavior. */
  @property({ type: Boolean, attribute: 'escape-html' }) escapeHtml = false;

  /** Enable GitHub-flavored Markdown (tables, strikethrough, autolinks, task lists). */
  @property({ type: Boolean }) gfm = true;

  /** `target` applied to every rendered `<a>`, with `rel="noopener
   *  noreferrer"` always added alongside it whenever a `target` is emitted.
   *  `'_blank'` (the default) preserves today's exact output. Set to `null`
   *  (or the empty string, e.g. via the `link-target=""` attribute) to omit
   *  `target`/`rel` entirely, so rendered links open in the same tab. */
  @property({ attribute: 'link-target' }) linkTarget: string | null = '_blank';

  /** When set, a rendered link whose `href` starts with this prefix is
   *  treated as internal — its click is intercepted and reported via
   *  `lyra-link-click` instead of navigating. Empty (the default) means
   *  every link is treated as external. */
  @property({ attribute: 'internal-link-prefix' }) internalLinkPrefix = '';

  /** Added to every rendered heading's source `token.depth` before emitting
   *  `<h${depth}>` — e.g. `heading-offset="2"` renders a source `#` as
   *  `<h3>` and a source `##` as `<h4>`. The result is clamped to `[1, 6]`
   *  (a source `######` with a positive offset stays at `<h6>` rather than
   *  overflowing past the HTML heading levels; the floor at `1` is
   *  defensive, since this property is meant to be additive-only). `0`
   *  (the default) preserves today's exact `<h${token.depth}>` output. */
  @property({ type: Number, attribute: 'heading-offset' }) headingOffset = 0;

  /** When `true`, `connectedCallback()` skips awaiting `loadMarkdownDeps()`'s
   *  dynamic `import()` if the shared `marked`/`dompurify` module cache (see
   *  `markdown-loader.ts`'s `getMarkdownDepsIfLoaded()`) has *already*
   *  resolved — e.g. because an earlier `<lyra-markdown>` instance on the
   *  page already finished loading, or the consumer primed the cache
   *  directly by calling `loadMarkdownDeps()` themselves at startup — and
   *  renders synchronously instead. When the cache isn't warm yet (most
   *  notably: the very first `<lyra-markdown>` ever connected on a page,
   *  since nothing has called `loadMarkdownDeps()` before it), this still
   *  falls back to the normal async path — a dynamic `import()` can't be
   *  made synchronous, so this is a fast path for the common "already warm"
   *  case, not a hard guarantee. `false` (the default) is byte-identical to
   *  today: always the async `import()`, fallback-text window included. */
  @property({ type: Boolean, attribute: 'eager-load' }) eagerLoad = false;

  /** Forward-compatible hint for a dedicated streaming renderer expected to
   *  build on this component later (coalescing partial tokens as they
   *  arrive) — setting it has no rendering effect yet. Reflects so a
   *  consumer can already target `lyra-markdown[streaming]` in CSS ahead of
   *  that behavior landing. */
  @property({ type: Boolean, reflect: true }) streaming = false;

  // `null` covers both "the optional peers are still loading" and "a render
  // attempt just fell back after a failure" — the two states intentionally
  // look identical (plain text, see render()) since a consumer distinguishes
  // them via `lyra-render-error`, not a visual difference.
  @state() private renderedHtml: string | null = null;

  private deps?: MarkdownDeps;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.eagerLoad) {
      // Only takes this synchronous path when the shared module cache has
      // *already* settled (see getMarkdownDepsIfLoaded()'s doc) -- otherwise
      // falls through to the same async path as the default below, since a
      // dynamic import() can't be made synchronous from scratch.
      const alreadyLoaded = getMarkdownDepsIfLoaded();
      if (alreadyLoaded) {
        this.deps = alreadyLoaded;
        this.renderMarkdown();
        return;
      }
    }
    void loadMarkdownDeps().then((resolved) => {
      // The (module-cached, page-lifetime) loadMarkdownDeps() promise can
      // resolve after this instance was removed from the DOM -- e.g. an
      // <lyra-markdown> inside a conditionally-rendered chat message or a
      // virtualized list. Without this guard, a detached instance would
      // still have its `deps` set and renderMarkdown() called, mutating the
      // @state() renderedHtml property and scheduling a Lit update no one
      // will ever see. Mirrors chart.ts's own connectedCallback() guard for
      // the identical race.
      if (!this.isConnected) return;
      this.deps = resolved;
      this.renderMarkdown();
    });
  }

  // Runs before render (not updated()) so mutating the `renderedHtml` state
  // property below is absorbed into the *same* update cycle instead of
  // scheduling a second one -- Lit's documented pattern for deriving one
  // reactive property from a change to others.
  protected willUpdate(changed: PropertyValues): void {
    if (!this.deps) {
      // Still loading the optional peers — the connectedCallback promise
      // above calls renderMarkdown() itself once they resolve, using
      // whatever property values are current at that time.
      return;
    }
    if (
      changed.has('content') ||
      changed.has('sanitize') ||
      changed.has('gfm') ||
      changed.has('linkTarget') ||
      changed.has('headingOffset') ||
      changed.has('escapeHtml')
    ) {
      this.renderMarkdown();
    }
  }

  protected updated(): void {
    if (this.deps) {
      this.removeAttribute('aria-busy');
    } else {
      this.setAttribute('aria-busy', 'true');
    }
  }

  private renderMarkdown(): void {
    const deps = this.deps;
    if (!deps) return;

    if (!deps.marked) {
      // markdown-loader.ts already logged the specific import failure.
      this.applyFallback(
        new Error('<lyra-markdown> could not render: the "marked" peer dependency failed to load.'),
      );
      return;
    }

    let rawHtml: string;
    try {
      rawHtml = this.parseMarkdown(deps.marked);
    } catch (error) {
      this.applyFallback(error);
      return;
    }

    if (!this.sanitize) {
      // Consumer explicitly opted out of sanitization — dompurify's
      // presence or absence is irrelevant to this path.
      this.renderedHtml = rawHtml;
      return;
    }

    if (!deps.DOMPurify) {
      const error = new Error(
        '<lyra-markdown> could not render: sanitize is enabled (the default) but the "dompurify" peer ' +
          'dependency failed to load — refusing to render unsanitized HTML. Install it with `pnpm add ' +
          'dompurify`, or set sanitize="false" to explicitly opt out of sanitization.',
      );
      console.warn(error.message);
      this.applyFallback(error);
      return;
    }

    // `target` is not in DOMPurify's default attribute allowlist (unlike
    // `part`/`rel`/`class`, which already are) — without ADD_ATTR here,
    // every rendered link's target="..." would be silently stripped even
    // though the anchor itself survives sanitization.
    this.renderedHtml = deps.DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target'] });
  }

  private applyFallback(error: unknown): void {
    this.renderedHtml = null;
    this.emit('lyra-render-error', { error });
  }

  private parseMarkdown(marked: OptionalPeerApi): string {
    // Falsy (`null` or `''`) means the consumer explicitly opted out of
    // target="..."/rel="..." on rendered links -- see the linkTarget doc.
    // The default '_blank' is already truthy, so this preserves today's
    // exact output when the property is left unset.
    const linkTarget = this.linkTarget;
    const headingOffset = this.headingOffset;
    // Captured as a local distinct from the free function `escapeHtml` above
    // (imported/defined at the top of this file) to avoid shadowing/
    // ambiguity inside the renderer closure below, matching how
    // `linkTarget`/`headingOffset` are already captured as locals for the
    // same reason.
    const escapeHtmlOption = this.escapeHtml;
    const instance = new marked.Marked();
    // A fresh renderer per parse (rather than a shared/cached one) so it
    // always closes over the *current* `linkTarget`/`headingOffset` — these
    // properties can change between renders, and marked's `.use()` otherwise
    // persists whatever renderer it was given for the lifetime of the
    // instance.
    instance.use({
      renderer: {
        heading(this: OptionalPeerApi, token: OptionalPeerApi) {
          // Clamped to [1, 6]: a positive offset can never push a heading
          // past <h6> (there is no <h7>), and the floor at 1 is defensive
          // since headingOffset is meant to be additive-only (0 is the only
          // documented non-positive value).
          const depth = Math.min(6, Math.max(1, token.depth + headingOffset));
          return `<h${depth} part="heading">${this.parser.parseInline(token.tokens)}</h${depth}>\n`;
        },
        paragraph(this: OptionalPeerApi, token: OptionalPeerApi) {
          return `<p part="paragraph">${this.parser.parseInline(token.tokens)}</p>\n`;
        },
        list(this: OptionalPeerApi, token: OptionalPeerApi) {
          const ordered = token.ordered;
          const start = token.start;
          let body = '';
          for (const item of token.items) body += this.listitem(item);
          const tag = ordered ? 'ol' : 'ul';
          const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
          return `<${tag} part="list"${startAttr}>\n${body}</${tag}>\n`;
        },
        code(this: OptionalPeerApi, token: OptionalPeerApi) {
          const lang = (token.lang ?? '').trim().split(/\s+/)[0] ?? '';
          const body = `${token.text.replace(/\n$/, '')}\n`;
          const text = token.escaped ? body : escapeHtml(body);
          const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
          return `<pre part="code-block"><code${cls}>${text}</code></pre>\n`;
        },
        codespan(this: OptionalPeerApi, token: OptionalPeerApi) {
          // Mirrors marked's own default codespan() renderer's escaping exactly (it does not
          // pre-escape token.text itself) -- only the added part="inline-code" differs.
          return `<code part="inline-code">${escapeHtml(token.text)}</code>`;
        },
        blockquote(this: OptionalPeerApi, token: OptionalPeerApi) {
          return `<blockquote part="blockquote">\n${this.parser.parse(token.tokens)}</blockquote>\n`;
        },
        table(this: OptionalPeerApi, token: OptionalPeerApi) {
          // Built directly here (rather than delegating to the inherited
          // tablecell()) so a scope="col" can be added -- marked's own
          // default tablecell() never emits it, and without it a screen
          // reader can't reliably associate a data cell with its column
          // header beyond the simplest table.
          let headerRow = '';
          for (const cell of token.header) {
            const text = this.parser.parseInline(cell.tokens);
            const alignAttr = cell.align ? ` align="${cell.align}"` : '';
            headerRow += `<th scope="col"${alignAttr}>${text}</th>`;
          }
          let bodyRows = '';
          for (const row of token.rows) {
            let rowHtml = '';
            for (const cell of row) rowHtml += this.tablecell(cell);
            bodyRows += this.tablerow({ text: rowHtml });
          }
          const thead = `<thead>\n${this.tablerow({ text: headerRow })}</thead>\n`;
          const tbody = bodyRows ? `<tbody>${bodyRows}</tbody>\n` : '';
          return `<table part="table">\n${thead}${tbody}</table>\n`;
        },
        link(this: OptionalPeerApi, token: OptionalPeerApi) {
          const text = this.parser.parseInline(token.tokens);
          const href = cleanHref(token.href);
          if (href === null) return text;
          const titleAttr = token.title ? ` title="${escapeHtml(token.title)}"` : '';
          const targetAttr = linkTarget
            ? ` target="${escapeHtml(linkTarget)}" rel="noopener noreferrer"`
            : '';
          return `<a part="link" href="${escapeHtml(href)}"${titleAttr}${targetAttr}>${text}</a>`;
        },
        image(this: OptionalPeerApi, token: OptionalPeerApi) {
          // Mirrors marked's own default image() renderer (alt text
          // re-rendered through the plain textRenderer so nested emphasis/
          // strong/etc. inside the alt collapses to plain text, href run
          // through the same cleanHref() the link() override above uses)
          // with a part="img" added.
          const altText = this.parser.parseInline(token.tokens, this.parser.textRenderer);
          const href = cleanHref(token.href);
          if (href === null) return escapeHtml(altText);
          const titleAttr = token.title ? ` title="${escapeHtml(token.title)}"` : '';
          return `<img part="img" src="${escapeHtml(href)}" alt="${escapeHtml(altText)}"${titleAttr}>`;
        },
        html(this: OptionalPeerApi, token: OptionalPeerApi) {
          return escapeHtmlOption ? escapeHtml(token.text) : token.text;
        },
      },
    });
    return instance.parse(this.content, { gfm: this.gfm, async: false });
  }

  // A single delegated listener on the content wrapper (not one per <a>) —
  // the rendered markup is fully replaced on every content change, so a
  // per-anchor listener would need re-attaching on every render anyway.
  private onContentClick = (e: MouseEvent): void => {
    const prefix = this.internalLinkPrefix;
    if (!prefix) return;
    const anchor = e.composedPath().find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement);
    if (!anchor) return;
    // Compared against the raw `href` *attribute*, not the `.href` IDL
    // property — the property is always browser-resolved to an absolute URL
    // (e.g. "https://example.com/docs") even for a relative/prefixed path,
    // which would never match a relative `internal-link-prefix`.
    const href = anchor.getAttribute('href') ?? '';
    if (!href.startsWith(prefix)) return;
    e.preventDefault();
    this.emit('lyra-link-click', { href, internal: true });
  };

  render(): TemplateResult {
    const isFallback = this.renderedHtml === null;
    return html`
      <div part="content" ?data-fallback=${isFallback} @click=${this.onContentClick}>
        ${isFallback ? this.content : unsafeHTML(this.renderedHtml)}
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-markdown': LyraMarkdown;
  }
}
