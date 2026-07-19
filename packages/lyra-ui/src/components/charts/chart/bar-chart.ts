export * from './bar-chart.class.js';
import { LyraBarChart } from './bar-chart.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "./chart.js";
defineElement('bar-chart', LyraBarChart);
