export type { FormOwnerValue } from '../internal/direct-form-associated.js';
export type { LyraLocaleLoader } from '../internal/locale-loader.js';
export type { LyraLocaleDirection } from '../internal/localization-types.js';
export * from './forms/locale-picker/locale-picker.class.js';
import { LyraLocalePicker } from './forms/locale-picker/locale-picker.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-flag.js';
defineElement('locale-picker', LyraLocalePicker);
