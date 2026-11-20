import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-archive-viewer.js';
import type { LyraArchiveViewer } from '../../lr-archive-viewer.js';
import type JSZipType from 'jszip';

async function zipBytes(): Promise<ArrayBuffer> {
  const module = (await import('jszip')) as unknown as { default: new () => JSZipType };
  const zip = new module.default();
  zip.file('src/index.js', 'console.log(1);', { createFolders: true });
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('lr-archive-viewer entry kind text', () => {
  it('keeps the File/Folder text visually hidden inside the virtual-list row', async () => {
    const buffer = await zipBytes();
    const original = window.fetch;
    window.fetch = (() => Promise.resolve({
      ok: true, status: 200, statusText: 'OK', arrayBuffer: () => Promise.resolve(buffer),
    } as Response)) as typeof window.fetch;
    try {
      const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer src="/a.zip"></lr-archive-viewer>`);
      const listOf = () => el.shadowRoot!.querySelector('lr-virtual-list');
      await waitUntil(() => (listOf()?.shadowRoot?.querySelectorAll('[part~="entry-name"]').length ?? 0) > 0, 'entry rows did not render');
      const list = listOf();
      expect(list!.shadowRoot!.querySelectorAll('[part~="entry-kind"]').length).to.be.greaterThan(0);
      for (const kind of list!.shadowRoot!.querySelectorAll<HTMLElement>('[part~="entry-kind"]')) {
        const rect = kind.getBoundingClientRect();
        expect(rect.width, 'entry-kind width').to.be.at.most(1);
        expect(rect.height, 'entry-kind height').to.be.at.most(1);
        expect(kind.textContent!.trim().length).to.be.greaterThan(0);
      }
    } finally {
      window.fetch = original;
    }
  });
});
