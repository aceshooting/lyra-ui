export * from './retrieval/graph-legend/graph-legend.class.js';
import { LyraGraphLegend } from './retrieval/graph-legend/graph-legend.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('graph-legend', LyraGraphLegend);
