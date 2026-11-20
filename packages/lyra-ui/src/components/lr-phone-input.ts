export * from './forms/phone-input/phone-input.class.js';
import { LyraPhoneInput } from './forms/phone-input/phone-input.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('phone-input', LyraPhoneInput);
