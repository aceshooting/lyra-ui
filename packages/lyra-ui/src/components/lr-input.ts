export * from './forms/input/input.class.js';
import { LyraInput } from './forms/input/input.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('input', LyraInput);
