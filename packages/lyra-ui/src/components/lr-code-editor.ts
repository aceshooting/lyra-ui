export type { LyraTextResize } from '../internal/safe-css.js';
export * from './forms/code-editor/code-editor.class.js';
import { LyraCodeEditor } from './forms/code-editor/code-editor.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('code-editor', LyraCodeEditor);
