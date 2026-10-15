import { Map, Style, prepareStyle, type MapFeatureRequirements } from '@aceshooting/lyra-map';
import { NavigationControl } from '@aceshooting/lyra-map/controls/navigation';
import { lyraMapWorkerPlugin } from '@aceshooting/lyra-map/vite';

declare const map: Map;
declare const style: Style;
const requirements: MapFeatureRequirements = {
  sources: { points: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
  layers: [{ id: 'points', source: 'points', type: 'circle' }]
};
const ready: Promise<void> = map.prepareFeatures(requirements, { signal: new AbortController().signal });
const warmed: Promise<void> = prepareStyle({ version: 8, sources: {}, layers: [] });
const changed: Promise<boolean> = style.setState({ version: 8, sources: {}, layers: [] });
map.addControl(new NavigationControl());
lyraMapWorkerPlugin();
void [ready, warmed, changed];
