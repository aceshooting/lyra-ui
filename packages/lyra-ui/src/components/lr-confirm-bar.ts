export * from './agent-tools/confirm-bar/confirm-bar.class.js';
import { LyraConfirmBar } from './agent-tools/confirm-bar/confirm-bar.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-live-region.js';
import './lr-button.js';
defineElement('confirm-bar', LyraConfirmBar);
