export * from './model-viewer.class.js';
import { LyraModelViewer } from './model-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('model-viewer', LyraModelViewer);
