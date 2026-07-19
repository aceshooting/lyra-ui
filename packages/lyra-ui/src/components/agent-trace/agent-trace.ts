export * from './agent-trace.class.js';
import { LyraAgentTrace } from './agent-trace.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../trace-tree/trace-tree.js';
import '../graph-legend/graph-legend.js';
import '../handoff-divider/handoff-divider.js';

defineElement('agent-trace', LyraAgentTrace);
