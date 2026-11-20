export type { LyraMapAnchorBoundary, LyraMapAnchorCloseDetail, LyraMapAnchorSafeArea } from './media/map/map-anchor-options.js';
export * from './media/map/map-anchor.class.js';
import { LyraMapAnchor } from './media/map/map-anchor.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('map-anchor', LyraMapAnchor);
