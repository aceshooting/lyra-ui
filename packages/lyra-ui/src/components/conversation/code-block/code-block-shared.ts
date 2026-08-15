/**
 * Everything `<lr-code-block>` and `<lr-code-block-core>` render and compute identically:
 * localized label helpers, line addressing (`highlight-lines`/`highlights` parsing, line counting,
 * `line-range` anchor scrolling), the gutter's roving-tabindex keyboard contract, selection
 * anchoring, clipboard writes, the shiki transformer plus the `codeToHtml()` call around it, and
 * the header/body templates themselves.
 *
 * The two components differ in exactly one axis -- *which* shiki loader they reach for (the full
 * ~200-language dynamic-import table vs. `shiki/core` seeded from a pre-supplied `languages` map),
 * which is why `connectedCallback()` and `syncHighlight()` stay on each class. Everything else was
 * previously duplicated verbatim across both class files and had already drifted (the lean variant
 * had silently dropped both of its `super.willUpdate()`/`super.updated()` chain-ups); routing both
 * through this module is what keeps a fix landing in one place from here on.
 *
 * Nothing here may `import` a *value* from `code-loader.js`'s full-table half
 * (`loadShikiHighlighter`/`loadShikiLanguage`): `<lr-code-block-core>`'s build-leanness claim rests
 * on its own module graph never reaching that call, and this module is in that graph.
 */

