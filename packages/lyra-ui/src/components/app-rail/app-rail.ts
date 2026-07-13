export * from './app-rail.class.js';
import { LyraAppRail } from './app-rail.class.js';
import { defineElement } from '../../internal/prefix.js';
import "./app-rail-item.js";
defineElement('app-rail', LyraAppRail);
