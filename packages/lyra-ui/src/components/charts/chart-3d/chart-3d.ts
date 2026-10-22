export * from './chart-3d.class.js';
import { LyraChart3d } from './chart-3d.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('chart-3d', LyraChart3d);
