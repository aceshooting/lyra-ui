export type { LyraInputEventMap } from './forms/input/input-shared.js';
export * from './forms/input/number-input.class.js';
import { LyraNumberInput } from './forms/input/number-input.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('number-input', LyraNumberInput);
