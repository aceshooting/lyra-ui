export * from './code-block-core.class.js';
export type { ShikiLanguageInput } from './shiki-types.js';
import { LyraCodeBlockCore } from './code-block-core.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "../../overlays/skeleton/skeleton.js";
defineElement('code-block-core', LyraCodeBlockCore);
