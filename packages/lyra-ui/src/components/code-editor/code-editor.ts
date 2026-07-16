export * from './code-editor.class.js';
import { LyraCodeEditor } from './code-editor.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('code-editor', LyraCodeEditor);
