export * from './selection-toolbar.class.js';
import '../../forms/button/button.js';
import { defineElement } from '../../../internal/prefix.js';
import { LyraSelectionToolbar } from './selection-toolbar.class.js';

defineElement('selection-toolbar', LyraSelectionToolbar);
