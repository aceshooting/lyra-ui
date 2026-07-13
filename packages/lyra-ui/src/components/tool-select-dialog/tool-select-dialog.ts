export * from './tool-select-dialog.class.js';
import { LyraToolSelectDialog } from './tool-select-dialog.class.js';
import { defineElement } from '../../internal/prefix.js';
import "../checkbox/checkbox.js";
import "../switch/switch.js";
defineElement('tool-select-dialog', LyraToolSelectDialog);
