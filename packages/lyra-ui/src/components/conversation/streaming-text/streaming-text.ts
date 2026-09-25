export * from './streaming-text.class.js';
import { LyraStreamingText } from './streaming-text.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../markdown/markdown.js';
defineElement('streaming-text', LyraStreamingText);
// policy-allow(component-dependency: lr-icon): Markdown's optional copy chrome uses the lean
// copy-button entry, whose icon-button renders supplied SVG glyphs and never requests lr-icon.
