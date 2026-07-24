import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { LitElement, type PropertyValues } from 'lit';
import './pptx-viewer.js';
import type { LyraPptxViewer } from './pptx-viewer.js';
import type { PptxRendererModule } from './pptx-loader.js';
import { styles } from './pptx-viewer.styles.js';

function response(ok = true): Response {
  return { ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) } as unknown as Response;
}

/** A promise plus its externally-callable resolve/reject, for precisely timing a stale in-flight
 *  `mount()` against a later superseding `src` change. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
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

describe('lr-pptx-viewer', () => {
  it('uses host aria-label, label, name, then the localized default for its region name', async () => {
    const el = (await fixture(
      html`<lr-pptx-viewer aria-label="Host deck" label="API deck" name="Visible deck"></lr-pptx-viewer>`,
    )) as LyraPptxViewer;
    const base = () => el.shadowRoot!.querySelector('[part="base"]')!;

    expect(base().getAttribute('aria-label')).to.equal('Host deck');
    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(base().getAttribute('aria-label')).to.equal('API deck');
    el.label = '';
    await el.updateComplete;
    expect(base().getAttribute('aria-label')).to.equal('Visible deck');
    el.name = '';
    await el.updateComplete;
    expect(base().getAttribute('aria-label')).to.equal('Presentation viewer');
  });

  it('shows its persistent fidelity notice and idle state', async () => {
    const el = await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`);
    expect(el.shadowRoot!.querySelector('[part="notice"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="container"]')).to.not.exist;
    await expect(el).to.be.accessible();
  });

  it('mounts the renderer, navigates, and cleans up', async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-pptx-viewer aria-label="Deck"></lr-pptx-viewer>`)) as LyraPptxViewer;
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
      const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
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

  it('gives the previous/next slide-nav buttons the shared minimum hit area', async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await aTimeout(30);
      const previous = el.shadowRoot!.querySelector('[part="previous-button"]') as HTMLElement;
      const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLElement;

      expect(getComputedStyle(previous).minInlineSize).to.equal('40px');
      expect(getComputedStyle(previous).minBlockSize).to.equal('40px');
      expect(getComputedStyle(next).minInlineSize).to.equal('40px');
      expect(getComputedStyle(next).minBlockSize).to.equal('40px');
    } finally {
      restore();
    }
  });

  it('chains updated() to super.updated() so a mixin layered under LyraElement would still run', async () => {
    // No shared mixin actually overrides updated() today, so the only way to prove the chain is
    // live (rather than grepping source text for the call) is to patch the base-class hook itself
    // -- the exact hook a future mixin would extend -- and confirm it actually fires.
    const hadOwn = Object.prototype.hasOwnProperty.call(LitElement.prototype, 'updated');
    const original = (LitElement.prototype as unknown as { updated?: (changed: PropertyValues) => void })
      .updated;
    let called = false;
    (LitElement.prototype as unknown as { updated: (changed: PropertyValues) => void }).updated = function (
      this: LitElement,
      changed: PropertyValues,
    ) {
      called = true;
      original?.call(this, changed);
    };
    try {
      const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      await el.updateComplete;
      expect(called).to.be.true;
    } finally {
      if (hadOwn) {
        (LitElement.prototype as unknown as { updated: unknown }).updated = original;
      } else {
        delete (LitElement.prototype as unknown as { updated?: unknown }).updated;
      }
    }
  });

  it('honors a strings override for the persistent fidelity notice', async () => {
    const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
    expect(el.shadowRoot!.querySelector('[part="notice"]')!.textContent).to.equal('Some slide content may not display.');
    el.strings = { pptxViewerFidelityNotice: 'Certains contenus de diapositive peuvent ne pas s’afficher.' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="notice"]')!.textContent).to.equal('Certains contenus de diapositive peuvent ne pas s’afficher.');
  });

  it('is accessible with a mounted presentation and its slide-nav controls visible', async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-pptx-viewer aria-label="Deck"></lr-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await aTimeout(30);
      expect(el.shadowRoot!.querySelectorAll('[part="nav"]').length).to.equal(1);
      expect(el.shadowRoot!.querySelectorAll('[part="previous-button"]').length).to.equal(1);
      expect(el.shadowRoot!.querySelectorAll('[part="next-button"]').length).to.equal(1);
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });

  it('renders unsafe-url and missing-renderer errors', async () => {
    const unsafe = (await fixture(html`<lr-pptx-viewer .src=${'javascript:alert(1)'}></lr-pptx-viewer>`)) as LyraPptxViewer;
    await aTimeout(10);
    expect(unsafe.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('Document URL is not allowed');
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => null;
      el.src = 'https://example.test/deck.pptx';
      await aTimeout(20);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('Failed to render this presentation');
    } finally {
      restore();
    }
  });

  it('emits one render error for unsafe URL, missing renderer, and non-ok HTTP routes', async () => {
    const unsafe = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
    const unsafeEvent = oneEvent(unsafe, 'lr-render-error');
    unsafe.src = 'javascript:alert(1)';
    expect((await unsafeEvent).detail.error).to.exist;

    const restoreOk = stubFetch();
    try {
      const missing = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      missing.loadRenderer = async () => null;
      const missingEvent = oneEvent(missing, 'lr-render-error');
      missing.src = 'https://example.test/deck.pptx';
      expect((await missingEvent).detail.error).to.exist;
    } finally {
      restoreOk();
    }

    const fake = fakeModule();
    const restoreMissing = stubFetch(false);
    try {
      const http = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      http.loadRenderer = async () => fake.module;
      const httpEvent = oneEvent(http, 'lr-render-error');
      http.src = 'https://example.test/missing.pptx';
      expect((await httpEvent).detail.error).to.exist;
    } finally {
      restoreMissing();
    }
  });

  it('loads without an abort signal when AbortController is unavailable', async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    const originalAbortController = window.AbortController;
    (window as unknown as { AbortController?: unknown }).AbortController = undefined;
    try {
      const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      const listener = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/deck.pptx';
      expect((await listener).detail).to.deep.equal({ slideCount: 2 });
    } finally {
      window.AbortController = originalAbortController;
      restore();
    }
  });

  it('fails closed with a localized error when the pptx renderer peer fails to load', async () => {
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => { throw new Error('peer unavailable'); };
      const listener = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/deck.pptx';
      const event = (await listener) as CustomEvent<{ error: unknown }>;
      expect(event.detail.error).to.exist;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load document.');
    } finally {
      restore();
    }
  });

  it('shows a failed-to-load error when the presentation fetch fails but the renderer peer loaded fine', async () => {
    const fake = fakeModule();
    const restore = stubFetch(false);
    try {
      const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/missing.pptx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load document.');
    } finally {
      restore();
    }
  });

  it('shows the resource-too-large error when the presentation exceeds the size limit', async () => {
    const fake = fakeModule();
    const original = window.fetch;
    window.fetch = (() => Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: (name: string) => (name === 'content-length' ? String(30 * 1024 * 1024) : null) },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as unknown as Response)) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      const listener = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/huge.pptx';
      const event = (await listener) as CustomEvent<{ error: unknown }>;
      expect(event.detail.error).to.exist;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
    } finally {
      window.fetch = original;
    }
  });

  it('fails closed with a localized render error when opening the presentation throws', async () => {
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => ({
        PptxViewer: { open: async () => { throw new Error('corrupt'); } },
        RECOMMENDED_ZIP_LIMITS: {},
      } as never);
      const listener = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/corrupt.pptx';
      const event = (await listener) as CustomEvent<{ error: unknown }>;
      expect(event.detail.error).to.exist;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to render this presentation.');
    } finally {
      restore();
    }
  });

  it('a src change while awaiting the renderer peer supersedes the earlier mount (stale generation)', async () => {
    const restore = stubFetch();
    const rendererLoad = deferred<PptxRendererModule>();
    try {
      const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = () => rendererLoad.promise;
      el.src = 'https://example.test/first.pptx';
      await aTimeout(20); // let mount() reach `await Promise.all(...)` and suspend on the renderer import
      const fake = fakeModule(3);
      el.loadRenderer = async () => fake.module;
      const loadPromise = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/second.pptx'; // bumps generation, superseding the first mount
      expect((await loadPromise).detail).to.deep.equal({ slideCount: 3 });
      let extraLoadFired = false;
      el.addEventListener('lr-load', () => { extraLoadFired = true; });
      // The stale first mount's renderer import now resolves late; it must bail silently instead of
      // clobbering the second (current) presentation.
      rendererLoad.resolve(fake.module);
      await aTimeout(20);
      expect(extraLoadFired).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;
    } finally {
      restore();
    }
  });

  it('a src change while awaiting the presentation bytes supersedes the earlier mount (stale generation)', async () => {
    const fake = fakeModule(4);
    const bufferGate = deferred<ArrayBuffer>();
    const original = window.fetch;
    window.fetch = (() => Promise.resolve({ ok: true, status: 200, statusText: 'OK', arrayBuffer: () => bufferGate.promise } as unknown as Response)) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/first.pptx';
      await aTimeout(20); // let mount() resolve Promise.all and suspend inside readResponseArrayBuffer()
      const loadPromise = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/second.pptx'; // bumps generation, superseding the first mount
      await aTimeout(20); // let the second mount also reach and suspend on the same gated read
      bufferGate.resolve(new ArrayBuffer(8)); // release both suspended reads together
      expect((await loadPromise).detail).to.deep.equal({ slideCount: 4 });
      let extraLoadFired = false;
      el.addEventListener('lr-load', () => { extraLoadFired = true; });
      await aTimeout(20);
      expect(extraLoadFired).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;
    } finally {
      window.fetch = original;
    }
  });

  it('a src change while the presentation is opening supersedes the earlier mount and destroys the late viewer (stale generation)', async () => {
    const restore = stubFetch();
    const openGate = deferred<{ slideCount: number; currentSlideIndex: number; addEventListener: () => void; removeEventListener: () => void; goToSlide: () => Promise<void>; destroy: () => void }>();
    let staleDestroyCalls = 0;
    const staleViewer = {
      slideCount: 1,
      currentSlideIndex: 0,
      addEventListener: () => {},
      removeEventListener: () => {},
      goToSlide: async () => {},
      destroy: () => { staleDestroyCalls++; },
    };
    try {
      const el = (await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`)) as LyraPptxViewer;
      el.loadRenderer = async () => ({ PptxViewer: { open: async () => openGate.promise }, RECOMMENDED_ZIP_LIMITS: {} } as never);
      el.src = 'https://example.test/first.pptx';
      await aTimeout(20); // let mount() reach `await module.PptxViewer.open(...)` and suspend there
      const fake = fakeModule(5);
      el.loadRenderer = async () => fake.module;
      const loadPromise = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/second.pptx'; // bumps generation, superseding the first mount
      expect((await loadPromise).detail).to.deep.equal({ slideCount: 5 });
      // The stale first mount's pending open() now resolves late; it must be torn down immediately
      // instead of being adopted as the live viewer.
      openGate.resolve(staleViewer);
      await aTimeout(20);
      expect(staleDestroyCalls).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;
    } finally {
      restore();
    }
  });
});

describe('styling', () => {
  it('gives previous-button and next-button a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='previous-button'\]:hover/);
    expect(css).to.match(/\[part='next-button'\]:hover/);
  });
});
