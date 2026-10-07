/** @deprecated Import @aceshooting/lyra-ui/components/lr-svg-viewer.js to register this component. */
export * from './svg-viewer.class.js';
import { LyraSvgViewer } from './svg-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../media/pan-zoom/pan-zoom.js';
import './svg-viewer-register.js';

defineElement('svg-viewer', LyraSvgViewer);
