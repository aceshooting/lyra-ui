export * from './forms/otp-input/otp-input.class.js';
import { LyraOtpInput } from './forms/otp-input/otp-input.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('otp-input', LyraOtpInput);
