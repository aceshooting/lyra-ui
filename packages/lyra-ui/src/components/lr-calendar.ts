export type { LyraDatePickerFirstDayOfWeek } from './forms/date-picker/date-picker.class.js';
export * from './data/calendar/calendar.class.js';
import { LyraCalendar } from './data/calendar/calendar.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('calendar', LyraCalendar);
