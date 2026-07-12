import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { chevronIcon } from '../../internal/icons.js';
import { styles } from './json-viewer.styles.js';

type JsonPathSegment = string | number;

type JsonValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'undefined';

interface SearchState {
  keyMatches: Set<string>;
  valueMatches: Set<string>;
  /** Stringified paths of every *ancestor* of a match -- not the match itself. */
  forceExpand: Set<string>;
}

const EMPTY_SEARCH: SearchState = {
  keyMatches: new Set(),
  valueMatches: new Set(),
  forceExpand: new Set(),
};

function isPlainContainer(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `[key, value]` pairs for an object's own enumerable properties or an array's indices; `[]` for anything else. */
function entriesOf(value: unknown): [JsonPathSegment, unknown][] {
  if (Array.isArray(value)) return value.map((v, i): [JsonPathSegment, unknown] => [i, v]);
  if (isPlainContainer(value)) return Object.entries(value);
  return [];
}

function valueType(value: unknown): JsonValueType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return t;
  if (t === 'object') return 'object';
  // function/symbol/bigint -- not valid JSON, but rendering *something*
  // sensible beats throwing on a value a caller handed us by mistake.
  return 'string';
}

function formatPrimitive(value: unknown, type: JsonValueType): string {
  switch (type) {
    case 'string':
      return JSON.stringify(value);
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    default:
      return String(value);
  }
}

function previewText(value: unknown, type: 'object' | 'array', count: number): string {
  if (type === 'array') return `${count} ${count === 1 ? 'item' : 'items'}`;
  return `${count} ${count === 1 ? 'key' : 'keys'}`;
}

/**
 * `<lyra-json-viewer>` — a collapsible, copyable tree view for an arbitrary
 * JSON-serializable value (object/array/string/number/boolean/null/
 * undefined). Serves as the fallback renderer wherever a raw payload (tool
 * call arguments, a tool result, an API response) needs inspecting without a
 * bespoke view.
 *
 * Expand/collapse state is keyed by structural path (not by object identity),
 * so it survives a `data` reassignment that keeps the same shape -- e.g. a
 * streaming tool result being patched in place.
 *
 * @customElement lyra-json-viewer
 * @event lyra-copy - `detail: { text }` -- fired by the top-level copy button or a per-node one. Fires even when `navigator.clipboard` silently failed or is unavailable (insecure context, older browser, stubbed-out test environment), so a consumer can still observe copy *intent*.
 * @csspart base - The root scroll container; respects `max-height`.
 * @csspart toolbar - The wrapper around the top-level copy button (only rendered when `copyable`).
 * @csspart tree - The wrapper around the rendered node tree.
 * @csspart key - An object property key or array index label.
 * @csspart value - A primitive value's text -- carries `data-type` (`string`/`number`/`boolean`/`null`/`undefined`) for per-type coloring, and `data-match` while it matches `search`.
 * @csspart bracket - A `{`, `}`, `[`, or `]` delimiter.
 * @csspart toggle - A container node's expand/collapse button (hidden, but present for row alignment, on leaf/empty nodes).
 * @csspart copy-button - A copy-to-clipboard button -- the top-level one (in `toolbar`) or a per-node one (only rendered when `copyable`).
 */
