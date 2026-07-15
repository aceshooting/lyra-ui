export * from './archive-loader.js';
export * from './archive-viewer.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../virtual-list/virtual-list.js';
import { LyraArchiveViewer } from './archive-viewer.class.js';
defineElement('archive-viewer', LyraArchiveViewer);
