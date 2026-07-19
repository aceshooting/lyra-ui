export * from './mutation-observer.class.js';
import { LyraMutationObserver } from './mutation-observer.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('mutation-observer', LyraMutationObserver);
