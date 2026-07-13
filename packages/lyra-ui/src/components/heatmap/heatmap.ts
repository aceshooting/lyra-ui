export * from './heatmap.class.js';
import { LyraHeatmap } from './heatmap.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('heatmap', LyraHeatmap);
