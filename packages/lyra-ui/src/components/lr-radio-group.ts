export type { FormOwnerValue } from '../internal/direct-form-associated.js';
export * from './forms/radio/radio-group.class.js';
import { LyraRadioGroup } from './forms/radio/radio-group.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('radio-group', LyraRadioGroup);
