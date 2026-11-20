export * from './forms/input/time-input.class.js';
import { LyraTimeInput } from './forms/input/time-input.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('time-input', LyraTimeInput);