import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { chevronIcon } from '../../../internal/icons.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { styleMap } from 'lit/directives/style-map.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import {
  boundedSelectionRects,
  boundedSelectionText,
} from '../../../internal/text-quote.js';
import {
  writeClipboardText,
  type LyraClipboardWriteFailure,
  type LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
import {
  normalizeShikiLanguage,
  SHIKI_THEMES,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
} from './shiki-types.js';
import type { ShikiTransformer } from './shiki-types.js';
import type {
  LyraAnchor,
  LyraHighlight,
  TextSelectRect,
} from '../../viewers/document-viewer/anchors.js';
import { resolveIsDarkTheme } from './shiki-dark-theme.js';

/** Matches `LyraElement.localize()`'s signature so either component's bound
 *  method can be passed straight through. */
export type LyraLocalizeFn = (
  key: string,
  fallback?: string,
  values?: Record<string, string | number>
) => string;

/** The collapse/expand header toggle button's `aria-label`. */
export function codeBlockToggleLabel(
  localize: LyraLocalizeFn,
  collapsed: boolean
): string {
  return collapsed ? localize('expandCode') : localize('collapseCode');
}

/** The copy-to-clipboard header button's `aria-label`. */
export function codeBlockCopyLabel(
  localize: LyraLocalizeFn,
  justCopied: boolean,
  copyFailed: boolean
): string {
  if (copyFailed) return localize('copyFailed');
  return justCopied ? localize('copiedToClipboard') : localize('copyCode');
}

/** The `[part="body"]` region's `aria-label`: the filename when set, else a
 *  language-aware "Code" region label. */
export function codeBlockBodyLabel(
  localize: LyraLocalizeFn,
  filename: string,
  language: string
): string {
  return (
    filename ||
    (language
      ? localize('codeRegionWithLanguage', undefined, { language })
      : localize('codeRegion'))
  );
}

/**
 * Parses a `highlight-lines` attribute value (e.g. `"3-5,7"`) into the set of one-based line
 * numbers it addresses: comma-separated segments, each either a single line number or an
 * inclusive range, whitespace around commas/dashes tolerated, a reversed range (`"5-3"`)
 * normalized to ascending order. An invalid segment is skipped (with a `console.warn`) rather
 * than throwing or discarding the otherwise-valid segments around it.
 */
export function addBoundedLineRange(
  lines: Set<number>,
  start: number,
  end: number,
  maxLine: number
): void {
  if (!Number.isFinite(start) || !Number.isFinite(end) || maxLine < 1) return;
  const low = Math.max(1, Math.min(Math.trunc(start), Math.trunc(end)));
  const high = Math.min(
    Math.trunc(maxLine),
    Math.max(Math.trunc(start), Math.trunc(end))
  );
  for (let line = low; line <= high; line++) lines.add(line);
}

/** How long the copy button's confirmation state lasts before reverting. */
export const CODE_BLOCK_COPY_CONFIRM_MS = 1500;

/** One-based line count of `code`, the upper bound every line-addressing helper below clamps to.
 *  A trailing newline still yields the (empty) line after it, matching the rendered line count. */
export function codeBlockLineCount(code: string): number {
  return code.split(/\r\n|\r|\n/).length;
}

/** Keeps the roving-tabindex gutter's focused line inside `[1, lineCount]` after a `code` change
 *  shrinks the document out from under it. */
export function clampCodeBlockFocusedLine(
  focusedLine: number,
  lineCount: number
): number {
  return Math.min(Math.max(1, focusedLine), lineCount);
}

export interface CodeBlockLineFocusHost extends HTMLElement {
  readonly renderRoot: HTMLElement | DocumentFragment;
}

/** Whether real focus currently sits on one of the rendered roving line controls. */
export function codeBlockLineHasFocus(host: CodeBlockLineFocusHost): boolean {
  return (
    host.shadowRoot?.activeElement?.matches(
      '[data-line][part~="line-button"]'
    ) ?? false
  );
}

/** Restores focus after Lit replaces a focused line node, but never overrides focus that moved
 *  to another internal or external control while the update was pending. */
export function restoreCodeBlockLineFocus(
  host: CodeBlockLineFocusHost,
  line: number
): boolean {
  const shadowActive = host.shadowRoot?.activeElement;
  if (shadowActive)
    return shadowActive.matches('[data-line][part~="line-button"]');

  const documentActive = host.ownerDocument.activeElement;
  if (
    documentActive &&
    documentActive !== host.ownerDocument.body &&
    documentActive !== host
  )
    return false;

  const target = host.renderRoot.querySelector<HTMLElement>(
    `[data-line="${line}"][part~="line-button"]`
  );
  target?.focus();
  return host.shadowRoot?.activeElement === target;
}

/** The merged set of one-based line numbers to emphasize: the `highlight-lines` spec plus the
 *  `line-range` slice of `highlights`. Shared by both the shiki transformer options and the
 *  plain-text fallback path so their emphasis is always identical. */
export function codeBlockLineHighlightSet(
  highlightLines: string,
  highlights: readonly LyraHighlight[],
  maxLine: number
): Set<number> {
  const merged = parseHighlightLines(highlightLines, maxLine);
  for (const highlight of highlights) {
    if (highlight.anchor.kind !== 'line-range') continue;
    const end = highlight.anchor.end ?? highlight.anchor.start;
    addBoundedLineRange(merged, highlight.anchor.start, end, maxLine);
  }
  return merged;
}

/** The line numbers covered by the `highlights` entry matching `activeHighlightId`, if any. */
export function codeBlockActiveHighlightLineSet(
  highlights: readonly LyraHighlight[],
  activeHighlightId: string | null,
  maxLine: number
): Set<number> {
  const active = highlights.find((h) => h.id === activeHighlightId);
  const result = new Set<number>();
  if (!active || active.anchor.kind !== 'line-range') return result;
  const end = active.anchor.end ?? active.anchor.start;
  addBoundedLineRange(result, active.anchor.start, end, maxLine);
  return result;
}

/** The `languages` entry for the *current* `language`, if any -- looked up under both the
 *  shiki-normalized id and the raw property value, so `willUpdate()`/`updated()`/`render()`/
 *  `syncHighlight()` on either component all agree on whether the fine-grained path applies. */
export function codeBlockPreSuppliedGrammar(
  languages: Record<string, ShikiLanguageInput> | undefined,
  language: string
): ShikiLanguageInput | undefined {
  const normalized = normalizeShikiLanguage(language);
  return languages?.[normalized] ?? languages?.[language];
}

/** The LitElement surface `scrollCodeBlockToAnchor()` reads -- everything it touches is public on
 *  both components, so neither needs to widen a private field to route through this. */
export interface CodeBlockAnchorHost {
  readonly code: string;
  readonly highlights: readonly LyraHighlight[];
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly updateComplete: Promise<boolean>;
}

/** Resolves a `line-range` anchor (or a `highlights` id string resolving to one) by scrolling its
 *  start line into view within `[part="body"]`. Resolves `false` when the anchor isn't a
 *  `line-range`, the id isn't found, or the start line is out of bounds. */
export async function scrollCodeBlockToAnchor(
  host: CodeBlockAnchorHost,
  target: LyraAnchor | string
): Promise<boolean> {
  const anchor =
    typeof target === 'string'
      ? host.highlights.find((h) => h.id === target)?.anchor
      : target;
  if (!anchor || anchor.kind !== 'line-range') return false;
  if (anchor.start < 1 || anchor.start > codeBlockLineCount(host.code))
    return false;
  await host.updateComplete;
  const body = host.renderRoot.querySelector(
    '[part="body"]'
  ) as HTMLElement | null;
  const lineEl = host.renderRoot.querySelector(
    `[data-line="${anchor.start}"]`
  ) as HTMLElement | null;
  if (!body || !lineEl) return false;
  const offset = lineEl.offsetTop - body.clientHeight / 2;
  const ownerWindow = body.ownerDocument.defaultView;
  const reducedMotion = !ownerWindow || prefersReducedMotion(ownerWindow);
  body.scrollTo({
    top: Math.max(0, offset),
    behavior: reducedMotion ? 'auto' : 'smooth',
  });
  return true;
}

/** The one-based gutter line an event originated in, or `null` when it didn't come from a line
 *  button at all. */
export function codeBlockEventLine(e: Event): number | null {
  const target = e.composedPath()[0];
  if (
    typeof target !== 'object' ||
    target === null ||
    (target as Node).nodeType !== 1 ||
    typeof (target as Element).localName !== 'string' ||
    typeof (target as Element).closest !== 'function'
  ) {
    return null;
  }
  const lineElement = (target as Element).closest<HTMLElement>(
    '[data-line][part~="line-button"]'
  );
  const line = Number(lineElement?.dataset['line']);
  return Number.isInteger(line) && line >= 1 ? line : null;
}

/** What a keystroke on a gutter line button means. `null` covers both an unhandled key and a
 *  movement key that would land on the line already focused -- neither of which may
 *  `preventDefault()`, so the caller must not treat them differently. */
export type CodeBlockLineKeyAction =
  | { kind: 'activate' }
  | { kind: 'move'; line: number }
  | null;

/** The roving-tabindex keyboard contract for the (`line-numbers`-gated) gutter. */
export function codeBlockLineKeyAction(
  key: string,
  line: number,
  total: number
): CodeBlockLineKeyAction {
  if (key === 'Enter' || key === ' ') return { kind: 'activate' };
  let next: number | null = null;
  if (key === 'ArrowDown') next = Math.min(total, line + 1);
  else if (key === 'ArrowUp') next = Math.max(1, line - 1);
  else if (key === 'Home') next = 1;
  else if (key === 'End') next = total;
  if (next === null || next === line) return null;
  return { kind: 'move', line: next };
}

/** An `lr-text-select` payload for a selection ending inside `[part="body"]`. */
export interface CodeBlockSelection {
  readonly text: string;
  readonly anchor: LyraAnchor;
  readonly rects: readonly TextSelectRect[];
}

/** Anchors the current selection to the `line-range` it spans. `null` whenever there's nothing to
 *  report: no selection, a collapsed/whitespace-only one, or endpoints outside any `[data-line]`. */
export function codeBlockSelectionAnchor(
  shadowRoot: ShadowRoot | null
): CodeBlockSelection | null {
  if (!shadowRoot) return null;
  const ownerDocument = shadowRoot.ownerDocument;
  const globalSelection = ownerDocument.defaultView?.getSelection() as
    | (Selection & {
        getComposedRanges?: (options: {
          shadowRoots: ShadowRoot[];
        }) => StaticRange[];
      })
    | null
    | undefined;
  let range: Range | null = null;
  // WebKit and Chromium retarget a native shadow-tree selection's legacy Range to the document
  // boundary. The composed-range API preserves the real endpoints; Firefox's legacy Range remains
  // the fallback, as does Chromium's non-standard ShadowRoot.getSelection().
  if (globalSelection?.getComposedRanges) {
    const [composed] = globalSelection.getComposedRanges({
      shadowRoots: [shadowRoot],
    });
    if (
      composed &&
      (composed.startContainer !== composed.endContainer ||
        composed.startOffset !== composed.endOffset)
    ) {
      range = ownerDocument.createRange();
      range.setStart(composed.startContainer, composed.startOffset);
      range.setEnd(composed.endContainer, composed.endOffset);
    }
  }
  // `ShadowRoot.getSelection` is a Chromium-only extension absent from the standard DOM lib.
  const shadowSelection = (
    shadowRoot as unknown as { getSelection?: () => Selection | null }
  ).getSelection?.();
  const selection = shadowSelection ?? globalSelection;
  if (!range) {
    if (!selection || selection.isCollapsed || selection.rangeCount === 0)
      return null;
    range = selection.getRangeAt(0);
  }
  const text = boundedSelectionText(range);
  if (!text) return null;
  const lineOf = (node: Node): number | null => {
    const el =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;
    const lineEl = el?.closest('[data-line]');
    const attr = lineEl?.getAttribute('data-line');
    return attr === null || attr === undefined ? null : Number(attr);
  };
  const start = lineOf(range.startContainer);
  const end = lineOf(range.endContainer);
  if (start === null || end === null) return null;
  return {
    text,
    anchor: {
      kind: 'line-range',
      start: Math.min(start, end),
      end: Math.max(start, end),
    },
    rects: boundedSelectionRects(range),
  };
}

/** Every property whose change invalidates the cached `highlightedHtml`. */
export function codeBlockNeedsHighlightResync(
  changed: PropertyValues
): boolean {
  return (
    changed.has('code') ||
    changed.has('language') ||
    changed.has('languages') ||
    changed.has('highlightLines') ||
    changed.has('highlights') ||
    changed.has('activeHighlightId') ||
    changed.has('lineNumbers') ||
    changed.has('activatableLines')
  );
}

/**
 * Whether the `<lr-skeleton>` placeholder stands in for the code this render. Both components gate
 * it on "a highlighter this instance is actually waiting for hasn't settled yet, and there's a
 * `language` worth highlighting" -- they differ only in *which* loader that is, which is what
 * `loaderPending` carries: `<lr-code-block>` passes `!preSuppliedGrammar` (it is
 * waiting on the shared full-table singleton), `<lr-code-block-core>` passes `!!preSuppliedGrammar`
 * (it is waiting on the fine-grained `languages` highlighter, its only one). Called from both
 * `updated()` and `render()` on each class so the `aria-busy` host attribute can never disagree
 * with what is actually on screen.
 */
export function codeBlockShowsSkeleton(
  shikiReady: boolean,
  language: string,
  loaderPending: boolean
): boolean {
  return !shikiReady && !!language && loaderPending;
}

/** Mirrors the skeleton state onto the host as `aria-busy`, so assistive tech knows the code
 *  region is still resolving. */
export function applyCodeBlockAriaBusy(
  host: Element,
  showingSkeleton: boolean
): void {
  if (showingSkeleton) host.setAttribute('aria-busy', 'true');
  else host.removeAttribute('aria-busy');
}

export interface CodeBlockTokenizeOptions
  extends CodeBlockLineTransformerOptions {
  code: string;
  lang: string;
}

/**
 * The `codeToHtml()` call both components make once their own loader has produced a highlighter.
 * `hl` is deliberately typed as the fine-grained `ShikiHighlighterCore` -- it and
 * `ShikiHighlighter` are the same structural type (see `code-loader.ts`), and naming the
 * fine-grained one keeps this module free of any reference to the full-table half.
 *
 * shiki's generated per-token colors are theme-specific inline styles/CSS variables (from
 * `SHIKI_THEMES`'s github-light/github-dark theme data), not this library's `--lr-*` design tokens
 * -- the one deliberate exception to every other color in these components being a `--lr-*` token.
 * See the dark-mode override in `code-block.styles.ts` for how the dark half of this activates.
 * Returns `null` on malformed input for the grammar or any other shiki-internal failure, so the
 * caller falls back to plain text rather than a blank code block.
 */
export function tokenizeCodeBlock(
  hl: ShikiHighlighterCore,
  options: CodeBlockTokenizeOptions
): string | null {
  try {
    return hl.codeToHtml(options.code, {
      lang: options.lang,
      themes: SHIKI_THEMES,
      transformers: [codeBlockLineTransformer(options)],
    }) as string;
  } catch {
    return null;
  }
}

export function parseHighlightLines(
  spec: string,
  maxLine = Number.MAX_SAFE_INTEGER
): Set<number> {
  const lines = new Set<number>();
  for (const raw of spec.split(',')) {
    const segment = raw.trim();
    if (!segment) continue;
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(segment);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      addBoundedLineRange(lines, a, b, maxLine);
      continue;
    }
    const single = /^(\d+)$/.exec(segment);
    if (single) {
      addBoundedLineRange(lines, Number(single[1]), Number(single[1]), maxLine);
      continue;
    }
    console.warn(`highlight-lines: ignored invalid segment "${segment}"`);
  }
  return lines;
}

