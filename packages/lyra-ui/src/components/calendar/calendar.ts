export * from './calendar.class.js';
import { LyraCalendar } from './calendar.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('calendar', LyraCalendar);
