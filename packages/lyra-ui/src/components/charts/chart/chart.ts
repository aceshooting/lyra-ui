export * from './chart.class.js';
import { LyraChart } from './chart.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "../../overlays/skeleton/skeleton.js";
defineElement('chart', LyraChart);