export interface CodeBlockLineTransformerOptions {
  lineNumbers: boolean;
  activatableLines: boolean;
  focusedLine: number;
  highlightedLines: Set<number>;
  activeLines: Set<number>;
  lineLabel: (line: number) => string;
  lineNumberText: (line: number) => string;
}

/**
 * A shiki transformer shared by `<lr-code-block>` and `<lr-code-block-core>` — rewrites
 * shiki's generated `<pre>`/`<code>`/per-line hast nodes so the highlighted output carries this
 * library's own `part="pre"`/`part="code"` hooks plus, per line, `data-line`, and (only for a
 * highlighted/active line) `data-highlighted`/`data-active` and `part="line-highlight"`. Also
 * strips shiki's own default `tabindex="0"` from `<pre>` — each component's own `[part="body"]`
 * wrapper is the single scrollable/focusable region.
 */
export function codeBlockLineTransformer(
  options: CodeBlockLineTransformerOptions
): ShikiTransformer {
  return {
    name: 'lr-code-block-parts',
    pre(node) {
      node.properties.part = ['pre'];
      if (options.lineNumbers) {
        const classValue = node.properties['class'];
        const classes = Array.isArray(classValue)
          ? classValue.map(String)
          : classValue
          ? [String(classValue)]
          : [];
        node.properties['class'] = [...classes, 'line-numbers'];
      }
      delete node.properties['tabindex'];
    },
    code(node) {
      node.properties.part = ['code'];
    },
    line(node, line: number) {
      node.properties['data-line'] = String(line);
      const parts: string[] = [];
      const contentNode = node as unknown as { children?: unknown[] };
      const children = contentNode.children ?? [];
      contentNode.children = children;
      let gutter: unknown;
      if (options.activatableLines && options.lineNumbers) {
        gutter = {
          type: 'element',
          tagName: 'button',
          properties: {
            type: 'button',
            class: ['line-gutter'],
            part: ['line-button'],
            'data-line': String(line),
            tabindex: String(options.focusedLine === line ? 0 : -1),
            'aria-label': options.lineLabel(line),
          },
          children: [{ type: 'text', value: options.lineNumberText(line) }],
        };
      } else if (options.lineNumbers) {
        gutter = {
          type: 'element',
          tagName: 'span',
          properties: {
            class: ['line-number'],
            'aria-hidden': 'true',
          },
          children: [{ type: 'text', value: options.lineNumberText(line) }],
        };
      }
      const source = {
        type: 'element',
        tagName: 'span',
        properties: { class: ['line-source'] },
        children: [...children],
      };
      children.splice(
        0,
        children.length,
        ...(gutter ? [gutter, source] : [source])
      );
      if (options.highlightedLines.has(line)) {
        parts.push('line-highlight');
        node.properties['data-highlighted'] = '';
      }
      if (parts.length > 0) node.properties.part = parts;
      if (options.activeLines.has(line)) node.properties['data-active'] = '';
    },
  };
}

