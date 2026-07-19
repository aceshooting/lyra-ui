export * from './box-plot.class.js';
import { LyraBoxPlot } from './box-plot.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "../../overlays/skeleton/skeleton.js";
defineElement('box-plot', LyraBoxPlot);
