import { html } from '@open-wc/testing';
import { describeViewerResponseLifecycle } from '../../../../test/contracts/viewer-response-lifecycle.js';
import { loadPapaParseCached } from '../../../internal/papaparse-loader.js';
import './csv-viewer.js';

describeViewerResponseLifecycle('lr-csv-viewer', html`<lr-csv-viewer></lr-csv-viewer>`, {
  extension: 'csv', contentSelector: '[role="columnheader"]',
  source: label => `${label}\nactive`, preload: loadPapaParseCached,
});