export interface CodeBlockPlainCodeOptions {
  code: string;
  lineNumbers: boolean;
  activatableLines: boolean;
  focusedLine: number;
  highlightedLines: Set<number>;
  activeLines: Set<number>;
  localize: LyraLocalizeFn;
  lineLabel: (line: number) => string;
  lineNumberText: (line: number) => string;
  onLineActivate: (line: number) => void;
  onLineKeyDown: (e: KeyboardEvent, line: number) => void;
}

/**
 * The plain-text (non-shiki) fallback `<code>` rendering shared by `<lr-code-block>` and
 * `<lr-code-block-core>` -- previously a byte-for-byte-duplicated private method on both classes,
 * moved here for the same drift-prevention reason as `codeBlockLineTransformer` above. Always
 * splits into per-line spans/buttons (not just while `lineNumbers` is set) -- the per-line wrapper
 * is what `highlight-lines`/`highlights`/`activatable-lines` attach to. `.split()` consumes each
 * newline character, so a literal `'\n'` text node is re-inserted between lines to keep the
 * non-line-numbered case's visual output (relying on `[part='pre']`'s `white-space: pre`) identical
 * to a single-text-node rendering -- the line-numbered case's `.line` elements are already
 * `display: block` (`code-block.styles.ts`) so that text node is inert there. The gutter is a
 * separate real button, leaving source text selectable in both plain and highlighted output.
 */
