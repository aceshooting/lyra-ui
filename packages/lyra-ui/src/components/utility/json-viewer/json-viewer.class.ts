import { prefersReducedMotion } from '../../../internal/motion.js';
import { foldSearchText, prepareNeedle } from '../../../internal/search-haystack.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { ref } from 'lit/directives/ref.js';
import { lyraLocaleCatalogVersion } from '../../../internal/localization-runtime.js';
import { styleMap } from 'lit/directives/style-map.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { makeScrollRegionFocusable, revealWithinScrollParent } from '../../../internal/scroll-region.js';
import { finiteCount } from '../../../internal/numbers.js';
import { RovingTreeFocus } from '../../../internal/roving-tree-focus.js';
import { literalSetConverter, blankNumberConverter } from '../../../internal/converters.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import { viewerSearchDetail } from '../../../internal/viewer-search.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { styles } from './json-viewer.styles.js';
import type { LyraHierarchySource, LyraHierarchyQuery, LyraInspectionNode } from '../../../data-sources.js';
import { HierarchySourceController, hierarchyField } from '../../../internal/hierarchy-source-controller.js';
import { DeferredTeardown } from '../../../internal/deferred-teardown.js';
import {
  hasHierarchySourceCopy,
  hierarchyCopyScope,
  HierarchySourceCopyController,
  HierarchySourceSearchController,
} from '../../../internal/hierarchy-source-search.js';
import { applyHierarchySourceEffects, captureHierarchySourceEffects, hierarchySourceSummary } from '../../../internal/hierarchy-summary-source.js';
import { hierarchySourceView } from '../../../internal/hierarchy-source-view.js';
import { hierarchySourceStyles } from '../../../internal/hierarchy-source-view.styles.js';
export type JsonViewerTreeSource = LyraHierarchySource<LyraInspectionNode, LyraHierarchyQuery>;
const INSPECTION_KINDS = new Set(['object', 'array', 'scalar', 'element', 'attribute', 'text', 'comment', 'processing-instruction']);

