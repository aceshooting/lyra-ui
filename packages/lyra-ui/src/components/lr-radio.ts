export * from './forms/radio/radio.class.js';
import { LyraRadio } from './forms/radio/radio.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('radio', LyraRadio);