export function renderCodeBlockPlainCode(
  options: CodeBlockPlainCodeOptions
): TemplateResult {
  const lines = options.code.split(/\r\n|\r|\n/);
  const interactive = options.activatableLines && options.lineNumbers;
  // The `>` sits on its own line right before the expression (and `</code` right after it, closing
  // on the following line) so no incidental whitespace text node lands inside <code> -- its
  // textContent must be exactly the concatenated line text, matching a single-text-node rendering.
  return html`<code
    part="code"
    class=${options.lineNumbers ? 'line-numbered-code' : nothing}
    >${lines.map((line, index) => {
      const lineNumber = index + 1;
      const isHighlighted = options.highlightedLines.has(lineNumber);
      const isActive = options.activeLines.has(lineNumber);
      const part = isHighlighted ? 'line-highlight' : nothing;
      const gutter = interactive
        ? html`<button
            type="button"
            class="line-gutter"
            part="line-button"
            data-line=${lineNumber}
            data-inline-handler
            aria-label=${options.lineLabel(lineNumber)}
            tabindex=${options.focusedLine === lineNumber ? 0 : -1}
            @click=${() => options.onLineActivate(lineNumber)}
            @keydown=${(e: KeyboardEvent) =>
              options.onLineKeyDown(e, lineNumber)}
          >
            ${options.lineNumberText(lineNumber)}
          </button>`
        : options.lineNumbers
        ? html`<span class="line-number" aria-hidden="true"
            >${options.lineNumberText(lineNumber)}</span
          >`
        : nothing;
      const lineTemplate = html`<span
        class="line"
        part=${part}
        data-line=${lineNumber}
        ?data-highlighted=${isHighlighted}
        ?data-active=${isActive}
        >${gutter}<span class="line-source">${line}</span></span
      >`;
      return index > 0 ? html`${'\n'}${lineTemplate}` : lineTemplate;
    })}</code
  >`;
}

