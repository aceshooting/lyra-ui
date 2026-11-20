export * from './forms/signature-pad/signature-pad.class.js';
import { LyraSignaturePad } from './forms/signature-pad/signature-pad.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('signature-pad', LyraSignaturePad);
