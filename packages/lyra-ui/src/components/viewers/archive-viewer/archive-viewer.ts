/** @deprecated Import @aceshooting/lyra-ui/components/lr-archive-viewer.js to register this component. */
export * from './archive-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './archive-viewer-register.js'; // also lets <lr-document-viewer> open this kind
import '../../layout/virtual-list/virtual-list.js';
import { LyraArchiveViewer } from './archive-viewer.class.js';
defineElement('archive-viewer', LyraArchiveViewer);
