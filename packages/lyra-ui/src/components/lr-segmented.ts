export * from './layout/segmented/segmented.class.js';
import { LyraSegmented } from './layout/segmented/segmented.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('segmented', LyraSegmented);
