import { html } from '@open-wc/testing';
import JSZip from 'jszip';
import { describeViewerResponseLifecycle } from '../../../../test/contracts/viewer-response-lifecycle.js';
import { loadDocxDeps } from './docx-loader.js';
import { MINIMAL_DOCX_BASE64 } from './fixtures/minimal-docx-fixture.js';
import './docx-viewer.js';

describeViewerResponseLifecycle('lr-docx-viewer', html`<lr-docx-viewer></lr-docx-viewer>`, {
  extension: 'docx', contentSelector: '[part="content"]', preload: loadDocxDeps,
  async source(label) {
    const archive = await JSZip.loadAsync(MINIMAL_DOCX_BASE64, { base64: true });
    const document = archive.file('word/document.xml');
    if (!document) throw new Error('The DOCX fixture must contain its main document');
    const xml = await document.async('string');
    archive.file('word/document.xml', xml.replace('Lyra UI Test Fixture', label));
    return archive.generateAsync({ type: 'arraybuffer' });
  },
});
