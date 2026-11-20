export * from './forms/radio/radio-button.class.js';
import { LyraRadioButton } from './forms/radio/radio-button.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('radio-button', LyraRadioButton);
