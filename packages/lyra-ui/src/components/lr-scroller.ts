export * from './layout/scroller/scroller.class.js';
import { LyraScroller } from './layout/scroller/scroller.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('scroller', LyraScroller);
