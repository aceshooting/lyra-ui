/** Host-owned, bounded access contracts for logical collections. This module contains types only. */
import type { LyraVirtualListIndexedSource } from './components/layout/virtual-list/virtual-list.class.js';

export type LyraSourceRevision = string | number;
/** Immutable request authority. Providers should settle promptly when signal is aborted. */
export interface LyraSourceContext {
  readonly revision: LyraSourceRevision;
  readonly locale: string;
  readonly signal: AbortSignal;
}
export interface LyraSourceRecord<T> {
  readonly key: string;
  readonly value: T;
  /** Stable canonical source order within this revision, independent of query sorting. */
  readonly order: number;
}
export interface LyraSourceSearchRequest extends LyraSourceContext {
  readonly query: string;
  readonly limit: number;
}
export interface LyraSourceSearchResult<Hit> {
  readonly hits: readonly Hit[];
  /** Exact global match total when known; null otherwise. */
  readonly total: number | null;
  /** True only if hits contains every matching hit in the full source. */
  readonly exhaustive: boolean;
}
export interface LyraSourceRangeRequest extends LyraSourceContext {
  readonly offset: number;
  readonly limit: number;
}
/** Host-owned logical rows; read returns exactly the requested in-bounds range. */
export interface LyraRangeSource<T> {
  readonly count: number;
  read(request: LyraSourceRangeRequest): Promise<readonly T[]>;
  indexOfKey?(key: string, context: LyraSourceContext): Promise<number | null>;
}
export type LyraIndexedView<T> = LyraVirtualListIndexedSource<T> | LyraRangeSource<T>;
/** Hierarchy navigation requires direct key resolution; no count-sized scan fallback. */
export type LyraHierarchyView<T> =
  | (LyraVirtualListIndexedSource<T> & {
      keyAt(index: number): string;
      indexOfKey(key: string | number): number;
    })
  | (LyraRangeSource<T> & {
      indexOfKey(key: string, context: LyraSourceContext): Promise<number | null>;
    });
/** Simple sources omit summary; hosts declaring a summary require the complete typed value. */
export type LyraSourceSummary<S> = [S] extends [undefined]
  ? { readonly summary?: undefined }
  : { readonly summary: S };

export type LyraSourceCell = string | number | boolean | null | undefined;
export interface LyraTabularColumn { readonly key: string; readonly label: string; }
export interface LyraTabularHit {
  /** Body-row index; -1 means a column/header label. */
  readonly row: number;
  readonly column: number;
}
export interface LyraTabularReadRequest extends LyraSourceContext {
  readonly row: number;
  readonly rowCount: number;
  readonly column: number;
  readonly columnCount: number;
}
/** Indexed scalar cells with separate column labels and absolute zero-based body rows. */
export interface LyraTabularSourceBase {
  readonly revision: LyraSourceRevision;
  /** Body records only. Column labels are separate metadata. */
  readonly rowCount: number;
  readonly columnCount: number;
  columnAt(index: number): LyraTabularColumn;
  rowKeyAt?(index: number): string;
  indexOfRowKey?(key: string): number;
  search?(request: LyraSourceSearchRequest): Promise<LyraSourceSearchResult<LyraTabularHit>>;
}
export type LyraTabularSource = LyraTabularSourceBase & (
  | { cellAt(row: number, column: number): LyraSourceCell; readCells?: never }
  | { cellAt?: never; readCells(request: LyraTabularReadRequest): Promise<readonly (readonly LyraSourceCell[])[]> }
);
export interface LyraWorkbookHit extends LyraTabularHit { readonly sheetKey: string; }
export interface LyraWorkbookSource {
  readonly revision: LyraSourceRevision;
  readonly sheets: readonly {
    readonly key: string;
    readonly name: string;
    readonly data: LyraTabularSource;
  }[];
  search?(request: LyraSourceSearchRequest): Promise<LyraSourceSearchResult<LyraWorkbookHit>>;
}

export interface LyraSourceFacet {
  readonly values: readonly { readonly key: string; readonly label: string; readonly count?: number }[];
  readonly total: number;
  /** Requested selected facet keys proven absent from the global source catalogue. */
  readonly unavailableSelected: readonly string[];
}
export interface LyraSourceGroup {
  readonly key: string;
  readonly label: string;
  readonly startIndex: number;
  readonly itemCount: number;
}
export interface LyraPageRequest<Q> extends LyraSourceContext {
  readonly page: number;
  readonly pageSize: number;
  readonly query: Q;
}
export type LyraPageResult<T, Summary = undefined> = {
  readonly rows: readonly LyraSourceRecord<T>[];
  readonly total: number;
  readonly groups?: readonly LyraSourceGroup[];
  readonly tags?: LyraSourceFacet;
} & LyraSourceSummary<Summary>;
/** Query ordering, totals, grouping and lookup describe the full source, not just the loaded page. */
export interface LyraPageSource<T, Q, Summary = undefined> {
  readonly revision: LyraSourceRevision;
  query(request: LyraPageRequest<Q>): Promise<LyraPageResult<T, Summary>>;
  lookup(keys: readonly string[], context: LyraSourceContext): Promise<readonly LyraSourceRecord<T>[]>;
  /** Absolute record index in this query, or null if absent/filtered. */
  locate(key: string, query: Q, context: LyraSourceContext): Promise<number | null>;
}

