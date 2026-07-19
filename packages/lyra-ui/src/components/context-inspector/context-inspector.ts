export * from './context-inspector.class.js';
import { LyraContextInspector } from './context-inspector.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../context-meter/context-meter.js';
import '../copy-button/copy-button.js';
import '../export-button/export-button.js';
import '../citation-badge/citation-badge.js';
import '../empty/empty.js';
defineElement('context-inspector', LyraContextInspector);
