export type { LyraHighlight } from '../internal/document-anchors.js';
export * from './viewers/page-rail/page-rail.class.js';
import { LyraPageRail } from './viewers/page-rail/page-rail.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-virtual-list.js';
import './lr-file-icon.js';
import './lr-skeleton.js';
defineElement('page-rail', LyraPageRail);
