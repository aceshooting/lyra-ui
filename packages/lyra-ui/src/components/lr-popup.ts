export * from './overlays/popup/popup.class.js';
import { LyraPopup } from './overlays/popup/popup.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('popup', LyraPopup);
