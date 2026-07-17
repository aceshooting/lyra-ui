export * from './widget-renderer.class.js';
export * from './resolve.js';
export * from './registry.js';
export * from './default-registry.js';
import { LyraWidgetRenderer } from './widget-renderer.class.js';
import { registerDefaultWidgetTypes } from './default-registry.js';
import { defineElement } from '../../internal/prefix.js';
registerDefaultWidgetTypes();
defineElement('widget-renderer', LyraWidgetRenderer);