export interface LyraHierarchyRow<T> {
  readonly key: string;
  readonly value: T;
  readonly parentKey: string | null;
  readonly level: number;       // one-based logical depth
  readonly position: number;    // one-based position among logical siblings
  readonly setSize: number;     // exact logical sibling count
  readonly childCount: number;
  readonly expanded: boolean;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly selectionState?: 'none' | 'partial' | 'all';
}
export type LyraHierarchyAction =
  | { readonly type: 'reset' }
  | { readonly type: 'toggle'; readonly key: string; readonly expanded: boolean }
  | { readonly type: 'reveal'; readonly key: string }
  | { readonly type: 'select'; readonly key: string; readonly selected: boolean; readonly scope: 'item' | 'subtree' };
export interface LyraHierarchyRequest<Q> extends LyraSourceContext {
  readonly query: Q;
  readonly state: string | null;
  readonly action: LyraHierarchyAction;
}
export type LyraHierarchyProjection<T, Summary = undefined> = {
  /** Opaque immutable projection/expansion/selection snapshot token. */
  readonly state: string;
  readonly total: number;       // all logical nodes, including collapsed nodes
  readonly rows: LyraHierarchyView<LyraHierarchyRow<T>>;
  readonly focusIndex?: number;
} & LyraSourceSummary<Summary>;
/** Projects immutable visible-preorder snapshots without requiring the host element to flatten a tree. */
export interface LyraHierarchySource<T, Q, Summary = undefined> {
  readonly revision: LyraSourceRevision;
  project(request: LyraHierarchyRequest<Q>): Promise<LyraHierarchyProjection<T, Summary>>;
  search?(request: LyraSourceSearchRequest): Promise<LyraSourceSearchResult<{ readonly key: string }>>;
  copy?(request: LyraSourceContext & {
    readonly key: string | null;
    readonly scope: 'node' | 'subtree' | 'document';
    readonly maxBytes: number;
  }): Promise<string>;
}
export interface LyraInspectionNode {
  readonly name: string;
  readonly kind: 'object' | 'array' | 'scalar' | 'element' | 'attribute' | 'text' | 'comment' | 'processing-instruction';
  readonly value?: string;
  readonly path: string;
}
export interface LyraHierarchyQuery {
  readonly search: string;
  readonly hiddenKinds: readonly string[];
}
export interface LyraTraceSourceSummary { readonly startMs: number; readonly endMs: number; }
export interface LyraTaskSourceSummary { readonly total: number; readonly completed: number; }

export interface LyraSourceBounds { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
export interface LyraGraphSourceQuery {
  readonly kind: 'nodes' | 'edges';
  readonly search: string;
  readonly centerKey: string | null;
  readonly direction: 'in' | 'out' | 'both';
  readonly nodeTypes: readonly string[];
}
export type LyraGraphRecord<N, E> =
  | { readonly kind: 'node'; readonly value: N }
  | { readonly kind: 'edge'; readonly value: E };
export interface LyraGraphSourceSummary { readonly nodes: number; readonly edges: number; }
export interface LyraGraphSceneRequest extends LyraSourceContext {
  readonly mode: 'neighborhood' | 'viewport';
  readonly centerKey: string | null;
  readonly bounds: LyraSourceBounds | null;
  readonly nodeLimit: number;
  readonly edgeLimit: number;
  readonly includeKeys: readonly string[];
}
export interface LyraGraphScene<N, E> {
  readonly nodes: readonly { readonly key: string; readonly value: N; readonly position?: { readonly x: number; readonly y: number; readonly z?: number } }[];
  readonly edges: readonly { readonly key: string; readonly value: E; readonly source: string; readonly target: string }[];
  readonly total: LyraGraphSourceSummary;
  readonly coverage: 'complete' | 'neighborhood' | 'aggregate';
  readonly worldBounds: LyraSourceBounds | null;
}
export interface LyraGraphOverview {
  readonly bounds: LyraSourceBounds;
  readonly bins: readonly { readonly bounds: LyraSourceBounds; readonly count: number }[];
}
/** Full-source record navigation with separately bounded diagram and aggregate queries. */
export interface LyraGraphSource<N, E> {
  readonly revision: LyraSourceRevision;
  readonly records: LyraPageSource<LyraGraphRecord<N, E>, LyraGraphSourceQuery, LyraGraphSourceSummary>;
  scene(request: LyraGraphSceneRequest): Promise<LyraGraphScene<N, E>>;
  overview?(request: LyraSourceContext & { readonly limit: number }): Promise<LyraGraphOverview>;
}
