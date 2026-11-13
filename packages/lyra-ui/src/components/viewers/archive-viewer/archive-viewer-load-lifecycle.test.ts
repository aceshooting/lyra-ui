import { html } from '@open-wc/testing';
import { describeViewerResponseLifecycle } from '../../../../test/contracts/viewer-response-lifecycle.js';
import { assembleZip, zipEntry } from './fixtures/zip-builder.js';
import './archive-viewer.js';

describeViewerResponseLifecycle('lr-archive-viewer', html`<lr-archive-viewer></lr-archive-viewer>`, {
  extension: 'zip', contentSelector: '[part="entry-name"]',
  contentRoot: viewer => viewer.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot ?? null,
  source: async label => assembleZip([await zipEntry(`${label}.txt`, 'active')]),
});
