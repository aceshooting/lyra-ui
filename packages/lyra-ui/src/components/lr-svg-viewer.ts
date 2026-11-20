export * from './viewers/svg-viewer/svg-viewer.class.js';
import { LyraSvgViewer } from './viewers/svg-viewer/svg-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-pan-zoom.js';
import './viewers/svg-viewer/svg-viewer-register.js';

defineElement('svg-viewer', LyraSvgViewer);
