import { LyraGeojsonView } from '@aceshooting/lyra-ui';
import { LyraGeoJsonViewer, type LyraGeoJsonViewerEventMap } from '@aceshooting/lyra-ui/components/viewers/geojson-view/geojson-viewer.class.js';
import type { LyraGraphEdge } from '@aceshooting/lyra-ui/components/retrieval/graph/graph.class.js';
import { createDocumentRendererRegistry, type LyraDocumentFile, type LyraDocumentRendererDefinition } from '@aceshooting/lyra-ui/components/viewers/document-viewer/registry.js';
import { bridgeLyraLocale, resolveLyraScopedString, subscribeLyraLocale, type LyraLocaleBridgeOptions, type LyraLocaleBridgeCleanup } from '@aceshooting/lyra-ui/localization.js';

const edge: LyraGraphEdge = { source: 'a', target: 'b' };
const file: LyraDocumentFile = { name: 'features.geojson', src: './features.geojson', mimeType: 'application/geo+json' };
const renderer: LyraDocumentRendererDefinition = { render: (value: LyraDocumentFile) => value.name };
const registry = createDocumentRendererRegistry([['application/geo+json', renderer]]);
const retainedConstructor: typeof LyraGeoJsonViewer = LyraGeojsonView;
const renderError = (event: LyraGeoJsonViewerEventMap['lr-render-error']): unknown => event.detail.error;
function bridge(options?: LyraLocaleBridgeOptions): LyraLocaleBridgeCleanup { return bridgeLyraLocale(options); }
export { edge, file, registry, retainedConstructor, renderError, bridge, resolveLyraScopedString, subscribeLyraLocale };
