import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './pptx-viewer.js';
import type { LyraPptxViewer } from './pptx-viewer.js';

function response(ok = true): Response {
  return { ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) } as unknown as Response;
}

function fakeModule(slideCount = 2) {
  const calls = { goToSlide: 0, destroy: 0 };
  const viewer = new EventTarget() as EventTarget & { slideCount: number; currentSlideIndex: number; goToSlide(index: number): Promise<void>; destroy(): void };
  viewer.slideCount = slideCount;
  viewer.currentSlideIndex = 0;
  viewer.goToSlide = async (index: number) => { calls.goToSlide++; viewer.currentSlideIndex = index; viewer.dispatchEvent(new CustomEvent('slidechange', { detail: { index } })); };
  viewer.destroy = () => { calls.destroy++; };
  return { calls, module: { PptxViewer: { open: async () => viewer }, RECOMMENDED_ZIP_LIMITS: {} } as never };
}

function stubFetch(ok = true): () => void {
  const original = window.fetch;
  window.fetch = (() => Promise.resolve(response(ok))) as typeof window.fetch;
  return () => { window.fetch = original; };
}

describe('lyra-pptx-viewer', () => {
  it('shows its persistent fidelity notice and idle state', async () => {
    const el = await fixture(html`<lyra-pptx-viewer></lyra-pptx-viewer>`);
    expect(el.shadowRoot!.querySelector('[part="notice"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="container"]')).to.not.exist;
    await expect(el).to.be.accessible();
  });

  it('mounts the renderer, navigates, and cleans up', async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lyra-pptx-viewer aria-label="Deck"></lyra-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await aTimeout(30);
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;
      (el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement).click();
      expect(fake.calls.goToSlide).to.equal(1);
      el.remove();
      expect(fake.calls.destroy).to.equal(1);
    } finally {
      restore();
    }
  });

  it('remounts the presentation after a synchronous reparent while connected, instead of leaving stale-looking live controls over an empty container', async () => {
    // Regression test: disconnectedCallback() used to tear the renderer down
    // without resetting `phase`/`slideCount`/`currentSlideIndex` -- and
    // nothing re-armed the mount on reconnect, since updated()'s
    // `changed.has('src')` gate never fires again for a reparent that leaves
    // `src` unchanged. The element re-rendered as an empty container with
    // live-looking nav controls whose prev/next buttons silently no-op
    // against a destroyed (undefined) viewer.
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lyra-pptx-viewer></lyra-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await aTimeout(30);
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;

      const otherContainer = document.createElement('div');
      document.body.appendChild(otherContainer);
      otherContainer.appendChild(el); // disconnect + reconnect synchronously, same instance
      await el.updateComplete;

      // Right after the reparent, the previous renderer was torn down -- the
      // viewer must fall back to an idle/empty state, not keep rendering nav
      // controls against a destroyed viewer.
      expect(fake.calls.destroy).to.equal(1);
      expect(
        el.shadowRoot!.querySelector('[part="container"]'),
        'must not still render a container as if a presentation were mounted',
      ).to.not.exist;

      // The reconnect re-arms the mount, so the presentation comes back
      // rather than the viewer staying permanently blank.
      await aTimeout(30);
      expect(el.shadowRoot!.querySelector('[part="container"]'), 'a reconnect must remount the presentation').to
        .exist;

      otherContainer.remove();
    } finally {
      restore();
    }
  });

  it('renders unsafe-url and missing-renderer errors', async () => {
    const unsafe = (await fixture(html`<lyra-pptx-viewer .src=${'javascript:alert(1)'}></lyra-pptx-viewer>`)) as LyraPptxViewer;
    await aTimeout(10);
    expect(unsafe.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('Document URL is not allowed');
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lyra-pptx-viewer></lyra-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => null;
      el.src = 'https://example.test/deck.pptx';
      await aTimeout(20);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('Failed to render this presentation');
    } finally {
      restore();
    }
  });
});
