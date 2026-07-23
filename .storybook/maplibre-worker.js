import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// MapLibre v6 is ESM-only. Vite must bundle its module worker separately and
// hand the emitted URL back to MapLibre before a story constructs a map.
setWorkerUrl(workerUrl);
