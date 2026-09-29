// These authored syntax cases bind to verified policies; they are not another policy inventory.
const member = { scope: 'member', tag: 'lr-geojson-view', kind: 'component', name: 'lr-geojson-view' };
const exported = (kind, name, module = null) => ({ scope: 'export', kind, module, name });
const route = (id, name, resolved) => ({ id, key: exported('entry-point', name),
  input: `import '@aceshooting/lyra-ui${name.slice(1)}';\n`,
  resolved: `import '@aceshooting/lyra-ui${resolved.slice(1)}';\n`, column: 9 });
const type = (id, name, module, replacement, replacementModule = module, sourceModule = module) => ({
  id, key: exported('type', name, module),
  input: `import type { ${name} } from '@aceshooting/lyra-ui${sourceModule === '.' ? '' : sourceModule.slice(1)}';\n`,
  resolved: `import type { ${replacement} } from '@aceshooting/lyra-ui${replacementModule.slice(1)}';\n`, column: 15,
});
export const X_CASES = Object.freeze([
  { id: 'geojson-tag', key: member, input: '<lr-geojson-view src="./features.geojson"></lr-geojson-view>\n',
    resolved: '<lr-geojson-viewer src="./features.geojson"></lr-geojson-viewer>\n', column: 2 },
  { ...route('geojson-tag-route', './components/lr-geojson-view.js', './components/lr-geojson-viewer.js'),
    additionalReviews: [{ key: member, column: 41 }] },
  route('geojson-registration-route', './components/viewers/geojson-view/geojson-view.js', './components/lr-geojson-viewer.js'),
  route('geojson-class-route', './components/viewers/geojson-view/geojson-view.class.js', './components/viewers/geojson-view/geojson-viewer.class.js'),
  route('localization-route', './utilities/localization.js', './localization.js'),
  type('graph-type', 'LyraGraphLink', './components/retrieval/graph/graph.class.js', 'LyraGraphEdge'),
  type('document-file-type', 'DocumentFile', './components/viewers/document-viewer/registry.js', 'LyraDocumentFile'),
  type('document-renderer-type', 'DocumentRendererDefinition', './components/viewers/document-viewer/registry.js', 'LyraDocumentRendererDefinition'),
  // The root import isolates this type warning from the separately covered retired class route.
  type('geojson-event-type', 'LyraGeojsonViewEventMap', './components/viewers/geojson-view/geojson-view.class.js', 'LyraGeoJsonViewerEventMap', './components/viewers/geojson-view/geojson-viewer.class.js', '.'),
]);
export const RETAINED_ROOT = {
  key: exported('class', 'LyraGeojsonView', '.'),
  input: "import { LyraGeojsonView } from '@aceshooting/lyra-ui';\n",
  resolved: "// The distinct root class remains supported through its published compatibility window.\n// lyra-migrate-reviewed: DEPRECATED_MODULE_REVIEW:LyraGeojsonView\nimport { LyraGeojsonView } from '@aceshooting/lyra-ui';\n",
  column: 10,
};