export class LyraJsonViewer extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The value to render. Any JSON-serializable value, plus `undefined`. */
  @property({ attribute: false }) data: unknown;
  /** Nodes at or beyond this nesting depth (root = 0) start collapsed. Omit/undefined: nothing auto-collapses. */
  @property({ type: Number, attribute: 'collapsed-depth' }) collapsedDepth?: number;
  /** A CSS length (e.g. `"20rem"`); once set, the viewer scrolls internally past this height instead of growing the page. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  /** Shows copy-to-clipboard affordances: one for the whole value, plus one per node. */
  @property({ type: Boolean, reflect: true }) copyable = false;
  /** Case-insensitive substring match against keys/values; matches are highlighted and their ancestors auto-expanded. */
  @property() search = '';

  /** Per-path (`JSON.stringify(path)`) explicit expand/collapse, overriding the `collapsedDepth`/search defaults once a node's toggle has been used. */
  @state() private expandedOverrides = new Map<string, boolean>();

  private isExpanded(pathKey: string, depth: number, forceExpand: Set<string>): boolean {
    const override = this.expandedOverrides.get(pathKey);
    if (override !== undefined) return override;
    if (forceExpand.has(pathKey)) return true;
    if (this.collapsedDepth !== undefined && depth >= this.collapsedDepth) return false;
    return true;
  }

  private toggleNode(pathKey: string, currentlyExpanded: boolean): void {
    const next = new Map(this.expandedOverrides);
    next.set(pathKey, !currentlyExpanded);
    this.expandedOverrides = next;
  }

  private writeClipboard(text: string): void {
    try {
      // navigator.clipboard is absent in insecure contexts / older browsers,
      // and some engines throw synchronously rather than rejecting -- either
      // way this is best-effort; copy() below always emits lyra-copy
      // regardless of whether the OS clipboard was actually reached.
      void navigator.clipboard?.writeText(text)?.catch(() => {});
    } catch {
      // see above
    }
  }

  private copy(value: unknown): void {
    const text = value === undefined ? 'undefined' : JSON.stringify(value, null, 2);
    this.writeClipboard(text);
    this.emit('lyra-copy', { text });
  }

  /** Builds the key/value-match sets and the ancestor-paths-of-a-match set that `search` drives. */
  private computeSearch(): SearchState {
    const query = this.search.trim().toLowerCase();
    if (!query) return EMPTY_SEARCH;

    const keyMatches = new Set<string>();
    const valueMatches = new Set<string>();
    const forceExpand = new Set<string>();

    const markAncestors = (path: JsonPathSegment[]): void => {
      for (let i = path.length - 1; i >= 0; i--) forceExpand.add(JSON.stringify(path.slice(0, i)));
    };

    const walk = (value: unknown, path: JsonPathSegment[], keyLabel?: string): void => {
      const pathKey = JSON.stringify(path);
      let hit = false;
      if (keyLabel !== undefined && keyLabel.toLowerCase().includes(query)) {
        keyMatches.add(pathKey);
        hit = true;
      }
      const type = valueType(value);
      if (type !== 'object' && type !== 'array' && formatPrimitive(value, type).toLowerCase().includes(query)) {
        valueMatches.add(pathKey);
        hit = true;
      }
      if (hit) markAncestors(path);
      for (const [k, v] of entriesOf(value)) walk(v, [...path, k], String(k));
    };

    walk(this.data, []);
    return { keyMatches, valueMatches, forceExpand };
  }

  private renderCopyButton(value: unknown): TemplateResult | typeof nothing {
    if (!this.copyable) return nothing;
    return html`
      <button
        part="copy-button"
        type="button"
        aria-label="Copy value"
        @click=${(e: Event) => {
          e.stopPropagation();
          this.copy(value);
        }}
      >
        Copy
      </button>
    `;
  }

  private renderNode(
    value: unknown,
    path: JsonPathSegment[],
    keyLabel: string | undefined,
    depth: number,
    search: SearchState,
  ): TemplateResult {
    const pathKey = JSON.stringify(path);
    const type = valueType(value);
    const isContainer = type === 'object' || type === 'array';
    const entries = isContainer ? entriesOf(value) : [];
    const hasEntries = entries.length > 0;
    const expanded = hasEntries && this.isExpanded(pathKey, depth, search.forceExpand);
    const indentStyle = `padding-inline-start:calc(${depth} * var(--lyra-space-l))`;
    const toggleLabel = keyLabel ?? (type === 'array' ? 'array' : type === 'object' ? 'object' : 'value');
    const openBracket = type === 'array' ? '[' : '{';
    const closeBracket = type === 'array' ? ']' : '}';

    const headRow = html`
      <div class="row" style=${indentStyle}>
        <button
          part="toggle"
          type="button"
          ?hidden=${!hasEntries}
          tabindex=${hasEntries ? nothing : -1}
          aria-hidden=${hasEntries ? nothing : 'true'}
          aria-expanded=${hasEntries ? (expanded ? 'true' : 'false') : nothing}
          aria-label=${hasEntries ? `${expanded ? 'Collapse' : 'Expand'} ${toggleLabel}` : nothing}
          @click=${() => hasEntries && this.toggleNode(pathKey, expanded)}
        >
          <span class="chevron" style=${`transform:rotate(${expanded ? '90deg' : '0deg'})`}>${chevronIcon()}</span>
        </button>
        ${keyLabel !== undefined
          ? html`<span part="key" ?data-match=${search.keyMatches.has(pathKey)}>${keyLabel}</span
              ><span class="colon">:</span>`
          : nothing}
        ${isContainer
          ? html`
              <span part="bracket">${openBracket}</span>
              ${hasEntries && !expanded
                ? html`<span class="preview">${previewText(value, type, entries.length)}</span>`
                : nothing}
              ${!expanded ? html`<span part="bracket">${closeBracket}</span>` : nothing}
            `
          : html`<span part="value" data-type=${type} ?data-match=${search.valueMatches.has(pathKey)}
              >${formatPrimitive(value, type)}</span
            >`}
        ${this.renderCopyButton(value)}
      </div>
    `;

    // Always returned from this one call site, with a single conditional
    // hole for the children block -- switching between *returning headRow
    // bare* and *wrapping it in a bigger template* (two different template
    // shapes at the same tree position) would make lit-html tear down and
    // recreate the whole subtree on every expand/collapse instead of
    // patching in place, destroying the toggle button's DOM identity (and
    // with it, real DOM focus) on every click.
    return html`
      ${headRow}
      ${isContainer && expanded
        ? html`
            <div class="children">
              ${repeat(
                entries,
                ([k]) => JSON.stringify([...path, k]),
                ([k, v]) => this.renderNode(v, [...path, k], String(k), depth + 1, search),
              )}
            </div>
            <div class="row" style=${indentStyle}>
              <span class="toggle-space" aria-hidden="true"></span>
              <span part="bracket">${closeBracket}</span>
            </div>
          `
        : nothing}
    `;
  }

  render(): TemplateResult {
    const search = this.computeSearch();
    return html`
      <div part="base" style=${this.maxHeight ? `--lyra-json-viewer-max-height:${this.maxHeight}` : nothing}>
        ${this.copyable
          ? html`<div part="toolbar">
              <button
                part="copy-button"
                type="button"
                aria-label="Copy JSON to clipboard"
                @click=${() => this.copy(this.data)}
              >
                Copy
              </button>
            </div>`
          : nothing}
        <div part="tree">${this.renderNode(this.data, [], undefined, 0, search)}</div>
      </div>
    `;
  }
}

defineElement('json-viewer', LyraJsonViewer);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-json-viewer': LyraJsonViewer;
  }
}
