export * from './code-block.class.js';
import { LyraCodeBlock } from './code-block.class.js';
import { defineElement } from '../../internal/prefix.js';
import "../skeleton/skeleton.js";
defineElement('code-block', LyraCodeBlock);
