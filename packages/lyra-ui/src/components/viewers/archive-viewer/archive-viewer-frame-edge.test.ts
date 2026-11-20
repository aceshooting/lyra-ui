import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-archive-viewer.js';
import type { LyraArchiveViewer } from '../../lr-archive-viewer.js';
import type JSZipType from 'jszip';

async function zipBytes(): Promise<ArrayBuffer> {
  const module = (await import('jszip')) as unknown as { default: new () => JSZipType };
  const zip = new module.default();
  zip.file('README.txt', 'twenty bytes of text');
  zip.folder('src');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('lr-archive-viewer frame edge', () => {
  it('draws no divider under the last entry, so the frame border is the single bottom edge', async () => {
    const buffer = await zipBytes();
    const original = window.fetch;
    window.fetch = (() => Promise.resolve({
      ok: true, status: 200, statusText: 'OK', arrayBuffer: () => Promise.resolve(buffer),
    } as Response)) as typeof window.fetch;
    try {
      const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer src="/a.zip"></lr-archive-viewer>`);
      const entriesOf = () => [...el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll<HTMLElement>('[part~="entry"]') ?? []];
      await waitUntil(() => entriesOf().length === 2, 'entry rows did not render');
      const [first, last] = entriesOf();
      expect(parseFloat(getComputedStyle(first!).borderBottomWidth)).to.be.greaterThan(0);
      expect(parseFloat(getComputedStyle(last!).borderBottomWidth)).to.equal(0);
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const frame = parseFloat(getComputedStyle(base).borderBottomWidth);
      expect(frame).to.be.greaterThan(0);
      // Rows settle after their first measurement; the frame then hugs the last row.
      await waitUntil(() => base.getBoundingClientRect().bottom - last!.getBoundingClientRect().bottom <= frame + 0.5, 'the frame did not close on the last row');
    } finally {
      window.fetch = original;
    }
  });
});
