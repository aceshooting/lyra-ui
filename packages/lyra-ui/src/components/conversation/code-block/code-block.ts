export * from './code-block.class.js';
export type { ShikiLanguageInput } from './shiki-types.js';
import { LyraCodeBlock } from './code-block.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/skeleton/skeleton.js';
defineElement('code-block', LyraCodeBlock);
