export * from './forms/input/native-time-input.class.js';
import { LyraNativeTimeInput } from './forms/input/native-time-input.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('native-time-input', LyraNativeTimeInput);
