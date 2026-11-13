import { html } from '@open-wc/testing';
import { describeViewerResponseLifecycle } from '../../../../test/contracts/viewer-response-lifecycle.js';
import { loadSvgSanitizer } from './dompurify-loader.js';
import './svg-viewer.js';

describeViewerResponseLifecycle('lr-svg-viewer', html`<lr-svg-viewer></lr-svg-viewer>`, {
  extension: 'svg', contentSelector: '[part="svg"]',
  source: label => `<svg xmlns="http://www.w3.org/2000/svg"><text>${label}</text></svg>`, preload: loadSvgSanitizer,
});
