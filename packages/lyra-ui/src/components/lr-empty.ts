export * from './overlays/empty/empty.class.js';
import { LyraEmpty } from './overlays/empty/empty.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('empty', LyraEmpty);
