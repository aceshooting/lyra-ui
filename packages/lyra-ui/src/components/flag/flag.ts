export * from './flag.class.js';
import { LyraFlag } from './flag.class.js';
import { defineElement } from '../../internal/prefix.js';
import "../skeleton/skeleton.js";
defineElement('flag', LyraFlag);
