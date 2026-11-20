export * from './layout/app-rail/app-rail.class.js';
import { LyraAppRail } from './layout/app-rail/app-rail.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-app-rail-item.js';
defineElement('app-rail', LyraAppRail);
