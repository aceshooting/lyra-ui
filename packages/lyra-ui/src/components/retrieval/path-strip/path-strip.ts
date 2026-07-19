export * from './path-strip.class.js';
import { LyraPathStrip } from './path-strip.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../layout/scroller/scroller.js';
defineElement('path-strip', LyraPathStrip);
