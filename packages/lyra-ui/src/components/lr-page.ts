export * from './layout/page/page.class.js';
import { defineElement } from '../internal/prefix.js';
import { LyraPage } from './layout/page/page.class.js';

defineElement('page', LyraPage);
