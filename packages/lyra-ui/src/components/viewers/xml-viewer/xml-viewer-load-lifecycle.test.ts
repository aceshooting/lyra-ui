import { html } from '@open-wc/testing';
import { describeViewerResponseLifecycle } from '../../../../test/contracts/viewer-response-lifecycle.js';
import './xml-viewer.js';

describeViewerResponseLifecycle('lr-xml-viewer', html`<lr-xml-viewer></lr-xml-viewer>`, {
  extension: 'xml', contentSelector: '[part="tag"]', source: label => `<${label}/>`,
});
