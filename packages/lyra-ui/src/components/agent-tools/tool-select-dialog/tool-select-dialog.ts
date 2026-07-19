export * from './tool-select-dialog.class.js';
import { LyraToolSelectDialog } from './tool-select-dialog.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "../../forms/checkbox/checkbox.js";
import "../../forms/switch/switch.js";
defineElement('tool-select-dialog', LyraToolSelectDialog);
