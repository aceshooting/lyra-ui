/** @deprecated Import @aceshooting/lyra-ui/components/lr-dropdown-item.js to register this component. */
export * from './dropdown-item.class.js';
import { LyraDropdownItem } from './dropdown-item.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './menu.js';
defineElement('dropdown-item', LyraDropdownItem);
