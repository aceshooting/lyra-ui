export * from './agent-tools/terminal/terminal.class.js';
import './lr-virtual-list.js';
import { LyraTerminal } from './agent-tools/terminal/terminal.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('terminal', LyraTerminal);
