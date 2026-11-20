export type { FormOwnerValue } from '../internal/direct-form-associated.js';
export * from './media/file-input/file-input.class.js';
import { LyraFileInput } from './media/file-input/file-input.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('file-input', LyraFileInput);
