export * from './pie-chart.class.js';
import { LyraPieChart } from './pie-chart.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "./chart.js";
defineElement('pie-chart', LyraPieChart);
