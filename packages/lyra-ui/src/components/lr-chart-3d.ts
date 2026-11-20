export * from './charts/chart-3d/chart-3d.class.js';
import { LyraChart3d } from './charts/chart-3d/chart-3d.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('chart-3d', LyraChart3d);
