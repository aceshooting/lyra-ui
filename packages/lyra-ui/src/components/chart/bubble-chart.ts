export * from './bubble-chart.class.js';
import { LyraBubbleChart } from './bubble-chart.class.js';
import { defineElement } from '../../internal/prefix.js';
import "./chart.js";
defineElement('bubble-chart', LyraBubbleChart);
