export * from './viewers/html-viewer/html-viewer.class.js';
import { LyraHtmlViewer } from './viewers/html-viewer/html-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './viewers/html-viewer/html-viewer-register.js';

defineElement('html-viewer', LyraHtmlViewer);
