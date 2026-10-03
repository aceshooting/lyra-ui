export { LyraDocxEditor } from './docx-editor.class.js';
import { LyraDocxEditor } from './docx-editor.class.js';
import { defineElement } from '@aceshooting/lyra-ui/utilities/prefix.js';
import '@aceshooting/lyra-ui/components/lr-button.js';
import '@aceshooting/lyra-ui/components/lr-select.js';
import '@aceshooting/lyra-ui/components/lr-option.js';
import '@aceshooting/lyra-ui/components/lr-combobox.js';
import '@aceshooting/lyra-ui/components/lr-number-input.js';
import '@aceshooting/lyra-ui/components/lr-color-picker.js';
import '@aceshooting/lyra-ui/components/lr-popover.js';
import '@aceshooting/lyra-ui/components/lr-input.js';
import '@aceshooting/lyra-ui/components/lr-checkbox.js';

defineElement('docx-editor', LyraDocxEditor);
