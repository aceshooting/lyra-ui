import { html } from '@open-wc/testing';
import { describeViewerResponseLifecycle } from '../../../../test/contracts/viewer-response-lifecycle.js';
import { loadHtmlSanitizer } from './dompurify-loader.js';
import './html-viewer.js';

describeViewerResponseLifecycle('lr-html-viewer', html`<lr-html-viewer></lr-html-viewer>`, {
  extension: 'html', contentSelector: '[part="html"]',
  source: label => `<p>${label}</p>`, preload: loadHtmlSanitizer,
});
