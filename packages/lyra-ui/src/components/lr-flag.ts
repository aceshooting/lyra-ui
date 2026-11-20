export * from './media/flag/flag.class.js';
import { LyraFlag } from './media/flag/flag.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-skeleton.js';
defineElement('flag', LyraFlag);
