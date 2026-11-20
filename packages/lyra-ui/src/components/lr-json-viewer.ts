import './lr-virtual-list.js';
export * from './utility/json-viewer/json-viewer.class.js';
import { LyraJsonViewer } from './utility/json-viewer/json-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('json-viewer', LyraJsonViewer);
