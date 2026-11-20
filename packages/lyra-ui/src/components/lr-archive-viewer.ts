export * from './viewers/archive-viewer/archive-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './viewers/archive-viewer/archive-viewer-register.js'; // also lets <lr-document-viewer> open this kind
import './lr-virtual-list.js';
import { LyraArchiveViewer } from './viewers/archive-viewer/archive-viewer.class.js';
defineElement('archive-viewer', LyraArchiveViewer);
