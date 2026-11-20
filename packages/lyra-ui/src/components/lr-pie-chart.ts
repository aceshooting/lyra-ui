export * from './charts/chart/pie-chart.class.js';
import { LyraPieChart } from './charts/chart/pie-chart.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-chart.js';
defineElement('pie-chart', LyraPieChart);
