import { expect } from '@open-wc/testing';
import JSZip from 'jszip';
import { MINIMAL_EPUB_BASE64 } from './minimal-epub-fixture.js';

function toBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

it('is a valid EPUB container with the expected package and one spine item', async () => {
  const zip = await JSZip.loadAsync(toBuffer(MINIMAL_EPUB_BASE64));
  const mimetype = await zip.file('mimetype')!.async('text');
  const packageXml = await zip.file('OEBPS/content.opf')!.async('text');
  expect(mimetype).to.equal('application/epub+zip');
  expect(packageXml).to.contain('<itemref idref="chapter1"/>');
});
