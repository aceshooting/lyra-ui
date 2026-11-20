export * from './viewers/dataset-viewer/dataset-viewer.class.js';
import { LyraDatasetViewer } from './viewers/dataset-viewer/dataset-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-virtual-list.js';
import './viewers/dataset-viewer/dataset-viewer-register.js';

defineElement('dataset-viewer', LyraDatasetViewer);
