/** @deprecated Import @aceshooting/lyra-ui/components/lr-memory-panel.js to register this component. */
export * from './memory-panel.class.js';
import { LyraMemoryPanel } from './memory-panel.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../provenance-panel/provenance-panel.js';
import '../../agent-tools/confirm-bar/confirm-bar.js';
import '../../overlays/empty/empty.js';
defineElement('memory-panel', LyraMemoryPanel);
