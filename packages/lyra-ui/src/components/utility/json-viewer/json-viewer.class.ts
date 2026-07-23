import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { chevronIcon } from '../../../internal/icons.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteCount } from '../../../internal/numbers.js';
import { styles } from './json-viewer.styles.js';

type JsonPathSegment = string | number;

type JsonValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'undefined';

interface SearchState {
  keyMatches: Set<string>;
  valueMatches: Set<string>;
  /** Stringified paths of every *ancestor* of a match -- not the match itself. */
  forceExpand: Set<string>;
  /**
   * Every path key reachable in the tree as of the last walk -- populated
   * regardless of whether `search` is set, so `expandedOverrides` can be
   * pruned down to it whenever `data` changes.
   */
  paths: Set<string>;
  /** Every match, in the same document-walk order as `keyMatches`/`valueMatches` were populated in (key before value at the same path). Backs the `searchNext()`/`searchPrevious()` cursor. */
  orderedMatches: { pathKey: string; kind: 'key' | 'value' }[];
}

const EMPTY_SEARCH: SearchState = {
  keyMatches: new Set(),
  valueMatches: new Set(),
  forceExpand: new Set(),
  paths: new Set(),
  orderedMatches: [],
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
      // `type` here also covers valueType()'s function/symbol/bigint
      // fallback (see the comment there) -- JSON.stringify() throws a
      // TypeError for a BigInt, so only an actual string gets the
      // quoted/escaped treatment; everything else falls back to a plain
      // String() coercion, which renders "sensibly" without throwing.
      return typeof value === 'string' ? JSON.stringify(value) : String(value);
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    default:
      return String(value);
  }
}

export interface LyraJsonViewerEventMap {
  'lr-copy': CustomEvent<{ text: string }>;
  'lr-search-change': CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
}
/**
 * `<lr-json-viewer>` — a collapsible, copyable tree view for an arbitrary
 * JSON-serializable value (object/array/string/number/boolean/null/
 * undefined). Serves as the fallback renderer wherever a raw payload (tool
 * call arguments, a tool result, an API response) needs inspecting without a
 * bespoke view.
 *
 * Expand/collapse state is keyed by structural path (not by object identity),
 * so it survives a `data` reassignment that keeps the same shape -- e.g. a
 * streaming tool result being patched in place.
 *
 * @customElement lr-json-viewer
 * @event lr-copy - `detail: { text }` -- fired by the top-level copy button or a per-node one. Fires even when `navigator.clipboard` is unavailable, so a consumer can still observe copy *intent*.
 * @event lr-search-change - Fired whenever the search query, match count, or active-match cursor
 *   changes -- from `runSearch()`/`searchNext()`/`searchPrevious()`/`clearSearch()`, or a direct
 *   `search`/`data` property write. `detail: { query, matchCount, activeIndex }`.
 * @csspart base - The root scroll container; respects `max-height`.
 * @csspart toolbar - The wrapper around the top-level copy button (only rendered when `copyable`).
 * @csspart tree - The wrapper around the rendered node tree.
 * @csspart key - An object property key or array index label.
 * @csspart value - A primitive value's text -- carries `data-type` (`string`/`number`/`boolean`/`null`/`undefined`, or `circular` for a self-reference marker in place of a re-visited container's subtree) for per-type coloring, `data-match` while it matches `search`, and `data-active` while it is the current `searchNext()`/`searchPrevious()` cursor position.
 * @csspart bracket - A `{`, `}`, `[`, or `]` delimiter.
 * @csspart toggle - A container node's expand/collapse button (hidden, but present for row alignment, on leaf/empty nodes).
 * @csspart copy-button - A copy-to-clipboard button -- the top-level one (in `toolbar`, labelled "Copy JSON to clipboard") or a per-node one (only rendered when `copyable`; labelled with its own key/type, e.g. "Copy age", so assistive tech can tell rows apart).
 * @cssprop [--lr-json-viewer-max-height=none] - Cap on `[part="base"]`'s block size, past which the
 *   viewer scrolls internally. The `maxHeight` property sets this token inline on `[part="base"]`.
 * @cssprop [--lr-json-viewer-font=var(--lr-font-mono)] - Font family used for the rendered tree.
 * @cssprop [--lr-json-viewer-match-bg=var(--lr-color-warning-quiet)] - Background (and
 *   surrounding box-shadow) of a key/value that currently matches `search`.
 * @cssprop [--lr-json-viewer-active-outline=var(--lr-focus-ring-color)] - Outline color for the
 *   current imperative search match.
 * @cssprop [--lr-json-viewer-string-color=var(--lr-color-success)] - String value color.
 * @cssprop [--lr-json-viewer-number-color=var(--lr-color-brand)] - Number value color.
 * @cssprop [--lr-json-viewer-boolean-color=var(--lr-color-warning)] - Boolean value color.
 * @cssprop [--lr-json-viewer-null-color=var(--lr-color-text-quiet)] - Null, undefined, and
 *   circular-reference marker color.
 */
