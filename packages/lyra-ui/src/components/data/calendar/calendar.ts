/** @deprecated Import @aceshooting/lyra-ui/components/lr-calendar.js to register this component. */
export * from './calendar.class.js';
import { LyraCalendar } from './calendar.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('calendar', LyraCalendar);
