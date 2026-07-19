export * from './menu.class.js';
import { LyraMenu } from './menu.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "./menu-item.js";
defineElement('menu', LyraMenu);
