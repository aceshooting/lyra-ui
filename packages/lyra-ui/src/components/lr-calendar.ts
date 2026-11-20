export * from './data/calendar/calendar.class.js';
import { LyraCalendar } from './data/calendar/calendar.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('calendar', LyraCalendar);
