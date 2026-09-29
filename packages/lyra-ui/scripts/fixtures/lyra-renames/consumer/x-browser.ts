import { LyraGeojsonView } from '@aceshooting/lyra-ui';
import { LyraGeoJsonViewer } from '@aceshooting/lyra-ui/components/viewers/geojson-view/geojson-viewer.class.js';

if (customElements.get('lr-geojson-view')) throw new Error('Root/class import restored the retired tag');
if (LyraGeojsonView === LyraGeoJsonViewer || !(LyraGeojsonView.prototype instanceof LyraGeoJsonViewer)) {
  throw new Error('The retained root export lost its distinct subclass identity');
}
customElements.define('consumer-geojson-view', LyraGeojsonView);
await import('@aceshooting/lyra-ui/components/lr-geojson-viewer.js');
if (customElements.get('lr-geojson-view')) throw new Error('Canonical registration restored the retired tag');
if (customElements.get('lr-geojson-viewer') !== LyraGeoJsonViewer) throw new Error('Canonical constructor registration is missing');
for (const name of ['lr-geojson-viewer', 'consumer-geojson-view']) {
  const element = document.createElement(name) as LyraGeoJsonViewer;
  element.id = name;
  element.src = './features.geojson';
  element.name = 'Two consumer features';
  document.body.append(element);
}
document.documentElement.dataset.migrationReady = 'true';
