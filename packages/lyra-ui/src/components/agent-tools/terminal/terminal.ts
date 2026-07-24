export * from './terminal.class.js';
import '../../layout/virtual-list/virtual-list.js';
import { LyraTerminal } from './terminal.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('terminal', LyraTerminal);
