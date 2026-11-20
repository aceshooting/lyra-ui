export * from './utility/resize-observer/resize-observer.class.js';
import { LyraResizeObserver } from './utility/resize-observer/resize-observer.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('resize-observer', LyraResizeObserver);
