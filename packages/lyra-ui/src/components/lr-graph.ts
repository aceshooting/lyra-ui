export * from './retrieval/graph/graph.class.js';
import { LyraGraph } from './retrieval/graph/graph.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-skeleton.js';
defineElement('graph', LyraGraph);
