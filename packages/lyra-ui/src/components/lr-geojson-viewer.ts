export type { AnchorResultDetail, TextSelectDetail } from './viewers/document-viewer/anchors.js';
export type { LyraViewerDiagnosticEventDetail } from './viewers/viewer-diagnostics.js';
export type { LyraSearchChangeDetail, LyraTextViewerTargetEventMap } from '../internal/text-viewer-target.js';
export * from './viewers/geojson-view/geojson-viewer.class.js';
import { LyraGeoJsonViewer } from './viewers/geojson-view/geojson-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-map.js';
export type {} from './lr-json-viewer.js';
import './lr-skeleton.js';
import './viewers/geojson-view/geojson-viewer-register.js';

defineElement('geojson-viewer', LyraGeoJsonViewer);
