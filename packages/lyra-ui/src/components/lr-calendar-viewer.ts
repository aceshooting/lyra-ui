export * from './viewers/calendar-viewer/calendar-loader.js';
export * from './viewers/calendar-viewer/calendar-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './viewers/calendar-viewer/calendar-viewer-register.js';
import { LyraCalendarViewer } from './viewers/calendar-viewer/calendar-viewer.class.js';
defineElement('calendar-viewer', LyraCalendarViewer);
