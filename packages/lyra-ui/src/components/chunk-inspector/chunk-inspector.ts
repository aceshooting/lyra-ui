export * from './chunk-inspector.class.js';
import { LyraChunkInspector } from './chunk-inspector.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../virtual-list/virtual-list.js';
import '../empty/empty.js';
defineElement('chunk-inspector', LyraChunkInspector);
