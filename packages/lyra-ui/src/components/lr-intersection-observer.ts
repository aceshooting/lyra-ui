export * from './utility/intersection-observer/intersection-observer.class.js';
import { LyraIntersectionObserver } from './utility/intersection-observer/intersection-observer.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('intersection-observer', LyraIntersectionObserver);
