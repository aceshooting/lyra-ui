export * from './data/heatmap/heatmap.class.js';
import { LyraHeatmap } from './data/heatmap/heatmap.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('heatmap', LyraHeatmap);
