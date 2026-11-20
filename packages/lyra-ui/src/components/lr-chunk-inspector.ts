export * from './retrieval/chunk-inspector/chunk-inspector.class.js';
import { LyraChunkInspector } from './retrieval/chunk-inspector/chunk-inspector.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-virtual-list.js';
import './lr-empty.js';
defineElement('chunk-inspector', LyraChunkInspector);
