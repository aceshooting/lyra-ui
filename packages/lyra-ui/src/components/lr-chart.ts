export * from './charts/chart/chart.class.js';
import { LyraChart } from './charts/chart/chart.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-skeleton.js';
defineElement('chart', LyraChart);
