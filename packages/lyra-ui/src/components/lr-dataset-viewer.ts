export type { LyraAnchorKind } from './viewers/document-viewer/anchors.js';
export type { TableViewerScrollMode } from './viewers/table-viewer-shared.js';
export type { LyraAnchorTargetEventMap } from '../internal/anchor-target-base.js';
export type { LyraSearchChangeDetail } from '../internal/text-viewer-target.js';
export * from './viewers/dataset-viewer/dataset-viewer.class.js';
import { LyraDatasetViewer } from './viewers/dataset-viewer/dataset-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-virtual-list.js';
import './viewers/dataset-viewer/dataset-viewer-register.js';

defineElement('dataset-viewer', LyraDatasetViewer);