import { sanitizeCssLength } from '../../../internal/safe-css.js';
import {
  writeClipboardText,
  type LyraClipboardWriteOutcome,
  type LyraClipboardWriteFailure,
  type LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
import { copyOutcome, KeyedCopyFeedback, reportCopyOutcome } from '../../../internal/record-copy-feedback.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_countAtLeast, LYRA_DEFAULT_expand, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData, LYRA_DEFAULT_retry, LYRA_DEFAULT_sourceSearchUnavailable, LYRA_DEFAULT_treeSourceError, LYRA_DEFAULT_treeSourceSummary, LYRA_DEFAULT_viewerSearchActiveMatch, LYRA_DEFAULT_viewerSearchMatchCount, LYRA_DEFAULT_viewerSearchNoMatches } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_circularReference, LYRA_DEFAULT_copyJson, LYRA_DEFAULT_jsonArray, LYRA_DEFAULT_jsonCopyLabel, LYRA_DEFAULT_jsonItemCount, LYRA_DEFAULT_jsonKeyCount, LYRA_DEFAULT_jsonObject, LYRA_DEFAULT_jsonToggleLabel, LYRA_DEFAULT_jsonValue, LYRA_DEFAULT_jsonViewerLabel, LYRA_DEFAULT_jsonViewerLimit } from '../../../internal/default-strings/utility.generated.js';
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
   * regardless of whether `query` is set, so `expandedOverrides` can be
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
const OMIT_JSON_SNAPSHOT = Symbol('omit-json-viewer-snapshot');

interface JsonSnapshotBudget {
  remainingNodes: number;
  remainingInspections: number;
  truncated: boolean;
}

type JsonSnapshotValue = null | undefined | string | number | boolean | bigint |
  readonly JsonSnapshotValue[] | JsonSnapshotObject;

interface JsonSnapshotObject {
  readonly [key: string]: JsonSnapshotValue;
}

type JsonSnapshotContainer = JsonSnapshotObject | JsonSnapshotValue[];

interface JsonSnapshot {
  readonly value: JsonSnapshotValue;
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

function isSnapshotArray(value: JsonSnapshotValue): value is readonly JsonSnapshotValue[] {
  return Array.isArray(value);
}

/**
 * Projects the caller-owned value once through own data descriptors. Every downstream path uses
 * this frozen graph, so rendering, search, and clipboard serialization cannot invoke an accessor
 * or reread a proxy after admission. The projection preserves ordinary holes, aliases, and cycles;
 * unsafe branches and unsupported opaque leaves are omitted instead of coercing them.
 */
function snapshotJsonData(value: unknown, maxNodes: number): JsonSnapshot {
  const budget: JsonSnapshotBudget = {
    remainingNodes: maxNodes,
    remainingInspections: maxNodes * 2,
    truncated: false,
  };
  const copies = new WeakMap<object, JsonSnapshotContainer>();
  const projected = snapshotJsonValue(value, budget, copies, 0);
  return Object.freeze({
    value: projected === OMIT_JSON_SNAPSHOT ? undefined : projected,
    truncated: budget.truncated || projected === OMIT_JSON_SNAPSHOT,
  });
}

function snapshotJsonValue(
  value: unknown,
  budget: JsonSnapshotBudget,
  copies: WeakMap<object, JsonSnapshotContainer>,
  depth: number,
): JsonSnapshotValue | typeof OMIT_JSON_SNAPSHOT {
  // Callers admit a value only while `remainingNodes` is positive (`effectiveMaxNodes` is at least 1).
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
    const shell: JsonSnapshotContainer = array ? [] : Object.create(null);
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
  copies: WeakMap<object, JsonSnapshotContainer>,
  depth: number,
): JsonSnapshotValue | typeof OMIT_JSON_SNAPSHOT {
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
  const projected: JsonSnapshotValue[] = [];
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
  return Object.freeze(projected);
}

function snapshotJsonObject(
  source: object,
  budget: JsonSnapshotBudget,
  copies: WeakMap<object, JsonSnapshotContainer>,
  depth: number,
): JsonSnapshotValue | typeof OMIT_JSON_SNAPSHOT {
  const projected = Object.create(null) as Record<string, JsonSnapshotValue>;
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

/** A bounded prefix of the owned snapshot; source descriptors were checked at admission. */
function entriesOf(
  value: JsonSnapshotValue,
  limit: number,
): {
  entries: [JsonPathSegment, JsonSnapshotValue][];
  truncated: boolean;
  total: number;
  exact: boolean;
} {
  const entries: [JsonPathSegment, JsonSnapshotValue][] = [];
  if (isSnapshotArray(value)) {
    const total = value.length;
    const count = Math.min(total, limit);
    for (let index = 0; index < count; index += 1) {
      // Frozen arrays still inherit Array.prototype. A hole must not read an inherited getter.
      entries.push([index, Object.hasOwn(value, index) ? value[index] : undefined]);
    }
    return { entries, truncated: total > count, total, exact: true };
  }
  // Only containers reach this helper, so anything that is not an array is an owned record.
  const record = value as Record<string, JsonSnapshotValue>;
  let total = 0;
  for (const key in record) {
    total += 1;
    if (entries.length < limit) entries.push([key, record[key]!]);
  }
  return { entries, truncated: total > entries.length, total, exact: true };
}

function valueType(value: JsonSnapshotValue): JsonValueType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (isSnapshotArray(value)) return 'array';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return t;
  if (t === 'object') return 'object';
  // BigInt is admitted and displayed as its decimal string.
  return 'string';
}

/** How a scalar row places its key and value; see `LyraJsonViewer.layout`. */
export type LyraJsonViewerLayout = 'auto' | 'inline' | 'stacked';

const JSON_VIEWER_LAYOUT = literalSetConverter<LyraJsonViewerLayout>(['auto', 'inline', 'stacked'], 'auto');

/** Positions right after a key separator, or between a lower-case letter and an upper-case one. */
const KEY_BREAK_POINT = /(?<=[_\-./:@])(?=.)|(?<=\p{Ll})(?=\p{Lu})/u;

/**
 * A key label with a `<wbr>` line-break opportunity after each separator and at each camelCase
 * hump, so a long key such as `monthly_contribution_amount` wraps between its words rather than
 * mid-word. `overflow-wrap: anywhere` stays the last resort for a single overlong segment. The
 * text content, and with it search and copy, is unchanged.
 */
function keyWithBreaks(label: string): unknown {
  const segments = label.split(KEY_BREAK_POINT);
  if (segments.length < 2) return label;
  return segments.map((segment, index) => (index === 0 ? segment : html`<wbr>${segment}`));
}

function formatPrimitive(value: JsonSnapshotValue, type: JsonValueType): string {
  if (type === 'string' && typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

export interface LyraJsonViewerEventMap {
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<null>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
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
 * streaming tool result reassigned as a fresh object per patch.
 * Imperative search-cursor changes are appended to the shared light-DOM polite announcement sink;
 * initial/reconnect state and changes while the host is accessibility-hidden are silent, and the
 * shadow tree retains only an `aria-hidden` text mirror.
 *
 * Property-only treeSource displays a complete provider hierarchy without admitting data. Source
 * rows use own-descriptor closed inspection records (65,536 units per field); the shared cache,
 * staging, focused row and projection state share a 2,000,000-unit envelope. Over-budget records
 * fail closed. Source search counts global nodes, not separate key/value occurrences, and retains
 * at most 10,000 hits regardless of maxNodes. Partial or unavailable search is never exact.
 * Provider copy returns a complete node/subtree/document within 25 MiB UTF-8; mounted rows are
 * never serialized as a substitute. maxHeight constrains the source scroller; source expansion is
 * provider-owned. Removing treeSource restores the current data value.
 *
 * Keyboard: the data tree is one Tab stop (the last focused control, else the first). ArrowUp and
 * ArrowDown move between rows, keeping to the same kind of control where the row has one;
 * ArrowLeft and ArrowRight move between a row's toggle and copy button (mirrored under RTL); Home
 * and End reach the first and last row. Enter and Space activate the focused button.
 *
 * @customElement lr-json-viewer
 * @event lr-copy - Clipboard writing from the top-level or per-node action fulfilled. The frozen
 *   shared outcome detail is `{ ok: true, text }`.
 * @event lr-error - Clipboard writing failed. Bubbling, composed, and carries no detail.
 * @event lr-copy-error - Clipboard writing failed. The frozen shared outcome detail is
 *   `{ ok: false, text, reason, error }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active-match cursor
 *   changes -- from `runSearch()`/`searchNext()`/`searchPrevious()`/`clearSearch()`, or a direct
 *   `query`/`data` property write. `detail: { query, matchCount, matchCountExact, activeIndex }`;
 *   `matchCountExact=false` means the bounded count is a known lower bound.
 * @cssprop --lr-json-viewer-toggle-hover-bg - Hover fill of the toggle control.
 * @cssprop --lr-json-viewer-toggle-hover-color - Hover text color of the toggle control.
 * @cssprop --lr-json-viewer-toggle-active-bg - Active fill of the toggle control.
 * @cssprop --lr-json-viewer-toggle-active-color - Active text color of the toggle control.
 * @cssprop --lr-json-viewer-copy-hover-bg - Hover fill of the copy control.
 * @cssprop --lr-json-viewer-copy-hover-color - Hover text color of the copy control.
 * @cssprop --lr-json-viewer-copy-active-bg - Active fill of the copy control.
 * @cssprop --lr-json-viewer-copy-active-color - Active text color of the copy control.
 * @csspart base - The root scroll container; respects `max-height`.
 * @csspart toolbar - The wrapper around the top-level copy button (only rendered when `copyable`).
 * @csspart tree - The wrapper around the rendered node tree.
 * @csspart row - A single structural JSON row (opening/value rows and closing-delimiter rows).
 * @csspart key - An object property key or array index label.
 * @csspart value - A primitive value's text -- carries `data-type` (`string`/`number`/`boolean`/`null`/`undefined`, or `circular` for a self-reference marker in place of a re-visited container's subtree) for per-type coloring, `data-match` while it matches `query`, and `data-active` while it is the current `searchNext()`/`searchPrevious()` cursor position.
 * @csspart bracket - A `{`, `}`, `[`, or `]` delimiter.
 * @csspart toggle - A container node's expand/collapse button (hidden, but present for row alignment, on leaf/empty nodes),
 *   named `Toggle {label}` (`jsonToggleLabel`) in both states while `aria-expanded` reports the state.
 * @csspart copy-button - A copy-to-clipboard button -- the top-level one (in `toolbar`, labelled "Copy JSON to clipboard") or a per-node one (only rendered when `copyable`; labelled with its own key/type, e.g. "Copy age", so assistive tech can tell rows apart).
 * @csspart source-list - Source-only bounded virtual scroller.
 * @csspart source-row - Source-only flat tree item with logical hierarchy metadata.
 * @csspart source-toggle - Source-only expand/collapse or retry action.
 * @csspart source-label - Source-only inspection content with key/value/copy-button parts.
 * @csspart source-status - Source-only loading, empty, and full-source count status.
 * @csspart source-error - Source-only projection or row admission failure.
 * @csspart search-status - Unavailable or partial global source search status.
 * @csspart limit - Localized notice shown when the depth/node traversal budget truncates rendering or search.
 * @cssprop [--lr-json-viewer-max-height=none] - Cap on `[part="base"]`'s block size, past which the
 *   viewer scrolls internally. The `maxHeight` property sets this token inline on `[part="base"]`.
 * @cssprop [--lr-json-viewer-font=var(--lr-font-mono)] - Font family used for the rendered tree.
 * @cssprop [--lr-json-viewer-match-bg=var(--lr-color-warning-quiet)] - Background (and
 *   surrounding box-shadow) of a key/value that currently matches `query`.
 * @cssprop [--lr-json-viewer-row-hover-bg=var(--lr-color-brand-quiet)] - Hover background for a
 *   structural row.
 * @cssprop [--lr-json-viewer-active-outline=var(--lr-focus-ring-color)] - Outline color for the
 *   current imperative search match.
 * @cssprop [--lr-json-viewer-string-color=var(--lr-color-success)] - String value color.
 * @cssprop [--lr-json-viewer-number-color=var(--lr-color-brand)] - Number value color.
 * @cssprop [--lr-json-viewer-boolean-color=var(--lr-color-warning)] - Boolean value color.
 * @cssprop [--lr-json-viewer-null-color=var(--lr-color-text-quiet)] - Null, undefined, and
 *   circular-reference marker color.
 * @cssprop --lr-icon-button-bg - Resting background of the icon-only action buttons.
 * @cssprop --lr-icon-button-border - Resting border of the icon-only action buttons.
 * @cssprop --lr-icon-button-color - Resting foreground of the icon-only action buttons.
 * @cssprop --lr-icon-button-radius - Corner radius of the icon-only action buttons.
 * @cssprop --lr-icon-button-bg-hover - Hover background of the icon-only action buttons.
 * @cssprop --lr-icon-button-bg-active - Pressed background of the icon-only action buttons.
 * @cssprop --lr-icon-button-border-hover - Hover border of the icon-only action buttons.
 * @cssprop --lr-icon-button-border-active - Pressed border of the icon-only action buttons.
 * @cssprop --lr-icon-button-color-hover - Hover foreground of the icon-only action buttons.
 * @cssprop --lr-icon-button-color-active - Pressed foreground of the icon-only action buttons.
 * @status stable
 * @since 4.0.0
 */
export class LyraJsonViewer extends LyraElement<LyraJsonViewerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    circularReference: LYRA_DEFAULT_circularReference,
    collapse: LYRA_DEFAULT_collapse,
    copied: LYRA_DEFAULT_copied,
    copy: LYRA_DEFAULT_copy,
    copyFailed: LYRA_DEFAULT_copyFailed,
    copyJson: LYRA_DEFAULT_copyJson,
    countAtLeast: LYRA_DEFAULT_countAtLeast,
    expand: LYRA_DEFAULT_expand,
    jsonArray: LYRA_DEFAULT_jsonArray,
    jsonCopyLabel: LYRA_DEFAULT_jsonCopyLabel,
    jsonItemCount: LYRA_DEFAULT_jsonItemCount,
    jsonKeyCount: LYRA_DEFAULT_jsonKeyCount,
    jsonObject: LYRA_DEFAULT_jsonObject,
    jsonToggleLabel: LYRA_DEFAULT_jsonToggleLabel,
    jsonValue: LYRA_DEFAULT_jsonValue,
    jsonViewerLabel: LYRA_DEFAULT_jsonViewerLabel,
    jsonViewerLimit: LYRA_DEFAULT_jsonViewerLimit,
    loading: LYRA_DEFAULT_loading,
    noData: LYRA_DEFAULT_noData,
    retry: LYRA_DEFAULT_retry,
    sourceSearchUnavailable: LYRA_DEFAULT_sourceSearchUnavailable,
    treeSourceError: LYRA_DEFAULT_treeSourceError,
    treeSourceSummary: LYRA_DEFAULT_treeSourceSummary,
    viewerSearchActiveMatch: LYRA_DEFAULT_viewerSearchActiveMatch,
    viewerSearchMatchCount: LYRA_DEFAULT_viewerSearchMatchCount,
    viewerSearchNoMatches: LYRA_DEFAULT_viewerSearchNoMatches,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, hierarchySourceStyles, styles, srOnly];
  private _treeSource?: JsonViewerTreeSource;
  private sourceMode = false;
  private copyIntent = 0;
  private sourceBinding?: { source: JsonViewerTreeSource | undefined; query: string; locale: string };
  private sourceAnnouncement?: string;
  private readonly hierarchy = new HierarchySourceController<LyraInspectionNode>(this, {
    normalize: (value, key) => this.normalizeSourceNode(value, key),
    onChange: () => this.requestUpdate('sourceState', null), accepted: () => {}, deferDisconnect: true,
    payload: { maxUnits: 2_000_000, maxRowUnits: 327_702,
      unitsOf: node => node.name.length + node.path.length + (node.value?.length ?? 0) + node.kind.length },
  });

  private readonly sourceSearch = new HierarchySourceSearchController({
    host: this,
    control: this.hierarchy,
    source: () => this.treeSource,
    query: () => this.query,
    cursor: () => this.activeSearchIndex,
    setCursor: (index) => { this.activeSearchIndex = index; },
    changed: () => this.requestUpdate('sourceSearchResult', null),
    emitChange: () => this.emitSearchChange(),
  });
  private readonly sourceCopy = new HierarchySourceCopyController({
    host: this,
    control: this.hierarchy,
    source: () => this.treeSource,
    sinks: {
      clearFeedback: () => this.copyFeedback.clear(),
      feedback: (key, ok) => this.copyFeedback.show(key, ok),
      message: (ok) => this.localize(ok ? 'copied' : 'copyFailed'),
      announce: (message) => this.searchAnnouncementSink.announcePolite(message),
      emit: (name, detail) => this.emit(name, detail ?? null),
    },
  });

  /** Whole-source inspection provider. Takes display precedence over data; maxNodes and expandDepth
   * apply only to legacy data. Reassign, including the same identity, or requestUpdate() to refresh.
   * Source search returns at most 10,000 global node hits, independent of maxNodes.
   * @default undefined */
  @property({ attribute: false })
  get treeSource(): JsonViewerTreeSource | undefined { return this._treeSource; }
  set treeSource(value: JsonViewerTreeSource | undefined) {
    const previous = this._treeSource;
    this._treeSource = value;
    this.invalidateSourceSearch();
    this.syncSource(true);
    this.requestUpdate('treeSource', previous);
  }

  /** Reveals and focuses an exact provider key; compact keys can address arbitrarily deep nodes.
   * Resolves false when absent, superseded, or no provider is active. */
  revealSourceKey(key: string): Promise<boolean> {
    this.sourceSearch.supersedeSteps();
    return this.treeSource === undefined ? Promise.resolve(false) : this.hierarchy.reveal(key);
  }
  private syncSource(force = false): void {
    if (!this.hierarchy) return;
    const source = this.treeSource;
    const query = this.query ?? '';
    const locale = this.effectiveLocale;
    const binding = this.sourceBinding;
    if (source === undefined && !this.sourceMode && binding?.source === undefined) return;
    if (!force && binding && binding.source === source && binding.query === query && binding.locale === locale) return;
    this.invalidateSourceSearch();
    this.hierarchy.update(source, locale, force, { search: query, hiddenKinds: [] });
    if (source === this.treeSource && query === (this.query ?? '') && locale === this.effectiveLocale)
      this.sourceBinding = { source, query, locale };
  }
  private normalizeSourceNode(value: unknown, key: string): LyraInspectionNode {
    const name = hierarchyField(value, 'name');
    const path = hierarchyField(value, 'path');
    const kind = hierarchyField(value, 'kind');
    const text = hierarchyField(value, 'value');
    if (typeof name !== 'string' || name.length > 65_536 || typeof path !== 'string' || path.length > 65_536 || path !== key ||
      typeof kind !== 'string' || !INSPECTION_KINDS.has(kind) || (text !== undefined && (typeof text !== 'string' || text.length > 65_536)))
      throw new TypeError('Invalid inspection node');
    return Object.freeze({ name, path, kind: kind as LyraInspectionNode['kind'], ...(text === undefined ? {} : { value: text as string }) });
  }
  private invalidateSourceSearch(): void {
    this.sourceSearch?.invalidate();
    this.sourceCopy?.invalidate();
    this.copyIntent = (this.copyIntent ?? 0) + 1;
    if (this.activeSearchIndex !== undefined && (this._treeSource !== undefined || this.sourceMode)) this.activeSearchIndex = -1;
    this.copyFeedback?.clear();
  }
  private sourceSummary(): string {
    const summary = hierarchySourceSummary(this.hierarchy.projection, this.effectiveLocale);
    return summary ? this.localize('treeSourceSummary', undefined, summary) : '';
  }
  private sourceCopyButton(node?: LyraInspectionNode): TemplateResult | typeof nothing {
    if (!this.copyable || !hasHierarchySourceCopy(() => this.treeSource)) return nothing;
    const source = this.treeSource;
    const epoch = this.hierarchy.epoch;
    const key = node?.path ?? null;
    const projection = this.hierarchy.projection;
    const label = node ? this.localize('jsonCopyLabel', undefined, { label: node.name }) : this.localize('copyJson');
    return html`<button part="copy-button" type="button" aria-label=${this.copyLabel(key ?? 'toolbar', label)}
      @keydown=${(event: KeyboardEvent) => event.stopPropagation()}
      @click=${(event: Event) => {
        event.stopPropagation();
        const button = event.currentTarget as HTMLButtonElement;
        if (button.isConnected && button.getRootNode() === this.renderRoot && !this.hierarchy.loading &&
          projection === this.hierarchy.projection && source === this.treeSource && epoch === this.hierarchy.epoch)
          void this.sourceCopy.copy(key, hierarchyCopyScope(node?.kind), 25 * 1024 * 1024, key ?? 'toolbar');
      }}>${this.copyLabel(key ?? 'toolbar', this.localize('copy'))}</button>`;
  }
  private renderSourceNode(node: LyraInspectionNode): TemplateResult {
    const match = this.sourceSearch.isMatch(node.path);
    const active = this.sourceSearch.isActive(node.path);
    return html`<span part="key" ?data-match=${match} ?data-active=${active}>${node.name}</span><span aria-hidden="true">:</span><span
      part="value" data-type=${node.kind === 'scalar' ? 'string' : node.kind} ?data-match=${match} ?data-active=${active}>${node.value ?? node.kind}</span>${this.sourceCopyButton(node)}`;
  }
  private renderSource(): TemplateResult {
    const partial = !this.sourceSearch.exact && Boolean(this.query);
    const count = this.sourceSearch.count;
    return html`<div class="source-shell" style=${sanitizeCssLength(this.maxHeight) ? styleMap({ '--lr-json-viewer-max-height': sanitizeCssLength(this.maxHeight)! }) : nothing}>
      ${this.copyable && hasHierarchySourceCopy(() => this.treeSource) ? html`<div part="toolbar">${this.sourceCopyButton()}</div>` : nothing}
      ${hierarchySourceView(this.hierarchy, {
        label: hostAriaLabel(this) ?? this.localize('jsonValue'), rtl: this.effectiveDirection === 'rtl', multiple: false,
        loading: this.localize('loading'), error: this.localize('treeSourceError'), empty: this.localize('noData'),
        retry: this.localize('retry'), expand: this.localize('expand'), collapse: this.localize('collapse'), summary: this.sourceSummary(),
        name: node => node.name, content: node => this.renderSourceNode(node), select: () => {},
      })}
      ${partial ? html`<div part="search-status">${this.sourceSearch.unavailable ? this.localize('sourceSearchUnavailable') :
        this.localize('viewerSearchMatchCount', undefined, { count: this.localize('countAtLeast', undefined, { count: getNumberFormat(this.effectiveLocale).format(count) }), pluralCount: count })}</div>` : nothing}
    </div>`;
  }

  /** Maximum admitted, searched and rendered nodes, from 1 to 50,000; invalid values use 5,000. */
  @property({ converter: blankNumberConverter(5000), attribute: 'max-nodes' }) maxNodes = 5000;
  private get effectiveMaxNodes(): number {
    return Math.max(1, finiteCount(this.maxNodes, MAX_JSON_NODES, 50000));
  }
  /** The value to render. Any JSON-serializable value, plus `undefined`. */
  @property({ attribute: false }) data: unknown;
  /** Nodes at or beyond this nesting depth (root = 0) start collapsed, so only the levels above it
   *  start expanded. Omit/undefined: nothing auto-collapses. */
  @property({ converter: blankNumberConverter(undefined), attribute: 'expand-depth' })
  expandDepth?: number;
  /** A CSS length (e.g. `"20rem"`); once set, the viewer scrolls internally past this height
   * instead of growing the page. Invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  /**
   * How a scalar row places its key and value.
   *
   * `'auto'` (the default) keeps them side by side while the viewer's own inline size is at least
   * 30rem and switches to the stacked layout below that, through a container query on the
   * viewer's allocation, not the viewport. `'stacked'` always puts the value on its own line under
   * its key and tightens rows: leaf rows lose the icon-button-sized floor their hidden toggle
   * spacer otherwise imposes, and lines use the snug line height. Real expand/collapse toggles keep
   * their full hit area. `'inline'` keeps the side-by-side row at every width. Unknown values
   * fall back to `'auto'`. Applies to the `data` tree; `treeSource` rows keep their fixed
   * virtualized layout.
   */
  @property({ converter: JSON_VIEWER_LAYOUT }) layout: LyraJsonViewerLayout = 'auto';
  /** Shows copy-to-clipboard affordances: one for the whole value, plus one per node. */
  @property({ type: Boolean, reflect: true }) copyable = false;
  /** Removing the attribute clears search without changing its null readback. Case- and accent-insensitive substring match against keys/values; matches are highlighted and their ancestors auto-expanded. See also `runSearch()`/`searchNext()`/`searchPrevious()`/`clearSearch()` for imperative, cursor-navigable search built on top of this property. */
  @property() query = '';
  /**
   * Per-path (`JSON.stringify(path)`) explicit expand/collapse, overriding
   * the `expandDepth`/search defaults once a node's toggle has been used.
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
  private dataSnapshot: JsonSnapshotValue = undefined;
  private dataSnapshotTruncated = false;
  private explicitRefresh = 0;
  private treeMemo?: { deps: unknown[]; tree: TemplateResult; limited: boolean };
  private readonly matchElements = new Map<string, Element>();
  private activeMatchElement?: Element;

  private previousFeedback: KeyedCopyFeedback['state'] = null;

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    // A feedback repaint must preserve the provider's active search and clipboard request.
    if (!args.length && this.copyFeedback && this.copyFeedback.state !== this.previousFeedback) {
      this.previousFeedback = this.copyFeedback.state;
      super.requestUpdate();
      return;
    }
    if (args[0] === undefined) this.explicitRefresh = (this.explicitRefresh ?? 0) + 1;
    if (this._treeSource !== undefined && (args[0] === undefined || args[0] === 'query')) {
      this.invalidateSourceSearch();
      this.syncSource(args[0] === undefined);
    }
    super.requestUpdate(...args);
  }

  private syncActiveMatch(): void {
    const match = this.searchState.orderedMatches[this.activeSearchIndex];
    const next = match ? this.matchElements.get(`${match.kind}:${match.pathKey}`) : undefined;
    if (this.activeMatchElement !== next) {
      this.activeMatchElement?.removeAttribute('data-active');
      this.activeMatchElement?.setAttribute('aria-current', 'false');
    }
    next?.setAttribute('data-active', '');
    next?.setAttribute('aria-current', 'true');
    this.activeMatchElement = next;
  }

  private readonly searchAnnouncementSink = new AnnouncementSinkController(this, { eager: ['polite'] });
  private searchAnnouncementsArmed = false;
  private searchAnnouncementGeneration = 0;
  private readonly copyFeedback = new KeyedCopyFeedback(this);


  override connectedCallback(): void {
    super.connectedCallback();
    // A same-task DOM move keeps the loaded tree, search and copy state.
    if (this.detached.cancel()) return;
    this.sourceBinding = undefined;
    this.requestUpdate('sourceReconnect', null);
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

  private treeElement: HTMLElement | null = null;
  private readonly treeFocus = new RovingTreeFocus({
    tree: () => (this.treeElement?.isConnected ? this.treeElement : null),
    row: '[part~="row"]',
    control: '[part~="toggle"], [part~="copy-button"]',
    direction: () => this.effectiveDirection,
  });
  private disposeScrollRegion?: () => void;
  private scrollRegionBody?: HTMLElement;
  private scrollRegionName?: string;

  /** Keeps the capped-height tree body keyboard-scrollable while it overflows. */
  private syncScrollRegion(): void {
    const body = this.renderRoot.querySelector<HTMLElement>('[part="base"]') ?? undefined;
    if (!body || !this.isConnected) {
      this.releaseScrollRegion();
      return;
    }
    const name = hostAriaLabel(this) ?? this.localize('jsonViewerLabel');
    if (body === this.scrollRegionBody && name === this.scrollRegionName) return;
    this.releaseScrollRegion();
    this.scrollRegionBody = body;
    this.scrollRegionName = name;
    this.disposeScrollRegion = makeScrollRegionFocusable(body, name);
  }

  private releaseScrollRegion(): void {
    this.disposeScrollRegion?.();
    this.disposeScrollRegion = undefined;
    this.scrollRegionBody = undefined;
  }

  private readonly detached = new DeferredTeardown(() => {
    this.releaseScrollRegion();
    this.invalidateSourceSearch();
    this.sourceBinding = undefined;
    this.copyFeedback.clear();
    this.searchAnnouncementGeneration += 1;
    this.searchAnnouncementsArmed = false;
  });

  override disconnectedCallback(): void {
    this.detached.schedule();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    this.detached.flush();
    this.invalidateSourceSearch();
    this.sourceBinding = undefined;
    this.hierarchy.adopted();
    this.searchAnnouncementSink.adopted();
    this.sourceAnnouncement = undefined;
    super.adoptedCallback();
  }

  /** `expandDepth`, normalized to a finite non-negative integer when set -- `undefined`
   *  (nothing auto-collapses) is left as-is, since it's a meaningful, intentional value, not an
   *  invalid one. A raw `NaN` (e.g. an invalid `expand-depth` attribute) would otherwise make
   *  every `depth >= expandDepth` comparison false, silently disabling auto-collapse instead of
   *  falling back to a sane depth. */
  private get safeExpandDepth(): number | undefined {
    return this.expandDepth === undefined ? undefined : finiteCount(this.expandDepth);
  }

  private previewText(type: 'object' | 'array', count: number, exact = true): string {
    // {count} is interpolated via the values arg (not string-concatenated) --
    // same pluralized-message pattern as toolCount, so the count's position
    // relative to the noun stays translatable rather than fixed to English's
    // "number space noun" order. `count` carries the locale-grouped string for
    // display; `pluralCount` carries the raw number that selects the category.
    const formattedCount = getNumberFormat(this.effectiveLocale).format(count);
    const localizedCount = exact ? formattedCount : this.localize('countAtLeast', undefined, { count: formattedCount });
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
    const expandDepth = this.safeExpandDepth;
    if (expandDepth !== undefined && depth >= expandDepth) return false;
    return true;
  }

  private toggleNode(pathKey: string, currentlyExpanded: boolean): void {
    const next = new Map(this.expandedOverrides);
    next.set(pathKey, !currentlyExpanded);
    this.expandedOverrides = next;
  }

  private reportCopyOutcome(key: string, outcome: LyraClipboardWriteOutcome, current: () => boolean): void {
    if (!current()) return;
    this.copyFeedback.show(key, outcome.ok);
    reportCopyOutcome({
      announce: ok => {
        const message = this.localize(ok ? 'copied' : 'copyFailed');
        if (current()) this.searchAnnouncementSink.announcePolite(message);
      },
      emit: (name, detail) => this.emit(name, detail ?? null),
    }, outcome, current);
  }

  private copyLabel(key: string, rest: string): string {
    const feedback = this.copyFeedback.for(key);
    return feedback ? this.localize(feedback.ok ? 'copied' : 'copyFailed') : rest;
  }

  private async copy(value: JsonSnapshotValue, key: string): Promise<void> {
    if (this.treeSource !== undefined) return;
    const intent = ++this.copyIntent;
    const current = () => this.treeSource === undefined && intent === this.copyIntent;
    this.copyFeedback.clear();
    let text = '';
    try {
      text = value === undefined ? 'undefined' : this.stringifyForClipboard(value);
    } catch (error) {
      if (this.isConnected && current()) {
        this.reportCopyOutcome(key, copyOutcome('failure', { text, error }), current);
      }
      return;
    }
    if (!current()) return;
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    const outcome = await writeClipboardText(owner, text);
    if (!current() || !this.isConnected || this.ownerDocument.defaultView !== owner) return;
    this.reportCopyOutcome(key, outcome, current);
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
  private stringifyForClipboard(value: JsonSnapshotValue): string {
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
    if (serialized !== undefined) return serialized;
    // Realm-installed serialization hooks can suppress an array's JSON result. Its fallback
    // coercion still crosses the array prototype, unlike admitted primitive display values.
    try {
      return formatPrimitive(value, valueType(value));
    } catch {
      return '';
    }
  }

  /**
   * Builds the key/value-match sets, the ancestor-paths-of-a-match set that
   * `query` drives, and the full set of path keys reachable in the tree
   * (`paths`, used to prune `expandedOverrides` -- see `willUpdate()`).
   * Guards against a self-referencing `data` the same way `renderNode()`
   * does: a container value already on the current recursion path is
   * treated as a leaf instead of being walked again.
   */
  private computeSearch(): SearchState {
    const locale = this.effectiveLocale;
    const query = prepareNeedle(this.query ?? '', locale);
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
          value: JsonSnapshotValue;
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
      if (visited >= this.effectiveMaxNodes) {
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
        if (keyLabel !== undefined && foldSearchText(keyLabel, locale).includes(query)) {
          keyMatches.add(pathKey);
          orderedMatches.push({ pathKey, kind: 'key' });
          hit = true;
        }
        if (
          type !== 'object' &&
          type !== 'array' &&
          foldSearchText(formatPrimitive(value, type), locale).includes(query)
        ) {
          valueMatches.add(pathKey);
          orderedMatches.push({ pathKey, kind: 'value' });
          hit = true;
        }
        if (hit) markAncestors(path);
      }
      if ((type === 'object' || type === 'array') && !ancestors.has(value as object)) {
        const available = Math.max(0, this.effectiveMaxNodes - visited);
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

  private renderCopyButton(
    value: JsonSnapshotValue,
    label: string | undefined,
    pathKey: string,
  ): TemplateResult | typeof nothing {
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
        aria-label=${this.copyLabel(
          pathKey,
          this.localize('jsonCopyLabel', undefined, { label: resolvedLabel }),
        )}
        @click=${(e: Event) => {
          e.stopPropagation();
          void this.copy(value, pathKey);
        }}
      >
        ${this.copyLabel(pathKey, this.localize('copy'))}
      </button>
    `;
  }

  private renderNode(
    value: JsonSnapshotValue,
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
    // The full key path names a repeated key ("name" under every row) uniquely.
    const toggleLabel =
      (keyLabel === undefined ? undefined : path.map(String).join('.')) ??
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
          aria-hidden=${toggleable ? nothing : 'true'}
          aria-expanded=${toggleable ? (expanded ? 'true' : 'false') : nothing}
          aria-label=${toggleable
            ? // Interpolated via the values arg (not string-concatenated) so word
              // order stays translatable -- same rationale as renderCopyButton()'s
              // "Copy {label}" above; toggleLabel is either caller data (a JSON
              // key/index) or an already-localized type noun.
              this.localize('jsonToggleLabel', undefined, { label: toggleLabel })
            : nothing}
          @click=${() => toggleable && this.toggleNode(pathKey, expanded)}
        >
          <span class="chevron">${chevronIcon()}</span>
        </button>
        ${keyLabel !== undefined
          ? html`<span
                part="key"
                ${ref(element => { if (element) this.matchElements.set(`key:${pathKey}`, element); })}
                ?data-match=${search.keyMatches.has(pathKey)}
                ?data-active=${!!activeMatch && activeMatch.pathKey === pathKey && activeMatch.kind === 'key'}
                aria-current=${activeMatch && activeMatch.pathKey === pathKey && activeMatch.kind === 'key'
                  ? 'true'
                  : 'false'}
                >${keyWithBreaks(keyLabel)}</span
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
              ${ref(element => { if (element) this.matchElements.set(`value:${pathKey}`, element); })}
              data-type=${type}
              ?data-match=${search.valueMatches.has(pathKey)}
              ?data-active=${!!activeMatch && activeMatch.pathKey === pathKey && activeMatch.kind === 'value'}
              aria-current=${activeMatch && activeMatch.pathKey === pathKey && activeMatch.kind === 'value'
                ? 'true'
                : 'false'}
              >${formatPrimitive(value, type)}</span
            >`}
        ${this.renderCopyButton(value, toggleLabel, pathKey)}
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
    const wasSource = this.sourceMode;
    this.syncSource();
    if (this.treeSource !== undefined) {
      if (!this.sourceMode) {
        this.sourceMode = true; this.dataSnapshot = undefined; this.dataSnapshotTruncated = false;
        this.searchState = EMPTY_SEARCH; this.treeMemo = undefined; this.matchElements.clear(); this.expandedOverrides.clear();
      }
      this.sourceSearch.schedule();
      return;
    }
    this.sourceMode = false;
    if (wasSource) { this.sourceAnnouncement = undefined; this.invalidateSourceSearch(); }
    if (wasSource || !this.hasUpdated || changed.has('data') || changed.has('maxNodes')) {
      this.copyIntent++;
      this.copyFeedback.clear();
      const snapshot = snapshotJsonData(this.data, this.effectiveMaxNodes);
      this.dataSnapshot = snapshot.value;
      this.dataSnapshotTruncated = snapshot.truncated;
    }
    const locale = this.effectiveLocale;
    if (wasSource || !this.hasUpdated || changed.has('data') || changed.has('query') || changed.has('maxNodes') || locale !== this.searchLocale) {
      this.searchLocale = locale;
      const next = this.computeSearch();
      if (!this.hasUpdated || changed.has('data') || changed.has('maxNodes')) {
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
        this.scheduleAfterUpdate(() => this.emitSearchChange(), 'lr-search-change');
      }
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncScrollRegion();
    this.treeFocus.sync();
    if (this.treeSource !== undefined) {
      const source = this.treeSource;
      const binding = this.sourceBinding;
      const snapshot = captureHierarchySourceEffects(this, this.hierarchy,
        () => source === this.treeSource && binding === this.sourceBinding);
      const message = applyHierarchySourceEffects({ ...snapshot, error: snapshot.error || snapshot.rowError }, {
        errorText: () => this.localize('treeSourceError'),
        loadingText: () => this.localize('loading'),
        summary: () => this.sourceSummary(),
        announce: (text) => this.searchAnnouncementSink.announcePolite(text),
      }, this.sourceAnnouncement);
      if (message !== undefined) this.sourceAnnouncement = message;
      return;
    }
    this.syncActiveMatch();
    if (this.searchAnnouncementsArmed && changed.has('activeSearchIndex')) {
      this.searchAnnouncementSink.announcePolite(this.activeSearchAnnouncement());
    }
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', viewerSearchDetail(
      this.query,
      this.treeSource !== undefined ? this.sourceSearch.count : this.searchState.orderedMatches.length,
      this.treeSource !== undefined ? this.sourceSearch.exact : !this.searchState.truncated,
      this.activeSearchIndex,
    ));
  }

  private revealActiveMatch(): void {
    const match = this.searchState.orderedMatches[this.activeSearchIndex];
    if (!match) return;
    // Every `pathKey` is the `JSON.stringify` of a path array written by this class's search pass.
    const path = JSON.parse(match.pathKey) as unknown;
    if (!Array.isArray(path)) return;
    let next: Map<string, boolean> | null = null;
    for (let depth = 0; depth < path.length; depth++) {
      const ancestorKey = JSON.stringify(path.slice(0, depth));
      if (this.isExpanded(ancestorKey, depth, this.searchState.forceExpand)) continue;
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
      total: this.searchState.truncated ? this.localize('countAtLeast', undefined, { count: numberFormat.format(total) }) : numberFormat.format(total),
    });
  }

  /**
   * Sets the declarative `query` property and awaits the recompute -- the resolved count is the
   * number of matches (also `searchState.orderedMatches.length` / rendered `[data-match]` spans).
   *
   * Source mode accepts at most 4,096 query units and returns the retained global node-hit count,
   * up to 10,000 independently of maxNodes. Its cursor remains -1 until navigation.
   * The method form awaits the render update and returns the resulting match count; `query` also
   * supports declarative bindings that do not need a return value.
   */
  async runSearch(query: string): Promise<number> {
    if (this.treeSource !== undefined) {
      const intent = this.sourceSearch.generation;
      this.query = query;
      if (intent === this.sourceSearch.generation) this.invalidateSourceSearch();
      const currentIntent = this.sourceSearch.generation;
      this.requestUpdate('sourceSearchIntent', null);
      await this.updateComplete;
      if (currentIntent !== this.sourceSearch.generation) return 0;
      return this.sourceSearch.task;
    }
    this.query = query;
    await this.updateComplete;
    return this.searchState.orderedMatches.length;
  }

  /** Advances the cursor to the next match (wrapping), revealing collapsed ancestors and
   *  scrolling the selected match into view. Resolves `false` with no match to move to. */
  async searchNext(): Promise<boolean> {
    if (this.treeSource !== undefined) return this.sourceSearch.step(1);
    const total = this.searchState.orderedMatches.length;
    if (total === 0) return false;
    this.activeSearchIndex = (this.activeSearchIndex + 1) % total;
    this.revealActiveMatch();
    this.emitSearchChange();
    await this.scrollActiveMatchIntoView();
    return true;
  }

  /** Moves the cursor to the previous match (wrapping), starting at the last result when unset,
   *  revealing collapsed ancestors and
   *  scrolling the selected match into view. Resolves `false` with no match to move to. */
  async searchPrevious(): Promise<boolean> {
    if (this.treeSource !== undefined) return this.sourceSearch.step(-1);
    const total = this.searchState.orderedMatches.length;
    if (total === 0) return false;
    this.activeSearchIndex = this.activeSearchIndex < 0 ? total - 1 : (this.activeSearchIndex - 1 + total) % total;
    this.revealActiveMatch();
    this.emitSearchChange();
    await this.scrollActiveMatchIntoView();
    return true;
  }

  /** Resets `query` to `''`, clearing all matches and the cursor. */
  clearSearch(): void {
    if (this.treeSource !== undefined) { this.hierarchy.cancelSearch(); this.invalidateSourceSearch(); this.requestUpdate('sourceSearchIntent', null); }
    this.query = '';
  }

  private async scrollActiveMatchIntoView(): Promise<void> {
    await this.updateComplete;
    const el = this.renderRoot.querySelector('[data-active]');
    const body = this.scrollRegionBody;
    if (body) body.style.scrollBehavior = prefersReducedMotion(this) ? 'auto' : 'smooth';
    if (el && body && (body.scrollHeight > body.clientHeight || body.scrollWidth > body.clientWidth)) {
      revealWithinScrollParent(el);
    }
  }

  override render(): TemplateResult {
    if (this.treeSource !== undefined) return this.renderSource();
    const deps = [this.dataSnapshot, this.searchState, this.expandedOverrides, this.expandDepth,
      this.copyable, this.copyFeedback.state, this.strings, this.effectiveLocale,
      lyraLocaleCatalogVersion(this.effectiveLocale), this.explicitRefresh, this.effectiveMaxNodes];
    let memo = this.treeMemo;
    if (!memo || deps.some((value, index) => value !== memo!.deps[index])) {
      const budget: RenderBudget = { remaining: this.effectiveMaxNodes, truncated: false };
      this.matchElements.clear();
      const tree = this.renderNode(this.dataSnapshot, [], undefined, 0, this.searchState, new WeakSet(), budget);
      memo = { deps, tree, limited: budget.truncated || this.searchState.truncated || this.dataSnapshotTruncated };
      this.treeMemo = memo;
    }
    const { tree, limited } = memo;
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
                aria-label=${this.copyLabel('toolbar', this.localize('copyJson'))}
                @click=${() => void this.copy(this.dataSnapshot, 'toolbar')}
              >
                ${this.copyLabel('toolbar', this.localize('copy'))}
              </button>
            </div>`
          : nothing}
        <div part="tree" role="list" ${ref(element => { this.treeElement = (element as HTMLElement | undefined) ?? null; })}
          @focusin=${this.treeFocus.onFocusIn} @keydown=${this.treeFocus.onKeyDown} data-layout=${JSON_VIEWER_LAYOUT.normalize(this.layout)} aria-label=${hostAriaLabel(this) ?? nothing}>${tree}</div>
        ${limited
          ? html`<p part="limit">${this.localize('jsonViewerLimit', undefined, {
              count: getNumberFormat(this.effectiveLocale).format(this.effectiveMaxNodes),
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
