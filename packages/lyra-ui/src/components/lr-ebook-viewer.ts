export type { LyraAnchor } from '../internal/document-anchors.js';
export type { LyraAnchorTargetEventMap } from '../internal/anchor-target-base.js';
export type { LyraSearchChangeDetail } from '../internal/text-viewer-target.js';
export * from './viewers/ebook-viewer/ebook-viewer.class.js';
import { LyraEbookViewer } from './viewers/ebook-viewer/ebook-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './viewers/ebook-viewer/ebook-viewer-register.js'; // also lets <lr-document-viewer> open this kind

defineElement('ebook-viewer', LyraEbookViewer);
