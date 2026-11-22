export * from './utility/counter/counter.class.js';
import { LyraCounter } from './utility/counter/counter.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('counter', LyraCounter);
