import type {
  MapLibreGeoJsonDiff,
  MapLibreGeoJsonSource,
  MapLibreSourceDataDiff,
} from '../src/components/media/map/map-loader.js';
import type { LyraMap } from '../src/components/media/map/map.class.js';

declare const source: MapLibreGeoJsonSource;
declare const automaticDiff: MapLibreGeoJsonDiff;
declare const extractedDiff: Parameters<NonNullable<MapLibreGeoJsonSource['updateData']>>[0];

// Existing consumers can retain the automatic property-diff parameter contract.
const retainedDiff: MapLibreGeoJsonDiff = extractedDiff;
source.updateData?.(automaticDiff);

// Explicit source updates also accept geometry changes and whole-source removal.
const authoredDiff: MapLibreSourceDataDiff = {
  update: [{ id: 'feature', newGeometry: { type: 'Point', coordinates: [1, 2] } }],
};
source.updateData?.(authoredDiff);
source.updateData?.({ removeAll: true });
declare const map: LyraMap;
map.updateSourceData('features', authoredDiff);
map.updateSourceData('features', { removeAll: true });

void retainedDiff;
