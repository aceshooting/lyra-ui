export * from './streaming-text-core.class.js';
import { LyraStreamingTextCore } from './streaming-text-core.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../markdown/markdown-core.js';
defineElement('streaming-text-core', LyraStreamingTextCore);
// policy-allow(component-dependency: lr-icon): Markdown's optional copy chrome uses the lean
// copy-button entry, whose icon-button renders supplied SVG glyphs and never requests lr-icon.
