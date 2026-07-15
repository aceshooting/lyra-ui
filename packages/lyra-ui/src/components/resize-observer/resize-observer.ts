export * from './resize-observer.class.js';
import { LyraResizeObserver } from './resize-observer.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('resize-observer', LyraResizeObserver);
