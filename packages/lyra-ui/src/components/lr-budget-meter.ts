export * from './agent-tools/budget-meter/budget-meter.class.js';
import { defineElement } from '../internal/prefix.js';
import { LyraBudgetMeter } from './agent-tools/budget-meter/budget-meter.class.js';

defineElement('budget-meter', LyraBudgetMeter);