export class LyraJsonViewer extends LyraElement<LyraJsonViewerEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The value to render. Any JSON-serializable value, plus `undefined`. */
  @property({ attribute: false }) data: unknown;
  /** Nodes at or beyond this nesting depth (root = 0) start collapsed. Omit/undefined: nothing auto-collapses. */
  @property({ type: Number, attribute: 'collapsed-depth' }) collapsedDepth?: number;
  /** A CSS length (e.g. `"20rem"`); once set, the viewer scrolls internally past this height instead of growing the page. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  /** Shows copy-to-clipboard affordances: one for the whole value, plus one per node. */
  @property({ type: Boolean, reflect: true }) copyable = false;
  /** Case-insensitive substring match against keys/values; matches are highlighted and their ancestors auto-expanded. See also `runSearch()`/`searchNext()`/`searchPrevious()`/`clearSearch()` for imperative, cursor-navigable search built on top of this property. */
  @property() search = '';

  /**
   * Per-path (`JSON.stringify(path)`) explicit expand/collapse, overriding
   * the `collapsedDepth`/search defaults once a node's toggle has been used.
   * Pruned in `willUpdate()` (to the paths still reachable in the tree)
   * whenever `data` changes, so a long-lived instance bound to reshaping
   * data -- this component's own stated streaming use case -- doesn't
   * accumulate one entry per path ever toggled for the life of the instance.
   */
  @state() private expandedOverrides = new Map<string, boolean>();

  /** Index into `searchState.orderedMatches` of the current `searchNext()`/`searchPrevious()` cursor; `-1` before any navigation. */
  @state() private activeSearchIndex = -1;

  /** Memoized result of the last `computeSearch()` walk -- see `willUpdate()`. */
  private searchState: SearchState = EMPTY_SEARCH;
  private searchLocale = '';

  /** `collapsedDepth`, normalized to a finite non-negative integer when set -- `undefined`
   *  (nothing auto-collapses) is left as-is, since it's a meaningful, intentional value, not an
   *  invalid one. A raw `NaN` (e.g. an invalid `collapsed-depth` attribute) would otherwise make
   *  every `depth >= collapsedDepth` comparison false, silently disabling auto-collapse instead of
   *  falling back to a sane depth. */
  private get safeCollapsedDepth(): number | undefined {
    return this.collapsedDepth === undefined ? undefined : finiteCount(this.collapsedDepth);
  }

  private previewText(type: 'object' | 'array', count: number): string {
    // {count} is interpolated via the values arg (not string-concatenated) --
    // same "{count} tool"/"{count} tools" template pattern as toolCount/
    // toolCountPlural, so the count's position relative to the noun stays
    // translatable rather than fixed to English's "number space noun" order.
    const localizedCount = getNumberFormat(this.effectiveLocale).format(count);
    if (type === 'array') {
      return this.localize(count === 1 ? 'jsonItemCount' : 'jsonItemCountPlural', undefined, {
        count: localizedCount,
      });
    }
    return this.localize(count === 1 ? 'jsonKeyCount' : 'jsonKeyCountPlural', undefined, {
      count: localizedCount,
    });
  }

  private isExpanded(pathKey: string, depth: number, forceExpand: Set<string>): boolean {
    const override = this.expandedOverrides.get(pathKey);
    if (override !== undefined) return override;
    if (forceExpand.has(pathKey)) return true;
    const collapsedDepth = this.safeCollapsedDepth;
    if (collapsedDepth !== undefined && depth >= collapsedDepth) return false;
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
      // way this is best-effort; copy() below always emits lr-copy
      // regardless of whether the OS clipboard was actually reached.
      void navigator.clipboard?.writeText(text)?.catch(() => {});
    } catch {
      // see above
    }
  }

  private copy(value: unknown): void {
    const text = value === undefined ? 'undefined' : this.stringifyForClipboard(value);
    this.writeClipboard(text);
    this.emit('lr-copy', { text });
  }

  /**
   * `JSON.stringify()` throws on a value reachable from itself through a cycle -- data this
   * component explicitly supports rendering (`renderNode()`'s own ancestors-stack leaf marker).
   * The replacer below tracks the same "is this value already one of the containers I'm
   * currently nested inside" check via `this`, which `JSON.stringify` binds to the holder
   * object/array currently being serialized on every replacer call: truncating `stack` back to
   * the holder's depth before testing membership means only a genuine ancestor collapses to the
   * localized circular-reference marker, not an unrelated value that merely appears twice (a
   * "diamond" reference is not a cycle). A BigInt anywhere inside `value` (not just at the root)
   * throws the same way formatPrimitive()'s unguarded call used to -- downgraded to its decimal
   * string form instead.
   */
  private stringifyForClipboard(value: unknown): string {
    const circularMarker = this.localize('circularReference');
    const stack: unknown[] = [];
    return JSON.stringify(
      value,
      function (this: unknown, _key: string, v: unknown) {
        if (typeof v === 'bigint') return v.toString();
        if (typeof v !== 'object' || v === null) return v;
        const holderIndex = stack.indexOf(this);
        stack.length = holderIndex + 1;
        if (stack.includes(v)) return circularMarker;
        stack.push(v);
        return v;
      },
      2,
    );
  }

  /**
   * Builds the key/value-match sets, the ancestor-paths-of-a-match set that
   * `search` drives, and the full set of path keys reachable in the tree
   * (`paths`, used to prune `expandedOverrides` -- see `willUpdate()`).
   * Guards against a self-referencing `data` the same way `renderNode()`
   * does: a container value already on the current recursion path is
   * treated as a leaf instead of being walked again.
   */
  private computeSearch(): SearchState {
    const locale = this.effectiveLocale;
    const query = this.search.trim().toLocaleLowerCase(locale);
    const keyMatches = new Set<string>();
    const valueMatches = new Set<string>();
    const forceExpand = new Set<string>();
    const paths = new Set<string>();
    const orderedMatches: { pathKey: string; kind: 'key' | 'value' }[] = [];
    const ancestors = new WeakSet<object>();

    const markAncestors = (path: JsonPathSegment[]): void => {
      for (let i = path.length - 1; i >= 0; i--) forceExpand.add(JSON.stringify(path.slice(0, i)));
    };

    const walk = (value: unknown, path: JsonPathSegment[], keyLabel?: string): void => {
      const pathKey = JSON.stringify(path);
      paths.add(pathKey);
      const type = valueType(value);
      if (query) {
        let hit = false;
        if (keyLabel !== undefined && keyLabel.toLocaleLowerCase(locale).includes(query)) {
          keyMatches.add(pathKey);
          orderedMatches.push({ pathKey, kind: 'key' });
          hit = true;
        }
        if (
          type !== 'object' &&
          type !== 'array' &&
          formatPrimitive(value, type).toLocaleLowerCase(locale).includes(query)
        ) {
          valueMatches.add(pathKey);
          orderedMatches.push({ pathKey, kind: 'value' });
          hit = true;
        }
        if (hit) markAncestors(path);
      }
      if ((type === 'object' || type === 'array') && !ancestors.has(value as object)) {
        ancestors.add(value as object);
        for (const [k, v] of entriesOf(value)) walk(v, [...path, k], String(k));
        ancestors.delete(value as object);
      }
    };

    walk(this.data, []);
    return { keyMatches, valueMatches, forceExpand, paths, orderedMatches };
  }

  private renderCopyButton(value: unknown, label: string | undefined): TemplateResult | typeof nothing {
    if (!this.copyable) return nothing;
    // "Copy {label}" is interpolated via the values arg (not string-concatenated)
    // so word order stays translatable -- label is either caller data (a JSON
    // key/index) or an already-localized type noun (jsonArray/jsonObject/
    // jsonValue), matching how e.g. `rename: 'Rename {title}'` composes a verb
    // with arbitrary/derived data elsewhere in this registry.
    const resolvedLabel = label ?? this.localize('jsonValue');
    return html`
      <button
        part="copy-button"
        type="button"
        aria-label=${this.localize('jsonCopyLabel', undefined, { label: resolvedLabel })}
        @click=${(e: Event) => {
          e.stopPropagation();
          this.copy(value);
        }}
      >
        ${this.localize('copy')}
      </button>
    `;
  }

  private renderNode(
    value: unknown,
    path: JsonPathSegment[],
    keyLabel: string | undefined,
    depth: number,
    search: SearchState,
    ancestors: WeakSet<object>,
  ): TemplateResult {
    const pathKey = JSON.stringify(path);
    const type = valueType(value);
    // A container value already on the current recursion path (i.e. `data`
    // self-references, directly or through a longer cycle) gets rendered as
    // a leaf marker instead of recursing again -- recursing would blow the
    // stack instead of degrading gracefully.
    const isCircular = (type === 'object' || type === 'array') && ancestors.has(value as object);
    const isContainer = (type === 'object' || type === 'array') && !isCircular;
    const entries = isContainer ? entriesOf(value) : [];
    const hasEntries = entries.length > 0;
    const expanded = hasEntries && this.isExpanded(pathKey, depth, search.forceExpand);
    const activeMatch = this.searchState.orderedMatches[this.activeSearchIndex];
    const indentStyle = `padding-inline-start:calc(${depth} * var(--lr-space-l))`;
    const toggleLabel =
      keyLabel ??
      (type === 'array'
        ? this.localize('jsonArray')
        : type === 'object'
          ? this.localize('jsonObject')
          : this.localize('jsonValue'));
    const openBracket = type === 'array' ? '[' : '{';
    const closeBracket = type === 'array' ? ']' : '}';

    // Computed eagerly -- in this same synchronous call, rather than left for
    // lit-html's `repeat` directive to invoke lazily during commit -- so the
    // `ancestors.add()`/`.delete()` pair below brackets exactly the values on
    // the real recursive descent through *this* subtree, regardless of
    // whenever lit-html itself gets around to resolving the directive.
    let childRows: TemplateResult[] = [];
    if (isContainer && expanded) {
      ancestors.add(value as object);
      childRows = entries.map(([k, v]) => this.renderNode(v, [...path, k], String(k), depth + 1, search, ancestors));
      ancestors.delete(value as object);
    }

    const headRow = html`
      <div class="row" style=${indentStyle}>
        <button
          part="toggle"
          type="button"
          ?hidden=${!hasEntries}
          tabindex=${hasEntries ? nothing : -1}
          aria-hidden=${hasEntries ? nothing : 'true'}
          aria-expanded=${hasEntries ? (expanded ? 'true' : 'false') : nothing}
          aria-label=${
            hasEntries
              ? // Interpolated via the values arg (not string-concatenated) so word
                // order stays translatable -- same rationale as renderCopyButton()'s
                // "Copy {label}" above; toggleLabel is either caller data (a JSON
                // key/index) or an already-localized type noun.
                this.localize(expanded ? 'jsonCollapseLabel' : 'jsonExpandLabel', undefined, { label: toggleLabel })
              : nothing
          }
          @click=${() => hasEntries && this.toggleNode(pathKey, expanded)}
        >
          <span class="chevron">${chevronIcon()}</span>
        </button>
        ${keyLabel !== undefined
          ? html`<span
              part="key"
              ?data-match=${search.keyMatches.has(pathKey)}
              ?data-active=${!!activeMatch && activeMatch.pathKey === pathKey && activeMatch.kind === 'key'}
              aria-current=${
                activeMatch && activeMatch.pathKey === pathKey && activeMatch.kind === 'key' ? 'true' : 'false'
              }
              >${keyLabel}</span
              ><span class="colon">:</span>`
          : nothing}
        ${isCircular
          ? html`
              <span part="bracket">${openBracket}</span>
              <span part="value" data-type="circular">${this.localize('circularReference')}</span>
              <span part="bracket">${closeBracket}</span>
            `
          : isContainer
            ? html`
                <span part="bracket">${openBracket}</span>
                ${hasEntries && !expanded
                          ? html`<span class="preview">${this.previewText(type, entries.length)}</span>`
                  : nothing}
                ${!expanded ? html`<span part="bracket">${closeBracket}</span>` : nothing}
              `
            : html`<span
                part="value"
                data-type=${type}
                ?data-match=${search.valueMatches.has(pathKey)}
                ?data-active=${!!activeMatch && activeMatch.pathKey === pathKey && activeMatch.kind === 'value'}
                aria-current=${
                  activeMatch && activeMatch.pathKey === pathKey && activeMatch.kind === 'value' ? 'true' : 'false'
                }
                >${formatPrimitive(value, type)}</span
              >`}
        ${this.renderCopyButton(value, toggleLabel)}
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
      <div role="listitem">
        ${headRow}
        ${isContainer && expanded
          ? html`
              <div class="children" role="list">
                ${repeat(
                  entries,
                  ([k]) => JSON.stringify([...path, k]),
                  (_entry, i) => childRows[i],
                )}
              </div>
              <div class="row" style=${indentStyle}>
                <span class="toggle-space" aria-hidden="true"></span>
                <span part="bracket">${closeBracket}</span>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const locale = this.effectiveLocale;
    if (!this.hasUpdated || changed.has('data') || changed.has('search') || locale !== this.searchLocale) {
      this.searchLocale = locale;
      const next = this.computeSearch();
      if (!this.hasUpdated || changed.has('data')) {
        // A path with no entry in `next.paths` no longer exists anywhere in
        // the new tree, so its override has nothing left to apply to --
        // dropping it here (rather than never, as before) is what keeps a
        // long-lived instance bound to reshaping data from accumulating one
        // Map entry per distinct path ever toggled over its whole lifetime.
        let pruned: Map<string, boolean> | null = null;
        for (const key of this.expandedOverrides.keys()) {
          if (!next.paths.has(key)) {
            pruned ??= new Map(this.expandedOverrides);
            pruned.delete(key);
          }
        }
        if (pruned) this.expandedOverrides = pruned;
      }
      this.searchState = next;
      if (this.hasUpdated) {
        this.activeSearchIndex = -1;
        this.emitSearchChange();
      }
    }
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.search,
      matchCount: this.searchState.orderedMatches.length,
      activeIndex: this.activeSearchIndex,
    });
  }

  /**
   * Sets the declarative `search` property and awaits the recompute -- the resolved count is the
   * number of matches (also `searchState.orderedMatches.length` / rendered `[data-match]` spans).
   *
   * Named `runSearch()` rather than `search()` -- unlike every sibling viewer's imperative search
   * quartet (pdf/docx/csv/notebook/spreadsheet/ebook-viewer, av-player, terminal), `search` here is
   * *already* a pre-existing public `@property()` string (declarative highlighting, predating this
   * quartet) -- a method can't share a class member name with a property (Lit's reactive-property
   * machinery throws at definition time: "declared as a reactive property but it's actually declared
   * as a value on the prototype"), so the convenience method keeping the declarative `search` prop's
   * name, type, and back-compat semantics fully untouched has to be named something else.
   */
  async runSearch(query: string): Promise<number> {
    this.search = query;
    await this.updateComplete;
    return this.searchState.orderedMatches.length;
  }

  /** Advances the cursor to the next match (wrapping), scrolling it into view. Resolves `false` with no match to move to. */
  async searchNext(): Promise<boolean> {
    const total = this.searchState.orderedMatches.length;
    if (total === 0) return false;
    this.activeSearchIndex = (this.activeSearchIndex + 1) % total;
    this.emitSearchChange();
    await this.scrollActiveMatchIntoView();
    return true;
  }

  /** Moves the cursor to the previous match (wrapping), scrolling it into view. Resolves `false` with no match to move to. */
  async searchPrevious(): Promise<boolean> {
    const total = this.searchState.orderedMatches.length;
    if (total === 0) return false;
    this.activeSearchIndex = (this.activeSearchIndex - 1 + total) % total;
    this.emitSearchChange();
    await this.scrollActiveMatchIntoView();
    return true;
  }

  /** Resets `search` to `''`, clearing all matches and the cursor. */
  clearSearch(): void {
    this.search = '';
  }

  private async scrollActiveMatchIntoView(): Promise<void> {
    await this.updateComplete;
    const el = this.renderRoot.querySelector('[data-active]');
    el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }

  override render(): TemplateResult {
    return html`
      <div part="base" style=${this.maxHeight ? `--lr-json-viewer-max-height:${this.maxHeight}` : nothing}>
        ${this.copyable
          ? html`<div part="toolbar">
              <button
                part="copy-button"
                type="button"
                aria-label=${this.localize('copyJson')}
                @click=${() => this.copy(this.data)}
              >
                ${this.localize('copy')}
              </button>
            </div>`
          : nothing}
        <div part="tree" role="list">
          ${this.renderNode(this.data, [], undefined, 0, this.searchState, new WeakSet())}
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-json-viewer': LyraJsonViewer;
  }
}
