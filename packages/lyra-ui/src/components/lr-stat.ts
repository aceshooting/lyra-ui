export * from './data/stat/stat.class.js';
import { LyraStat } from './data/stat/stat.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('stat', LyraStat);