export interface CodeBlockHeaderOptions {
  collapsible: boolean;
  collapsed: boolean;
  /** `id` of `[part="body"]`, for the toggle's `aria-controls`. */
  bodyId: string;
  filename: string;
  language: string;
  copyable: boolean;
  justCopied: boolean;
  copyFailed: boolean;
  localize: LyraLocalizeFn;
  onToggle: () => void;
  onCopy: () => void;
}

/**
 * The header row above the code (filename/language/copy/toggle) shared by `<lr-code-block>` and
 * `<lr-code-block-core>`. `aria-expanded` renders both `"true"` and `"false"` rather than being
 * conditionally omitted -- the collapse toggle's state is meaningless to assistive tech otherwise.
 */
export function renderCodeBlockHeader(
  options: CodeBlockHeaderOptions
): TemplateResult {
  // Indented two levels deeper than this function body on purpose: the literal text between these
  // tags becomes real whitespace text nodes, so keeping the exact indentation both class files
  // used before the extraction keeps the rendered DOM byte-identical (see renderCodeBlockShell()
  // below, where the same whitespace lands inside a `white-space`-sensitive region).
  // prettier-ignore
  return html`
      <div part="header">
        ${options.collapsible
          ? html`
              <button
                part="toggle"
                type="button"
                aria-expanded=${options.collapsed ? 'false' : 'true'}
                aria-controls=${options.bodyId}
                aria-label=${codeBlockToggleLabel(options.localize, options.collapsed)}
                @click=${options.onToggle}
              >
                <span class="chevron" aria-hidden="true">${chevronIcon()}</span>
              </button>
            `
          : nothing}
        ${options.filename ? html`<span part="filename">${options.filename}</span>` : nothing}
        ${options.language ? html`<span part="language">${options.language}</span>` : nothing}
        ${options.copyable
          ? html`
              <button
                part="copy-button"
                type="button"
                aria-label=${codeBlockCopyLabel(
                  options.localize,
                  options.justCopied,
                  options.copyFailed
                )}
                @click=${options.onCopy}
              >
                ${options.copyFailed
                  ? options.localize('copyFailed')
                  : options.justCopied
                    ? options.localize('copied')
                    : options.localize('copy')}
              </button>
            `
          : nothing}
      </div>
    `;
}

export interface CodeBlockShellOptions {
  filename: string;
  language: string;
  copyable: boolean;
  collapsible: boolean;
  collapsed: boolean;
  justCopied: boolean;
  copyFailed: boolean;
  bodyId: string;
  /** Wins over the filename/language-derived default -- the host's own `aria-label`. */
  accessibleLabel: string | null;
  maxHeight: string;
  isDarkTheme: boolean;
  showSkeleton: boolean;
  /** shiki's own markup for this render, or `null` for the plain-text fallback path. */
  highlightedHtml: string | null;
  lineNumbers: boolean;
  localize: LyraLocalizeFn;
  renderPlainCode: () => TemplateResult;
  onToggle: () => void;
  onCopy: () => void;
  onBodyMouseUp: (e: MouseEvent) => void;
  onBodyClick: (e: MouseEvent) => void;
  onBodyKeyDown: (e: KeyboardEvent) => void;
  onBodyFocusIn: (e: FocusEvent) => void;
}

/**
 * The whole rendered tree for both components: the header (only when there's anything to put in
 * it) plus the scrollable code body.
 *
 * `[part="body"]` is `tabindex="0"` because it's the scrollable region for arbitrarily-wide/tall
 * code (`max-height`, plus horizontal overflow from long lines) -- a scrollable region with no
 * other focusable content of its own is otherwise unreachable by keyboard, the same reasoning
 * `<lr-virtual-list>`'s own `[part="base"]` documents for its identical tabindex. `role="group"`
 * (rather than e.g. `region`, a page landmark role) plus `aria-label` gives it an accessible name
 * without claiming landmark/navigation significance for what is, structurally, just one small piece
 * of a larger document.
 */
