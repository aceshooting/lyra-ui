/** @deprecated Import @aceshooting/lyra-ui/components/lr-calendar-viewer.js to register this component. */
export * from './calendar-loader.js';
export * from './calendar-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './calendar-viewer-register.js';
import { LyraCalendarViewer } from './calendar-viewer.class.js';
defineElement('calendar-viewer', LyraCalendarViewer);
