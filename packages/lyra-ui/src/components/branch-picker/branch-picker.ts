export * from './branch-picker.class.js';
import { LyraBranchPicker } from './branch-picker.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../live-region/live-region.js';
defineElement('branch-picker', LyraBranchPicker);