export function renderCodeBlockShell(
  options: CodeBlockShellOptions
): TemplateResult {
  const hasHeader =
    !!options.filename ||
    !!options.language ||
    options.copyable ||
    options.collapsible;
  const bodyHidden = options.collapsible && options.collapsed;
  const bodyLabel =
    options.accessibleLabel ??
    codeBlockBodyLabel(options.localize, options.filename, options.language);

  // Indentation preserved from both class files' own render() -- see renderCodeBlockHeader() above.
  // prettier-ignore
  return html`
      <div part="base">
        ${hasHeader
          ? renderCodeBlockHeader({
              collapsible: options.collapsible,
              collapsed: options.collapsed,
              bodyId: options.bodyId,
              filename: options.filename,
              language: options.language,
              copyable: options.copyable,
              justCopied: options.justCopied,
              copyFailed: options.copyFailed,
              localize: options.localize,
              onToggle: options.onToggle,
              onCopy: options.onCopy,
            })
          : nothing}
        <div
          part="body"
          id=${options.bodyId}
          role="group"
          aria-label=${bodyLabel}
          tabindex="0"
          ?hidden=${bodyHidden}
          data-dark-theme=${options.isDarkTheme ? 'true' : nothing}
          style=${(() => {
          // `maxHeight` is a free-form public string on both <lr-code-block> and
          // <lr-code-block-core>; interpolating it into a declaration list would let
          // `max-height="1px;background-image:url(...)"` inject declarations here.
          const safeMaxHeight = sanitizeCssLength(options.maxHeight);
          return safeMaxHeight ? styleMap({ '--lr-code-block-max-height': safeMaxHeight }) : nothing;
        })()}
          @mouseup=${options.onBodyMouseUp}
          @click=${options.onBodyClick}
          @keydown=${options.onBodyKeyDown}
          @focusin=${options.onBodyFocusIn}
        >
          ${options.showSkeleton
            ? html`<lr-skeleton shape="rect" .announce=${false}></lr-skeleton>`
            : options.highlightedHtml !== null
              ? unsafeHTML(options.highlightedHtml)
              : html`<pre part="pre" class=${options.lineNumbers ? 'line-numbers' : nothing}>${options.renderPlainCode()}</pre>`}
        </div>
      </div>
    `;
}

/** The element surface {@linkcode CodeBlockInteractionController} reads. Every member is either
 *  native to `HTMLElement` or already public on both code-block variants, so routing through the
 *  controller widens neither component's own API. */
export interface CodeBlockInteractionHost extends HTMLElement {
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly updateComplete: Promise<boolean>;
  readonly code: string;
  collapsed: boolean;
}

/** The reactive writes and event emissions the controller cannot perform itself: each component
 *  keeps `focusedLine`/`justCopied`/`isDarkTheme` as its own `@state()` (they reach its template)
 *  and its own typed `emit()`, and hands those in as callbacks. */
export interface CodeBlockInteractionOptions {
  host: CodeBlockInteractionHost;
  setFocusedLine: (line: number) => void;
  setJustCopied: (value: boolean) => void;
  setCopyFailed: (value: boolean) => void;
  setDarkTheme: (value: boolean) => void;
  emitLineActivate: (line: number) => void;
  emitCopy: (outcome: LyraClipboardWriteSuccess) => void;
  emitError: () => void;
  emitCopyError: (outcome: LyraClipboardWriteFailure) => void;
  requestToggle: (collapsed: boolean) => boolean;
  emitToggle: (collapsed: boolean) => void;
  emitTextSelect: (selection: CodeBlockSelection) => void;
}

/**
 * Every interaction behavior `<lr-code-block>` and `<lr-code-block-core>` implement identically:
 * the gutter's roving-tabindex focus and keyboard contract, the pointer/keyboard/focus handlers on
 * `[part="body"]`, selection anchoring, the copy button and its confirmation timer, the
 * collapse/expand toggle, and the dark-theme watcher's lifecycle.
 *
 * These lived as line-for-line duplicates on both classes, which is exactly the drift this module
 * exists to prevent -- and had already bitten this pair once before (`renderPlainCode()`). The
 * controller owns the two purely-internal bits of bookkeeping outright (the copy timer and the
 * theme-watcher teardown, neither of which reaches either template); the three values that *are*
 * rendered stay as each component's own `@state()`, written through the callbacks above so Lit
 * still sees them change.
 */
export class CodeBlockInteractionController {
  private copyTimer?: { owner: Window; handle: number };
  private copyGeneration = 0;

  constructor(private readonly options: CodeBlockInteractionOptions) {}

  /** Re-resolves token colors after an imperative CSSOM/adopted-stylesheet theme change. */
  refreshTheme(): void {
    this.options.setDarkTheme(resolveIsDarkTheme(this.options.host));
  }

