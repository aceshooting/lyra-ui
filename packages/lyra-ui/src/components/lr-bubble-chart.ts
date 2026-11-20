export * from './charts/chart/bubble-chart.class.js';
import { LyraBubbleChart } from './charts/chart/bubble-chart.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-chart.js';
defineElement('bubble-chart', LyraBubbleChart);
