export * from './menubar.class.js';
import { LyraMenubar } from './menubar.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './menubar-item.js';
defineElement('menubar', LyraMenubar);
