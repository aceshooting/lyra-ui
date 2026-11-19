/** @deprecated Import @aceshooting/lyra-ui/components/lr-knowledge-graph-explorer.js to register this component. */
export * from './knowledge-graph-explorer.class.js';
import { LyraKnowledgeGraphExplorer } from './knowledge-graph-explorer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../graph/graph.js';
import '../../overlays/chip/chip.js';
import '../graph-legend/graph-legend.js';
import '../../overlays/overlay/popover.js';
import '../../forms/input/input.js';
import '../../forms/button/button.js';
defineElement('knowledge-graph-explorer', LyraKnowledgeGraphExplorer);
