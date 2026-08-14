export * from './geojson-viewer.class.js';
import { LyraGeoJsonViewer } from './geojson-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import {
  registerDocumentRenderer,
  type DocumentFile,
} from '../document-viewer/registry.js';
import '../../media/map/map.js';
import '../../utility/json-viewer/json-viewer.js';
import '../../overlays/skeleton/skeleton.js';

defineElement('geojson-viewer', LyraGeoJsonViewer);

registerDocumentRenderer('application/geo+json', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.geojson'),
  render: (file: DocumentFile) => {
    const el = document.createElement('lr-geojson-viewer');
    el.src = file.src;
    el.name = file.name;
    el.anchor = file.anchor ?? null;
    el.highlights = file.highlights ?? [];
    return el;
  },
  capabilities: {
    anchors: ['text-quote', 'fragment'],
    search: true,
    textSelect: true,
  },
});
