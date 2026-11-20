export type { AnchorResultDetail, HighlightActivateDetail, LyraAnchorKind } from '../internal/document-anchors.js';
export type { LyraClipboardWriteFailure, LyraClipboardWriteSuccess } from '../internal/clipboard.js';
export type { ShikiLanguageInput, ShikiLanguageLoader } from '../internal/shiki/core.js';
export type { LyraSearchChangeDetail } from '../internal/text-viewer-target.js';
export * from './utility/diff-view/diff-view.class.js';
import { LyraDiffView } from './utility/diff-view/diff-view.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('diff-view', LyraDiffView);
