export * from './widget.class.js';
import { LyraWidget } from './widget.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('widget', LyraWidget);
