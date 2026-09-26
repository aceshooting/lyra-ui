export * from './streaming-text-core.class.js';
import { LyraStreamingTextCore } from './streaming-text-core.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../markdown/markdown-core.js';
defineElement('streaming-text-core', LyraStreamingTextCore);
