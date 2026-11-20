export * from './layout/breadcrumb/breadcrumb.class.js';
import { LyraBreadcrumb } from './layout/breadcrumb/breadcrumb.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('breadcrumb', LyraBreadcrumb);
