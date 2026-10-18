import type { LyraSourceRevision } from '../data-sources.js';
import type { LyraNumericDomain, LyraSourceRequest, LyraSourceValue } from './data-preparation.js';

/** Finite full-source or viewport coordinates; an equal pair denotes a collapsed global axis. */
export interface LyraSpatialBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}
/** Stable identity in a source revision, independent of representative-array position. */
export interface LyraSpatialPoint {
  readonly id: string;
  readonly sourceIndex: number;
  readonly x: number;
  readonly y: number;
}
/** A positive-count density region. Adjacent regions may share boundaries, never interiors. */
export interface LyraSpatialBin {
  readonly bounds: LyraSpatialBounds;
  readonly count: number;
}
/** Bins account for every match; representative points are overlays, not additional counts. */
export interface LyraSpatialQuery<T extends LyraSpatialPoint> {
  readonly points: readonly T[];
  readonly bins: readonly LyraSpatialBin[];
  readonly matchedCount: number;
}
/**
 * Host-owned spatial index with globally unique IDs. Query returns bounded complete density
 * bins and optional representative overlays; getPoint resolves an exact original ID. Source
 * metadata/payload stay immutable within a revision. Replacement or explicit refresh rebinds it.
 * Methods and payload fields must be own data properties, not accessors. Storage stays host-owned.
 */
export interface LyraSpatialPointSource<T extends LyraSpatialPoint> {
  readonly revision: LyraSourceRevision;
  readonly count: number;
  readonly bounds: LyraSpatialBounds | null;
  query(request: LyraSourceRequest & {
    readonly bounds: LyraSpatialBounds;
    readonly maxPoints: number;
    readonly maxBins: number;
  }): LyraSourceValue<LyraSpatialQuery<T>>;
  getPoint(id: string, request: LyraSourceRequest): LyraSourceValue<T | null>;
}
/** Immutable activation of a density region, not an individual observation. */
export interface LyraSpatialBinSelectDetail {
  readonly revision: LyraSourceRevision;
  readonly bounds: LyraSpatialBounds;
  readonly count: number;
}

/** Declared full-source series metadata, independent of the current representatives. */
export interface LyraSpatialChartSeries {
  readonly id: string;
  readonly label: string;
  readonly color?: string;
}
/** Original chart observation; radius is semantic data, not a renderer-clamped value. */
export interface LyraSpatialChartPoint extends LyraSpatialPoint {
  readonly seriesId: string;
  readonly radius?: number;
  readonly label?: string;
}
/** Bounded spatial chart source with exact full-source series and radius metadata. */
export interface LyraSpatialChartSource extends LyraSpatialPointSource<LyraSpatialChartPoint> {
  readonly kind: 'spatial';
  readonly series: readonly LyraSpatialChartSeries[];
  readonly radiusDomain?: LyraNumericDomain | null;
}
/** Activation preserves the original observation identity and scalar chart metadata. */
export interface LyraChartSpatialPointSelectDetail {
  readonly revision: LyraSourceRevision;
  readonly point: LyraSpatialChartPoint;
}
