import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteCount } from '../../../internal/numbers.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { styles } from './json-viewer.styles.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import {
  writeClipboardText,
  type LyraClipboardWriteFailure,
  type LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_circularReference, LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_copyJson, LYRA_DEFAULT_jsonArray, LYRA_DEFAULT_jsonCollapseLabel, LYRA_DEFAULT_jsonCopyLabel, LYRA_DEFAULT_jsonExpandLabel, LYRA_DEFAULT_jsonItemCount, LYRA_DEFAULT_jsonKeyCount, LYRA_DEFAULT_jsonObject, LYRA_DEFAULT_jsonValue, LYRA_DEFAULT_jsonViewerLimit, LYRA_DEFAULT_viewerSearchActiveMatch } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

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
  truncated: boolean;
}

interface RenderBudget {
  remaining: number;
  truncated: boolean;
}

const MAX_JSON_NODES = 5000;
const MAX_JSON_DEPTH = 100;
// Reflection is independently bounded, but has headroom for opaque/non-enumerable own names so
// they cannot consume the smaller admitted JSON-node budget.
const MAX_JSON_SNAPSHOT_INSPECTIONS = MAX_JSON_NODES * 2;
const OMIT_JSON_SNAPSHOT = Symbol('omit-json-viewer-snapshot');

interface JsonSnapshotBudget {
  remainingNodes: number;
  remainingInspections: number;
  truncated: boolean;
}

interface JsonSnapshot {
  readonly value: unknown;
  readonly truncated: boolean;
}

const EMPTY_SEARCH: SearchState = {
  keyMatches: new Set(),
  valueMatches: new Set(),
  forceExpand: new Set(),
  paths: new Set(),
  orderedMatches: [],
  truncated: false,
};

function isArrayContainer(value: unknown): value is readonly unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

function isPlainContainer(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isArrayContainer(value);
}

/**
 * Projects the caller-owned value once through own data descriptors. Every downstream path uses
 * this frozen graph, so rendering, search, and clipboard serialization cannot invoke an accessor
 * or reread a proxy after admission. The projection preserves ordinary holes, aliases, and cycles;
 * unsafe branches and unsupported opaque leaves are omitted instead of coercing them.
 */
function snapshotJsonData(value: unknown): JsonSnapshot {
  const budget: JsonSnapshotBudget = {
    remainingNodes: MAX_JSON_NODES,
    remainingInspections: MAX_JSON_SNAPSHOT_INSPECTIONS,
    truncated: false,
  };
  const copies = new WeakMap<object, object>();
  const projected = snapshotJsonValue(value, budget, copies, 0);
  return Object.freeze({
    value: projected === OMIT_JSON_SNAPSHOT ? undefined : projected,
    truncated: budget.truncated || projected === OMIT_JSON_SNAPSHOT,
  });
}

function snapshotJsonValue(
  value: unknown,
  budget: JsonSnapshotBudget,
  copies: WeakMap<object, object>,
  depth: number,
): unknown | typeof OMIT_JSON_SNAPSHOT {
  if (budget.remainingNodes <= 0) {
    budget.truncated = true;
    return OMIT_JSON_SNAPSHOT;
  }
  budget.remainingNodes -= 1;
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }
  if (typeof value !== 'object') {
    budget.truncated = true;
    return OMIT_JSON_SNAPSHOT;
  }
  const source = value;
  const existing = copies.get(source);
  if (existing) return existing;
  const array = isArrayContainer(source);
  if (depth >= MAX_JSON_DEPTH) {
    budget.truncated = true;
    const shell: object = array ? [] : Object.create(null);
    copies.set(source, shell);
    return Object.freeze(shell);
  }
  return array
    ? snapshotJsonArray(source, budget, copies, depth)
    : snapshotJsonObject(source, budget, copies, depth);
}

