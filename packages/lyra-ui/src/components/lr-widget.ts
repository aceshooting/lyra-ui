export * from './layout/widget/widget.class.js';
import { LyraWidget } from './layout/widget/widget.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('widget', LyraWidget);
