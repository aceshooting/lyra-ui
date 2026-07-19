export * from './intersection-observer.class.js';
import { LyraIntersectionObserver } from './intersection-observer.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('intersection-observer', LyraIntersectionObserver);