function snapshotJsonArray(
  source: readonly unknown[],
  budget: JsonSnapshotBudget,
  copies: WeakMap<object, object>,
  depth: number,
): unknown | typeof OMIT_JSON_SNAPSHOT {
  const length = getOwnDataDescriptor(source, 'length');
  if (
    length === MISSING_OWN_DATA_DESCRIPTOR ||
    length === UNSAFE_OWN_DATA_DESCRIPTOR ||
    typeof length.value !== 'number' ||
    !Number.isSafeInteger(length.value) ||
    length.value < 0
  ) {
    budget.truncated = true;
    return OMIT_JSON_SNAPSHOT;
  }
  const projected: unknown[] = [];
  copies.set(source, projected);
  let retainedLength = 0;
  const count = Math.min(length.value, budget.remainingInspections);
  if (count < length.value) budget.truncated = true;
  for (let index = 0; index < count; index += 1) {
    if (budget.remainingNodes <= 0 || budget.remainingInspections <= 0) {
      budget.truncated = true;
      break;
    }
    budget.remainingInspections -= 1;
    retainedLength = index + 1;
    const descriptor = getOwnDataDescriptor(source, String(index));
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR) continue;
    if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) {
      budget.truncated = true;
      continue;
    }
    const child = snapshotJsonValue(descriptor.value, budget, copies, depth + 1);
    if (child === OMIT_JSON_SNAPSHOT) {
      budget.truncated = true;
      continue;
    }
    projected[index] = child;
  }
  projected.length = retainedLength;
  try {
    return Object.freeze(projected);
  } catch {
    copies.delete(source);
    budget.truncated = true;
    return OMIT_JSON_SNAPSHOT;
  }
}

function snapshotJsonObject(
  source: object,
  budget: JsonSnapshotBudget,
  copies: WeakMap<object, object>,
  depth: number,
): unknown | typeof OMIT_JSON_SNAPSHOT {
  const projected = Object.create(null) as Record<string, unknown>;
  copies.set(source, projected);
  let keys: string[];
  try {
    // Object.keys()/for-in resolve every key's enumerability first, which lets one hostile Proxy
    // descriptor trap abort its later valid siblings before getOwnDataDescriptor() can contain it.
    // The own-key list crosses only [[OwnPropertyKeys]]; individual descriptor reads below stay
    // bounded and independently fail closed.
    keys = Object.getOwnPropertyNames(source);
  } catch {
    copies.delete(source);
    budget.truncated = true;
    return OMIT_JSON_SNAPSHOT;
  }
  try {
    for (const key of keys) {
      if (budget.remainingInspections <= 0) {
        budget.truncated = true;
        break;
      }
      budget.remainingInspections -= 1;
      const descriptor = getOwnDataDescriptor(source, key);
      if (descriptor === MISSING_OWN_DATA_DESCRIPTOR) continue;
      if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR || !descriptor.enumerable) {
        if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) budget.truncated = true;
        continue;
      }
      if (budget.remainingNodes <= 0) {
        budget.truncated = true;
        break;
      }
      const child = snapshotJsonValue(descriptor.value, budget, copies, depth + 1);
      if (child === OMIT_JSON_SNAPSHOT) {
        budget.truncated = true;
        continue;
      }
      Object.defineProperty(projected, key, {
        value: child,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(projected);
  } catch {
    copies.delete(source);
    budget.truncated = true;
    return OMIT_JSON_SNAPSHOT;
  }
}

/** A bounded prefix of an object's own enumerable properties or an array's indices. */
function entriesOf(
  value: unknown,
  limit: number,
): {
  entries: [JsonPathSegment, unknown][];
  truncated: boolean;
  total: number;
  exact: boolean;
} {
  const entries: [JsonPathSegment, unknown][] = [];
  if (isArrayContainer(value)) {
    const length = getOwnDataDescriptor(value, 'length');
    if (
      length === MISSING_OWN_DATA_DESCRIPTOR ||
      length === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof length.value !== 'number' ||
      !Number.isSafeInteger(length.value) ||
      length.value < 0
    ) {
      return { entries, truncated: true, total: 0, exact: false };
    }
    const total = length.value;
    const count = Math.min(total, limit);
    let truncated = total > count;
    let exact = true;
    for (let index = 0; index < count; index += 1) {
      const descriptor = getOwnDataDescriptor(value, String(index));
      if (descriptor === MISSING_OWN_DATA_DESCRIPTOR) {
        // Preserve an ordinary source-index hole as the viewer's historical undefined row.
        entries.push([index, undefined]);
        continue;
      }
      if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) {
        truncated = true;
        exact = false;
        continue;
      }
      entries.push([index, descriptor.value]);
    }
    return {
      entries,
      truncated,
      total,
      exact,
    };
  }
  if (isPlainContainer(value)) {
    let truncated = false;
    let total = 0;
    let exact = true;
    let inspected = 0;
    try {
      for (const key in value) {
        inspected += 1;
        if (inspected > MAX_JSON_NODES) {
          exact = false;
          truncated = true;
          break;
        }
        const descriptor = getOwnDataDescriptor(value, key);
        if (descriptor === MISSING_OWN_DATA_DESCRIPTOR) continue;
        if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR || !descriptor.enumerable) {
          exact = false;
          truncated = true;
          continue;
        }
        total += 1;
        if (entries.length < limit) entries.push([key, descriptor.value]);
        else truncated = true;
      }
    } catch {
      exact = false;
      truncated = true;
    }
    return { entries, truncated, total, exact };
  }
  return { entries, truncated: false, total: 0, exact: true };
}

