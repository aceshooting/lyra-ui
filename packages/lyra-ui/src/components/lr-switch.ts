export * from './forms/switch/switch.class.js';
import { LyraSwitch } from './forms/switch/switch.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('switch', LyraSwitch);
