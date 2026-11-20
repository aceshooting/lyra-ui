export * from './retrieval/retrieval-trace/retrieval-trace.class.js';
import { LyraRetrievalTrace } from './retrieval/retrieval-trace/retrieval-trace.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-span-waterfall.js';
import './lr-chunk-inspector.js';

defineElement('retrieval-trace', LyraRetrievalTrace);
