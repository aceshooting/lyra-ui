export type { LyraChartType } from './charts/chart/chart.class.js';
export * from './charts/chart/polar-area-chart.class.js';
import { LyraPolarAreaChart } from './charts/chart/polar-area-chart.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-chart.js';
defineElement('polar-area-chart', LyraPolarAreaChart);
