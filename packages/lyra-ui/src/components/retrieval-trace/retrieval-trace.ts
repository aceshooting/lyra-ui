export * from './retrieval-trace.class.js';
import { LyraRetrievalTrace } from './retrieval-trace.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../span-waterfall/span-waterfall.js';
import '../chunk-inspector/chunk-inspector.js';

defineElement('retrieval-trace', LyraRetrievalTrace);
