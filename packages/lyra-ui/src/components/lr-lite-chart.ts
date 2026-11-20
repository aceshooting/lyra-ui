export * from './charts/chart/lite-chart.class.js';
import { LyraLiteChart } from './charts/chart/lite-chart.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-live-region.js';
defineElement('lite-chart', LyraLiteChart);
