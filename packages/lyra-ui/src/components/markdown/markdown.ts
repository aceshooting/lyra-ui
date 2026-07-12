import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type * as MarkedModule from 'marked';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { loadMarkdownDeps, type MarkdownDeps } from './markdown-loader.js';
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
 * Mirrors marked's own default `link()` renderer's defensive href guard: a
 * malformed percent-escape or lone UTF-16 surrogate in the raw href throws
 * inside `encodeURI`, and marked's default renderer responds by dropping the
 * anchor (rendering the link text alone) rather than emitting a broken
 * `href`. `encodeURI`'s *return value* is discarded on purpose, not applied —
 * calling it a second time on an already-percent-encoded URL (the common
 * case for a real markdown link) would double-encode every existing `%XX`
 * escape.
 */
function isValidHref(href: string): boolean {
  try {
    encodeURI(href);
    return true;
  } catch {
    return false;
  }
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
 * `heading`/`code`/`blockquote`/`table`/`link` tokens are rendered through a
 * `marked` renderer override that injects `part="..."` attributes directly
 * into the produced HTML — a single pass, not a second DOM walk after
 * insertion.
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
 * @csspart heading - Every rendered `<h1>`–`<h6>`.
 * @csspart code-block - Every rendered fenced/indented `<pre>`.
 * @csspart link - Every rendered `<a>`.
 * @csspart table - Every rendered `<table>`.
 * @csspart blockquote - Every rendered `<blockquote>`.
 */
export class LyraMarkdown extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The Markdown source to render. */
  @property() content = '';

  /** Sanitize marked's HTML output with DOMPurify before rendering. See the
   *  class doc for what happens when this is `true` (the default) but the
   *  `dompurify` peer isn't installed. */
  @property({ type: Boolean }) sanitize = true;

  /** Enable GitHub-flavored Markdown (tables, strikethrough, autolinks, task lists). */
  @property({ type: Boolean }) gfm = true;

  /** `target` applied to every rendered `<a>`; `rel="noopener noreferrer"` is
   *  always added alongside it regardless of this value. */
  @property({ attribute: 'link-target' }) linkTarget = '_blank';

  /** When set, a rendered link whose `href` starts with this prefix is
   *  treated as internal — its click is intercepted and reported via
   *  `lyra-link-click` instead of navigating. Empty (the default) means
   *  every link is treated as external. */
  @property({ attribute: 'internal-link-prefix' }) internalLinkPrefix = '';

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
    void loadMarkdownDeps().then((resolved) => {
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
    if (changed.has('content') || changed.has('sanitize') || changed.has('gfm') || changed.has('linkTarget')) {
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

  private parseMarkdown(marked: typeof MarkedModule): string {
    const linkTarget = this.linkTarget || '_blank';
    const instance = new marked.Marked();
    // A fresh renderer per parse (rather than a shared/cached one) so it
    // always closes over the *current* `linkTarget` — this property can
    // change between renders, and marked's `.use()` otherwise persists
    // whatever renderer it was given for the lifetime of the instance.
    instance.use({
      renderer: {
        heading(token) {
          return `<h${token.depth} part="heading">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
        },
        code(token) {
          const lang = (token.lang ?? '').trim().split(/\s+/)[0] ?? '';
          const body = `${token.text.replace(/\n$/, '')}\n`;
          const text = token.escaped ? body : escapeHtml(body);
          const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
          return `<pre part="code-block"><code${cls}>${text}</code></pre>\n`;
        },
        blockquote(token) {
          return `<blockquote part="blockquote">\n${this.parser.parse(token.tokens)}</blockquote>\n`;
        },
        table(token) {
          let headerRow = '';
          for (const cell of token.header) headerRow += this.tablecell(cell);
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
        link(token) {
          const text = this.parser.parseInline(token.tokens);
          if (!isValidHref(token.href)) return text;
          const titleAttr = token.title ? ` title="${escapeHtml(token.title)}"` : '';
          return (
            `<a part="link" href="${escapeHtml(token.href)}"${titleAttr} ` +
            `target="${escapeHtml(linkTarget)}" rel="noopener noreferrer">${text}</a>`
          );
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

defineElement('markdown', LyraMarkdown);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-markdown': LyraMarkdown;
  }
}
