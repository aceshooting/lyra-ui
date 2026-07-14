export * from './lite-chart.class.js';
import { LyraLiteChart } from './lite-chart.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../live-region/live-region.js';
defineElement('lite-chart', LyraLiteChart);