  /** Retires an in-flight copy-confirmation timer against the window that scheduled it. */
  cancelCopyTimer(): void {
    const timer = this.copyTimer;
    this.copyTimer = undefined;
    if (timer) timer.owner.clearTimeout(timer.handle);
  }

  /** Invalidates pending writes and feedback when the host disconnects or changes owner. */
  disconnect(): void {
    this.copyGeneration++;
    this.cancelCopyTimer();
    this.options.setJustCopied(false);
    this.options.setCopyFailed(false);
  }

  private setCopyStatus(status: 'rest' | 'success' | 'error'): void {
    this.options.setJustCopied(status === 'success');
    this.options.setCopyFailed(status === 'error');
  }

  /** Moves the roving tab stop to `line`, both in the component's state and on the rendered
   *  gutter buttons (which Lit will not have re-rendered yet). */
  setFocusedLine(line: number): void {
    this.options.setFocusedLine(line);
    for (const target of this.options.host.renderRoot.querySelectorAll<HTMLElement>(
      '[data-line][part~="line-button"]'
    )) {
      target.tabIndex = Number(target.dataset['line']) === line ? 0 : -1;
    }
  }

  onLineActivate = (line: number): void => {
    this.setFocusedLine(line);
    this.options.emitLineActivate(line);
  };

  // Roving-tabindex keyboard navigation across the gutter's line buttons (only rendered by
  // renderCodeBlockPlainCode() while activatableLines && lineNumbers are both set).
  onLineKeyDown = (e: KeyboardEvent, line: number): void => {
    const { host } = this.options;
    const action = codeBlockLineKeyAction(
      e.key,
      line,
      codeBlockLineCount(host.code)
    );
    if (action === null) return;
    e.preventDefault();
    if (action.kind === 'activate') {
      this.onLineActivate(line);
      return;
    }
    const next = action.line;
    this.setFocusedLine(next);
    void host.updateComplete.then(() => {
      host.renderRoot
        .querySelector<HTMLElement>(
          `[part~="line-button"][data-line="${next}"]`
        )
        ?.focus();
    });
  };

  onBodyClick = (e: MouseEvent): void => {
    if (
      (e.composedPath()[0] as Element | undefined)?.closest?.(
        'button[data-inline-handler]'
      )
    )
      return;
    const line = codeBlockEventLine(e);
    if (line !== null) this.onLineActivate(line);
  };

  onBodyKeyDown = (e: KeyboardEvent): void => {
    if (
      (e.composedPath()[0] as Element | undefined)?.closest?.(
        'button[data-inline-handler]'
      )
    )
      return;
    const line = codeBlockEventLine(e);
    if (line !== null) this.onLineKeyDown(e, line);
  };

  onBodyFocusIn = (e: FocusEvent): void => {
    const line = codeBlockEventLine(e);
    if (line !== null) this.setFocusedLine(line);
  };

  /** Anchors a text selection ending inside `[part="body"]` to the `line-range` it spans, so a
   *  host can persist or otherwise act on it. Fires nothing when there's no active selection. */
  onBodyMouseUp = (): void => {
    const selection = codeBlockSelectionAnchor(this.options.host.shadowRoot);
    if (selection) this.options.emitTextSelect(selection);
  };

  copy = async (): Promise<void> => {
    const { host } = this.options;
    const owner = host.isConnected ? host.ownerDocument.defaultView : null;
    const text = host.code;
    const generation = ++this.copyGeneration;
    this.cancelCopyTimer();
    this.setCopyStatus('rest');
    const outcome = await writeClipboardText(owner, text);
    if (
      !owner ||
      !host.isConnected ||
      host.ownerDocument.defaultView !== owner ||
      generation !== this.copyGeneration
    )
      return;
    if (!outcome.ok) {
      this.setCopyStatus('error');
      this.options.emitError();
      this.options.emitCopyError(outcome);
    } else {
      this.options.emitCopy(outcome);
      this.setCopyStatus('success');
    }
    let handle = 0;
    handle = owner.setTimeout(() => {
      if (
        this.copyTimer?.owner !== owner ||
        this.copyTimer.handle !== handle ||
        !host.isConnected ||
        host.ownerDocument.defaultView !== owner ||
        generation !== this.copyGeneration
      )
        return;
      this.copyTimer = undefined;
      this.setCopyStatus('rest');
    }, CODE_BLOCK_COPY_CONFIRM_MS);
    this.copyTimer = { owner, handle };
  };

  toggleCollapsed = (): void => {
    const { host } = this.options;
    const collapsed = !host.collapsed;
    if (!this.options.requestToggle(collapsed)) return;
    host.collapsed = collapsed;
    this.options.emitToggle(host.collapsed);
  };
}
