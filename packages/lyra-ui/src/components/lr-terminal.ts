export type { TextSelectRect } from './viewers/document-viewer/anchors.js';
export type { LyraClipboardWriteFailure, LyraClipboardWriteSuccess } from '../internal/clipboard.js';
export type { LyraSearchChangeDetail } from '../internal/text-viewer-target.js';
export * from './agent-tools/terminal/terminal.class.js';
import './lr-virtual-list.js';
import { LyraTerminal } from './agent-tools/terminal/terminal.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('terminal', LyraTerminal);
