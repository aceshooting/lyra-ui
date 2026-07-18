export * from './markdown-core.class.js';
import { LyraMarkdownCore } from './markdown-core.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('markdown-core', LyraMarkdownCore);
