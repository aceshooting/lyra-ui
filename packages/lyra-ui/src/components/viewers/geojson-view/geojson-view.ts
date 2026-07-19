export * from './geojson-view.class.js';
import { LyraGeojsonView } from './geojson-view.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';
import '../../media/map/map.js';
import '../../utility/json-viewer/json-viewer.js';
import '../../overlays/skeleton/skeleton.js';

defineElement('geojson-view', LyraGeojsonView);

registerDocumentRenderer('application/geo+json', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.geojson'),
  render: (file: DocumentFile) => {
    const el = document.createElement('lr-geojson-view') as LyraGeojsonView;
    el.src = file.src;
    el.name = file.name;
    return el;
  },
});
