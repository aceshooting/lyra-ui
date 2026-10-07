/** @deprecated Import @aceshooting/lyra-ui/components/lr-dataset-viewer.js to register this component. */
export * from './dataset-viewer.class.js';
import { LyraDatasetViewer } from './dataset-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../layout/virtual-list/virtual-list.js';
import './dataset-viewer-register.js';

defineElement('dataset-viewer', LyraDatasetViewer);
