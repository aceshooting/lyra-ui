export * from './retrieval/chunk-inspector/chunk-inspector.class.js';
import { LyraChunkInspector } from './retrieval/chunk-inspector/chunk-inspector.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-empty.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
// The virtualizer registers the first time the chunk count passes `virtualizeAt`.
defineLazyChildren('chunk-inspector', {
  'virtual-list': () => import('./lr-virtual-list.js'),
});
defineElement('chunk-inspector', LyraChunkInspector);
