export * from './memory-panel.class.js';
import { LyraMemoryPanel } from './memory-panel.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../provenance-panel/provenance-panel.js';
import '../confirm-bar/confirm-bar.js';
import '../empty/empty.js';
defineElement('memory-panel', LyraMemoryPanel);
