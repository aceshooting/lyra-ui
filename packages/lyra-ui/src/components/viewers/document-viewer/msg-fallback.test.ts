import { fixture, expect, html } from '@open-wc/testing';
import './document-viewer.js';
import '../email-viewer/email-viewer.js';
import '../xml-viewer/xml-viewer.js';
import '../notebook-viewer/notebook-viewer.js';
import '../../media/image-viewer/image-viewer.js';
import '../../media/av-player/av-player.js';
import { clearDocumentRenderers, findDocumentRenderer, type DocumentFile } from './registry.js';
import type { LyraDocumentViewer } from './document-viewer.js';

afterEach(() => {
  clearDocumentRenderers();
});

const MSG_FILE: DocumentFile = {
  name: 'quarterly-update.msg',
  mimeType: 'application/vnd.ms-outlook',
  src: 'https://example.test/quarterly-update.msg',
};

describe('.msg (Outlook) registry decision', () => {
  it('no built-in renderer claims application/vnd.ms-outlook or a .msg filename', () => {
    expect(findDocumentRenderer(MSG_FILE)).to.be.undefined;
  });

  it('lr-document-viewer falls back to the generic lr-document-preview download affordance for .msg', async () => {
    const el = (await fixture(html`
      <lr-document-viewer
        open
        name="quarterly-update.msg"
        mime-type="application/vnd.ms-outlook"
        src="https://example.test/quarterly-update.msg"
      ></lr-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    const preview = el.shadowRoot!.querySelector('[part="body"] lr-document-preview');
    expect(preview).to.exist;
    expect(preview!.getAttribute('filename')).to.equal('quarterly-update.msg');
    const downloadLink = el.shadowRoot!.querySelector('[part="download-link"]') as HTMLAnchorElement;
    expect(downloadLink).to.exist;
    expect(downloadLink.href).to.equal('https://example.test/quarterly-update.msg');
    expect(downloadLink.download).to.equal('quarterly-update.msg');
  });
});
