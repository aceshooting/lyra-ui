export * from './json-viewer.class.js';
import { LyraJsonViewer } from './json-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('json-viewer', LyraJsonViewer);
