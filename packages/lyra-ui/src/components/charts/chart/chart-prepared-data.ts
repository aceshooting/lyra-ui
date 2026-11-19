import type { LyraSpatialChartSource } from '../../../utilities/data-spatial.js';
import type { LyraPreparedSeriesData, LyraPreparedCategoryData, LyraSeriesObservation } from '../../../utilities/data-preparation.js';
import type { LyraSourceRevision } from '../../../data-sources.js';

export * from '../../../internal/chart-prepared-data.js';

type NonspatialChartData = LyraPreparedSeriesData | LyraPreparedCategoryData;
export type LyraChartPreparedData = NonspatialChartData | LyraSpatialChartSource;
export interface LyraChartSourcePointSelectDetail {
  readonly revision: LyraSourceRevision;
  readonly seriesId: string;
  readonly sourceIndex: number;
  readonly point: LyraSeriesObservation;
}
export interface LyraChartSourceCategorySelectDetail {
  readonly revision: LyraSourceRevision;
  readonly seriesId: string;
  readonly categoryId: string;
  readonly value: number;
  readonly observationCount: number;
}