function valueType(value: unknown): JsonValueType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (isArrayContainer(value)) return 'array';
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
      if (typeof value === 'string') return JSON.stringify(value);
      try {
        return String(value);
      } catch {
        return '';
      }
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    default:
      try {
        return String(value);
      } catch {
        return '';
      }
  }
}

export interface LyraJsonViewerEventMap {
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<null>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-search-change': CustomEvent<{
    query: string;
    matchCount: number;
    matchCountExact: boolean;
    activeIndex: number;
  }>;
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
 * Imperative search-cursor changes are appended to the shared light-DOM polite announcement sink;
 * initial/reconnect state and changes while the host is accessibility-hidden are silent, and the
 * shadow tree retains only an `aria-hidden` text mirror.
 *
 * @customElement lr-json-viewer
 * @event lr-copy - Clipboard writing from the top-level or per-node action fulfilled. The frozen
 *   shared outcome detail is `{ ok: true, text }`.
 * @event lr-error - Clipboard writing failed. Bubbling, composed, and carries no detail.
 * @event lr-copy-error - Clipboard writing failed. The frozen shared outcome detail is
 *   `{ ok: false, text, reason, error }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active-match cursor
 *   changes -- from `runSearch()`/`searchNext()`/`searchPrevious()`/`clearSearch()`, or a direct
 *   `search`/`data` property write. `detail: { query, matchCount, matchCountExact, activeIndex }`;
 *   `matchCountExact=false` means the bounded count is a known lower bound.
 * @csspart base - The root scroll container; respects `max-height`.
 * @csspart toolbar - The wrapper around the top-level copy button (only rendered when `copyable`).
 * @csspart tree - The wrapper around the rendered node tree.
 * @csspart row - A single structural JSON row (opening/value rows and closing-delimiter rows).
 * @csspart key - An object property key or array index label.
 * @csspart value - A primitive value's text -- carries `data-type` (`string`/`number`/`boolean`/`null`/`undefined`, or `circular` for a self-reference marker in place of a re-visited container's subtree) for per-type coloring, `data-match` while it matches `search`, and `data-active` while it is the current `searchNext()`/`searchPrevious()` cursor position.
 * @csspart bracket - A `{`, `}`, `[`, or `]` delimiter.
 * @csspart toggle - A container node's expand/collapse button (hidden, but present for row alignment, on leaf/empty nodes).
 * @csspart copy-button - A copy-to-clipboard button -- the top-level one (in `toolbar`, labelled "Copy JSON to clipboard") or a per-node one (only rendered when `copyable`; labelled with its own key/type, e.g. "Copy age", so assistive tech can tell rows apart).
 * @csspart limit - Localized notice shown when the depth/node traversal budget truncates rendering or search.
 * @cssprop [--lr-json-viewer-max-height=none] - Cap on `[part="base"]`'s block size, past which the
 *   viewer scrolls internally. The `maxHeight` property sets this token inline on `[part="base"]`.
 * @cssprop [--lr-json-viewer-font=var(--lr-font-mono)] - Font family used for the rendered tree.
 * @cssprop [--lr-json-viewer-match-bg=var(--lr-color-warning-quiet)] - Background (and
 *   surrounding box-shadow) of a key/value that currently matches `search`.
 * @cssprop [--lr-json-viewer-row-hover-bg=var(--lr-color-brand-quiet)] - Hover background for a
 *   structural row.
 * @cssprop [--lr-json-viewer-active-outline=var(--lr-focus-ring-color)] - Outline color for the
 *   current imperative search match.
 * @cssprop [--lr-json-viewer-string-color=var(--lr-color-success)] - String value color.
 * @cssprop [--lr-json-viewer-number-color=var(--lr-color-brand)] - Number value color.
 * @cssprop [--lr-json-viewer-boolean-color=var(--lr-color-warning)] - Boolean value color.
 * @cssprop [--lr-json-viewer-null-color=var(--lr-color-text-quiet)] - Null, undefined, and
 *   circular-reference marker color.
 * @status stable
 * @since 4.0.0
 */
export class LyraJsonViewer extends LyraElement<LyraJsonViewerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    circularReference: LYRA_DEFAULT_circularReference,
    copied: LYRA_DEFAULT_copied,
    copy: LYRA_DEFAULT_copy,
    copyFailed: LYRA_DEFAULT_copyFailed,
    copyJson: LYRA_DEFAULT_copyJson,
    jsonArray: LYRA_DEFAULT_jsonArray,
    jsonCollapseLabel: LYRA_DEFAULT_jsonCollapseLabel,
    jsonCopyLabel: LYRA_DEFAULT_jsonCopyLabel,
    jsonExpandLabel: LYRA_DEFAULT_jsonExpandLabel,
    jsonItemCount: LYRA_DEFAULT_jsonItemCount,
    jsonKeyCount: LYRA_DEFAULT_jsonKeyCount,
    jsonObject: LYRA_DEFAULT_jsonObject,
    jsonValue: LYRA_DEFAULT_jsonValue,
    jsonViewerLimit: LYRA_DEFAULT_jsonViewerLimit,
    viewerSearchActiveMatch: LYRA_DEFAULT_viewerSearchActiveMatch,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  /** The value to render. Any JSON-serializable value, plus `undefined`. */
  @property({ attribute: false }) data: unknown;
  /** Nodes at or beyond this nesting depth (root = 0) start collapsed. Omit/undefined: nothing auto-collapses. */
  @property({ type: Number, attribute: 'collapsed-depth' })
  collapsedDepth?: number;
  /** A CSS length (e.g. `"20rem"`); once set, the viewer scrolls internally past this height
   * instead of growing the page. Invalid values are ignored. */
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
  /** Descriptor-safe, frozen data graph admitted on the most recent `data` write. */
  private dataSnapshot: unknown = undefined;
  private dataSnapshotTruncated = false;
  private searchAnnouncementSink?: AnnouncementSink;
  private searchAnnouncementsArmed = false;
  private searchAnnouncementGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.searchAnnouncementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.searchAnnouncementsArmed = false;
    const generation = ++this.searchAnnouncementGeneration;
    // A cursor move initiated while detached may leave its Lit update pending until this
    // connection. Let that update settle as reconnect baseline before later moves become live.
    void this.updateComplete.then(() => {
      if (this.isConnected && generation === this.searchAnnouncementGeneration) {
        this.searchAnnouncementsArmed = true;
      }
    });
  }

  override disconnectedCallback(): void {
    this.searchAnnouncementGeneration += 1;
    this.searchAnnouncementSink?.release();
    this.searchAnnouncementSink = undefined;
    this.searchAnnouncementsArmed = false;
    super.disconnectedCallback();
  }

  /** `collapsedDepth`, normalized to a finite non-negative integer when set -- `undefined`
   *  (nothing auto-collapses) is left as-is, since it's a meaningful, intentional value, not an
   *  invalid one. A raw `NaN` (e.g. an invalid `collapsed-depth` attribute) would otherwise make
   *  every `depth >= collapsedDepth` comparison false, silently disabling auto-collapse instead of
   *  falling back to a sane depth. */
  private get safeCollapsedDepth(): number | undefined {
    return this.collapsedDepth === undefined ? undefined : finiteCount(this.collapsedDepth);
  }

  private previewText(type: 'object' | 'array', count: number, exact = true): string {
    // {count} is interpolated via the values arg (not string-concatenated) --
    // same pluralized-message pattern as toolCount, so the count's position
    // relative to the noun stays translatable rather than fixed to English's
    // "number space noun" order. `count` carries the locale-grouped string for
    // display; `pluralCount` carries the raw number that selects the category.
    const formattedCount = getNumberFormat(this.effectiveLocale).format(count);
    const localizedCount = exact ? formattedCount : `≥${formattedCount}`;
    if (type === 'array') {
      return this.localize('jsonItemCount', undefined, {
        count: localizedCount,
        pluralCount: count,
      });
    }
    return this.localize('jsonKeyCount', undefined, {
      count: localizedCount,
      pluralCount: count,
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

  private reportCopyFailure(outcome: LyraClipboardWriteFailure): void {
    this.searchAnnouncementSink?.announce(this.localize('copyFailed'));
    this.emit('lr-error');
    this.emit('lr-copy-error', outcome);
  }

  private async copy(value: unknown): Promise<void> {
    let text = '';
    try {
      text = value === undefined ? 'undefined' : this.stringifyForClipboard(value);
    } catch (error) {
      if (this.isConnected) {
        this.reportCopyFailure(Object.freeze({ ok: false, text, reason: 'failed', error }));
      }
      return;
    }
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    const outcome = await writeClipboardText(owner, text);
    if (!this.isConnected || this.ownerDocument.defaultView !== owner) return;
    if (!outcome.ok) {
      this.reportCopyFailure(outcome);
      return;
    }
    this.searchAnnouncementSink?.announce(this.localize('copied'));
    this.emit('lr-copy', outcome);
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
    const serialized = JSON.stringify(
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
    return serialized ?? formatPrimitive(value, valueType(value));
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
    let truncated = this.dataSnapshotTruncated;

    const markAncestors = (path: JsonPathSegment[]): void => {
      for (let i = path.length - 1; i >= 0; i--) forceExpand.add(JSON.stringify(path.slice(0, i)));
    };

    type WalkFrame =
      | {
          kind: 'visit';
          value: unknown;
          path: JsonPathSegment[];
          keyLabel?: string;
        }
      | { kind: 'leave'; value: object };
    const stack: WalkFrame[] = [{ kind: 'visit', value: this.dataSnapshot, path: [] }];
    let visited = 0;

    while (stack.length > 0) {
      const frame = stack.pop()!;
      if (frame.kind === 'leave') {
        ancestors.delete(frame.value);
        continue;
      }
      if (visited >= MAX_JSON_NODES) {
        truncated = true;
        break;
      }
      visited += 1;
      const { value, path, keyLabel } = frame;
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
        const available = Math.max(0, MAX_JSON_NODES - visited);
        const { entries, truncated: entriesTruncated } = entriesOf(value, available);
        if (entriesTruncated) truncated = true;
        if (path.length >= MAX_JSON_DEPTH) {
          if (entries.length > 0) truncated = true;
          continue;
        }
        ancestors.add(value as object);
        stack.push({ kind: 'leave', value: value as object });
        for (let index = entries.length - 1; index >= 0; index -= 1) {
          const [key, child] = entries[index]!;
          stack.push({
            kind: 'visit',
            value: child,
            path: [...path, key],
            keyLabel: String(key),
          });
        }
      }
    }

    return {
      keyMatches,
      valueMatches,
      forceExpand,
      paths,
      orderedMatches,
      truncated,
    };
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
        aria-label=${this.localize('jsonCopyLabel', undefined, {
          label: resolvedLabel,
        })}
        @click=${(e: Event) => {
          e.stopPropagation();
          void this.copy(value);
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
    budget: RenderBudget,
  ): TemplateResult {
    budget.remaining -= 1;
    const pathKey = JSON.stringify(path);
    const type = valueType(value);
    // A container value already on the current recursion path (i.e. `data`
    // self-references, directly or through a longer cycle) gets rendered as
    // a leaf marker instead of recursing again -- recursing would blow the
    // stack instead of degrading gracefully.
    const isCircular = (type === 'object' || type === 'array') && ancestors.has(value as object);
    const isContainer = (type === 'object' || type === 'array') && !isCircular;
    const entrySlice = isContainer
      ? entriesOf(value, Math.max(0, budget.remaining))
      : { entries: [], truncated: false, total: 0, exact: true };
    const entries = entrySlice.entries;
    if (entrySlice.truncated) budget.truncated = true;
    const entryCountExact = entrySlice.exact && !this.dataSnapshotTruncated;
    const hasEntries = entries.length > 0;
    const withinDepthBudget = depth < MAX_JSON_DEPTH;
    if (hasEntries && !withinDepthBudget) budget.truncated = true;
    const toggleable = hasEntries && withinDepthBudget;
    const expanded = hasEntries && withinDepthBudget && this.isExpanded(pathKey, depth, search.forceExpand);
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
    const renderedEntries: [JsonPathSegment, unknown][] = [];
    if (isContainer && expanded) {
      ancestors.add(value as object);
      for (const [key, child] of entries) {
        if (budget.remaining <= 0) {
          budget.truncated = true;
          break;
        }
        renderedEntries.push([key, child]);
        childRows.push(this.renderNode(child, [...path, key], String(key), depth + 1, search, ancestors, budget));
      }
      ancestors.delete(value as object);
    }

    const headRow = html`
      <div class="row" part="row" style=${indentStyle}>
        <button
          part="toggle"
          type="button"
          ?hidden=${!toggleable}
          tabindex=${toggleable ? nothing : -1}
          aria-hidden=${toggleable ? nothing : 'true'}
          aria-expanded=${toggleable ? (expanded ? 'true' : 'false') : nothing}
          aria-label=${toggleable
            ? // Interpolated via the values arg (not string-concatenated) so word
              // order stays translatable -- same rationale as renderCopyButton()'s
              // "Copy {label}" above; toggleLabel is either caller data (a JSON
              // key/index) or an already-localized type noun.
              this.localize(expanded ? 'jsonCollapseLabel' : 'jsonExpandLabel', undefined, { label: toggleLabel })
            : nothing}
          @click=${() => toggleable && this.toggleNode(pathKey, expanded)}
        >
          <span class="chevron">${chevronIcon()}</span>
        </button>
        ${keyLabel !== undefined
          ? html`<span
                part="key"
                ?data-match=${search.keyMatches.has(pathKey)}
                ?data-active=${!!activeMatch && activeMatch.pathKey === pathKey && activeMatch.kind === 'key'}
                aria-current=${activeMatch && activeMatch.pathKey === pathKey && activeMatch.kind === 'key'
                  ? 'true'
                  : 'false'}
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
                ? html`<span class="preview">${this.previewText(type, entrySlice.total, entryCountExact)}</span>`
                : nothing}
              ${!expanded ? html`<span part="bracket">${closeBracket}</span>` : nothing}
            `
          : html`<span
              part="value"
              data-type=${type}
              ?data-match=${search.valueMatches.has(pathKey)}
              ?data-active=${!!activeMatch && activeMatch.pathKey === pathKey && activeMatch.kind === 'value'}
              aria-current=${activeMatch && activeMatch.pathKey === pathKey && activeMatch.kind === 'value'
                ? 'true'
                : 'false'}
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
                  renderedEntries,
                  ([k]) => JSON.stringify([...path, k]),
                  (_entry, i) => childRows[i],
                )}
              </div>
              <div class="row" part="row" style=${indentStyle}>
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
    if (!this.hasUpdated || changed.has('data')) {
      const snapshot = snapshotJsonData(this.data);
      this.dataSnapshot = snapshot.value;
      this.dataSnapshotTruncated = snapshot.truncated;
    }
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

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.searchAnnouncementsArmed && changed.has('activeSearchIndex')) {
      this.searchAnnouncementSink?.announce(this.activeSearchAnnouncement());
    }
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.search,
      matchCount: this.searchState.orderedMatches.length,
      matchCountExact: !this.searchState.truncated,
      activeIndex: this.activeSearchIndex,
    });
  }

  private revealActiveMatch(): void {
    const match = this.searchState.orderedMatches[this.activeSearchIndex];
    if (!match) return;
    let path: unknown;
    try {
      path = JSON.parse(match.pathKey);
    } catch {
      return;
    }
    if (!Array.isArray(path)) return;
    let next: Map<string, boolean> | null = null;
    for (let depth = 0; depth < path.length; depth++) {
      const ancestorKey = JSON.stringify(path.slice(0, depth));
      if (this.expandedOverrides.get(ancestorKey) === true) continue;
      next ??= new Map(this.expandedOverrides);
      next.set(ancestorKey, true);
    }
    if (next) this.expandedOverrides = next;
  }

  private activeSearchAnnouncement(): string {
    const total = this.searchState.orderedMatches.length;
    if (this.activeSearchIndex < 0 || total === 0) return '';
    const numberFormat = getNumberFormat(this.effectiveLocale);
    return this.localize('viewerSearchActiveMatch', undefined, {
      current: numberFormat.format(this.activeSearchIndex + 1),
      total: this.searchState.truncated ? `≥${numberFormat.format(total)}` : numberFormat.format(total),
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

  /** Advances the cursor to the next match (wrapping), revealing collapsed ancestors and
   *  scrolling the selected match into view. Resolves `false` with no match to move to. */
  async searchNext(): Promise<boolean> {
    const total = this.searchState.orderedMatches.length;
    if (total === 0) return false;
    this.activeSearchIndex = (this.activeSearchIndex + 1) % total;
    this.revealActiveMatch();
    this.emitSearchChange();
    await this.scrollActiveMatchIntoView();
    return true;
  }

  /** Moves the cursor to the previous match (wrapping), revealing collapsed ancestors and
   *  scrolling the selected match into view. Resolves `false` with no match to move to. */
  async searchPrevious(): Promise<boolean> {
    const total = this.searchState.orderedMatches.length;
    if (total === 0) return false;
    this.activeSearchIndex = (this.activeSearchIndex - 1 + total) % total;
    this.revealActiveMatch();
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
    el?.scrollIntoView({
      behavior: prefersReducedMotion(this.ownerDocument.defaultView) ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }

  override render(): TemplateResult {
    const budget: RenderBudget = {
      remaining: MAX_JSON_NODES,
      truncated: false,
    };
    const tree = this.renderNode(this.dataSnapshot, [], undefined, 0, this.searchState, new WeakSet(), budget);
    const limited = budget.truncated || this.searchState.truncated || this.dataSnapshotTruncated;
    return html`
      <div
        part="base"
        style=${sanitizeCssLength(this.maxHeight)
          ? styleMap({
              '--lr-json-viewer-max-height': sanitizeCssLength(this.maxHeight)!,
            })
          : nothing}
      >
        ${this.copyable
          ? html`<div part="toolbar">
              <button
                part="copy-button"
                type="button"
                aria-label=${this.localize('copyJson')}
                @click=${() => void this.copy(this.dataSnapshot)}
              >
                ${this.localize('copy')}
              </button>
            </div>`
          : nothing}
        <div part="tree" role="list" aria-label=${hostAriaLabel(this) ?? nothing}>${tree}</div>
        ${limited
          ? html`<p part="limit">${this.localize('jsonViewerLimit', undefined, {
              count: getNumberFormat(this.effectiveLocale).format(MAX_JSON_NODES),
              depth: getNumberFormat(this.effectiveLocale).format(MAX_JSON_DEPTH),
            })}</p>`
          : nothing}
        <span class="sr-only" aria-hidden="true">${this.activeSearchAnnouncement()}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-json-viewer': LyraJsonViewer;
  }
}
