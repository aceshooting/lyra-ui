export * from './viewers/ebook-viewer/ebook-viewer.class.js';
import { LyraEbookViewer } from './viewers/ebook-viewer/ebook-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './viewers/ebook-viewer/ebook-viewer-register.js'; // also lets <lr-document-viewer> open this kind

defineElement('ebook-viewer', LyraEbookViewer);
