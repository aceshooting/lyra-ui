export * from './utility/mutation-observer/mutation-observer.class.js';
import { LyraMutationObserver } from './utility/mutation-observer/mutation-observer.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('mutation-observer', LyraMutationObserver);
