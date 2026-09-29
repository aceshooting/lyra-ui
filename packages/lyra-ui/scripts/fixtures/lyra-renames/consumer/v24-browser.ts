/// <reference types="vite/client" />
import '@aceshooting/lyra-ui/hydration.js';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { getLyraStyle, setLyraStyle } from '@aceshooting/lyra-ui/theme.js';
import { LyraGeoJsonViewer } from '@aceshooting/lyra-ui/components/viewers/geojson-view/geojson-viewer.class.js';

setWorkerUrl(workerUrl);
const restoredV1 = getLyraStyle();
if (restoredV1.mode !== 'system' || restoredV1.accentName !== null || restoredV1.accent !== 'aquamarine' || restoredV1.accentBackground !== 'aquamarine') {
  throw new Error('The saved v1 style preference lost its CSS color or automatic mode');
}
setLyraStyle({ look: 'shadcn', mode: 'system', surface: 'glass', density: 'compact', accent: 'sapphire' });
if (customElements.get('lr-geojson-viewer')) throw new Error('Registration-free canonical class import registered the element');
if (customElements.get('lr-geojson-view')) throw new Error('Retired GeoJSON tag is registered');
await import('@aceshooting/lyra-ui/components/lr-geojson-viewer.js');
if (customElements.get('lr-geojson-viewer') !== LyraGeoJsonViewer) throw new Error('Canonical registration is missing');
if (customElements.get('lr-geojson-view')) throw new Error('Canonical registration restored the retired GeoJSON tag');

const element = document.createElement('lr-geojson-viewer') as LyraGeoJsonViewer;
element.id = 'lr-geojson-viewer';
element.src = './features.geojson';
element.name = 'Two consumer features';
document.body.append(element);
document.documentElement.dataset.migrationReady = 'true';
