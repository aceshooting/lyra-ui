export * from './conversation/branch-picker/branch-picker.class.js';
import { LyraBranchPicker } from './conversation/branch-picker/branch-picker.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-live-region.js';
defineElement('branch-picker', LyraBranchPicker);
