export * from './data/context-meter/context-meter.class.js';
import { LyraContextMeter } from './data/context-meter/context-meter.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('context-meter', LyraContextMeter);
