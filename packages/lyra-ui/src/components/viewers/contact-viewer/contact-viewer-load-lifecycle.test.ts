import { html } from '@open-wc/testing';
import { describeViewerResponseLifecycle } from '../../../../test/contracts/viewer-response-lifecycle.js';
import './contact-viewer.js';

describeViewerResponseLifecycle('lr-contact-viewer', html`<lr-contact-viewer></lr-contact-viewer>`, {
  extension: 'vcf', contentSelector: '[part="contact-name"]',
  source: label => ['BEGIN:VCARD', 'VERSION:4.0', `FN:${label}`, 'END:VCARD'].join('\r\n'),
});
