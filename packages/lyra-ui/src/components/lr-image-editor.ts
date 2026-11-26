export * from './media/image-editor/image-editor.class.js';
import { LyraImageEditor } from './media/image-editor/image-editor.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('image-editor', LyraImageEditor);
