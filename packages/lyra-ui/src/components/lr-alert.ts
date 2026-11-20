export * from './overlays/alert/alert.class.js';
import { defineElement } from '../internal/prefix.js';
import { LyraAlert } from './overlays/alert/alert.class.js';

defineElement('alert', LyraAlert);
