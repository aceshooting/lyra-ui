export type { LyraChartType } from './charts/chart/chart.class.js';
export * from './charts/chart/radar-chart.class.js';
import { LyraRadarChart } from './charts/chart/radar-chart.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-chart.js';
defineElement('radar-chart', LyraRadarChart);
