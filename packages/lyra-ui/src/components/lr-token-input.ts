export * from './forms/token-input/token-input.class.js';
import { LyraTokenInput } from './forms/token-input/token-input.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('token-input', LyraTokenInput);
