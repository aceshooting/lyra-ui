export * from './data/treemap/treemap.class.js';
import { LyraTreemap } from './data/treemap/treemap.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('treemap', LyraTreemap);
