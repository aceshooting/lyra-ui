export * from './dropdown.class.js';
import { LyraDropdown } from './dropdown.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../layout/menu/menu.js';
defineElement('dropdown', LyraDropdown);
