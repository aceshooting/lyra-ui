export * from './chunk-inspector.class.js';
import { LyraChunkInspector } from './chunk-inspector.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../layout/virtual-list/virtual-list.js';
import '../../overlays/empty/empty.js';
defineElement('chunk-inspector', LyraChunkInspector);
