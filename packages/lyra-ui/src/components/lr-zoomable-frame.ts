import { defineElement } from '../internal/prefix.js';
import { LyraZoomableFrame } from './media/zoomable-frame/zoomable-frame.class.js';

defineElement('zoomable-frame', LyraZoomableFrame);
export { LyraZoomableFrame } from './media/zoomable-frame/zoomable-frame.class.js';
export type {
  LyraZoomableFrameEventMap,
  LyraZoomableFrameLoading,
} from './media/zoomable-frame/zoomable-frame.class.js';
