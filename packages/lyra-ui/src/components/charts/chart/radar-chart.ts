/** @deprecated Import @aceshooting/lyra-ui/components/lr-radar-chart.js to register this component. */
export * from './radar-chart.class.js';
import { LyraRadarChart } from './radar-chart.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './chart.js';
defineElement('radar-chart', LyraRadarChart);
