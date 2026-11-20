export * from './charts/chart/box-plot.class.js';
import { LyraBoxPlot } from './charts/chart/box-plot.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-skeleton.js';
defineElement('box-plot', LyraBoxPlot);
