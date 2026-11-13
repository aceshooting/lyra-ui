import { html } from '@open-wc/testing';
import { describeViewerResponseLifecycle } from '../../../../test/contracts/viewer-response-lifecycle.js';
import { loadPapaParseCached } from '../../../internal/papaparse-loader.js';
import './dataset-viewer.js';

describeViewerResponseLifecycle('lr-dataset-viewer', html`<lr-dataset-viewer></lr-dataset-viewer>`, {
  extension: 'tsv', contentSelector: '[part="header-cell"]',
  source: label => `${label}\nactive`, preload: loadPapaParseCached,
});
