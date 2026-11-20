export type { AnchorResultDetail, TextSelectDetail } from '../internal/document-anchors.js';
export type { LyraSearchChangeDetail, LyraTextViewerTargetEventMap } from '../internal/text-viewer-target.js';
export * from './viewers/include/include.class.js';
import { LyraInclude } from './viewers/include/include.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('include', LyraInclude);
