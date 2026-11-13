import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import type { LyraLocaleStrings } from '../../src/internal/localization.js';
import { twoFrames } from '../frames.js';

interface ResponseViewer extends HTMLElement {
  src: string;
  strings: LyraLocaleStrings;
  readonly updateComplete: Promise<boolean>;
}

/** Delayed network responses cannot replace the current rendered document or revive a detached one. */
export function describeViewerResponseLifecycle(name: string, template: TemplateResult, options: {
  extension: string;
  contentSelector: string;
  contentRoot?(viewer: HTMLElement): ShadowRoot | null;
  source(label: string): string | ArrayBuffer | Promise<string | ArrayBuffer>;
  preload?(): Promise<unknown>;
}): void {
  const renderedContent = (viewer: ResponseViewer) =>
    (options.contentRoot?.(viewer) ?? viewer.shadowRoot)?.querySelector(options.contentSelector)?.textContent?.trim() ?? '';
  describe(`${name} response ownership`, () => {
    it('localizes an HTTP failure and recovers when the source changes', async () => {
      const host = await fixture<HTMLDivElement>(html`<div>${template}</div>`);
      const viewer = host.firstElementChild as ResponseViewer;
      const originalFetch = window.fetch;
      const currentLabel = 'current-document';
      const currentUrl = `https://example.test/recovered.${options.extension}`;
      const failedUrl = `https://example.test/unavailable.${options.extension}`;
      const currentSource = await options.source(currentLabel);
      const failure = new Response('upstream response body', { status: 503, statusText: 'upstream diagnostic' });
      const message = 'This document could not be loaded.';
      let errors = 0;
      viewer.addEventListener('lr-render-error', () => { errors++; });
      viewer.strings = { documentPreviewFailedToLoad: message };
      window.fetch = async (input, init) => {
        if (String(input) === failedUrl) return failure;
        if (String(input) === currentUrl) return new Response(currentSource);
        return originalFetch.call(window, input, init);
      };
      try {
        viewer.src = failedUrl;
        await waitUntil(() => errors === 1);
        await viewer.updateComplete;
        expect(viewer.shadowRoot!.querySelector('[part="error"]')?.textContent?.trim()).to.equal(message);
        expect(failure.bodyUsed).to.equal(false);
        viewer.src = currentUrl;
        await waitUntil(() => renderedContent(viewer).includes(currentLabel));
        expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
        expect(errors).to.equal(1);
      } finally {
        viewer.remove();
        window.fetch = originalFetch;
      }
    });

    for (const boundary of ['headers', 'body'] as const) {
      for (const retirement of ['disconnect', 'replacement'] as const) {
        it(`ignores obsolete ${boundary} after ${retirement} and loads the current document`, async () => {
          // Preload the real peer so a late import cannot conceal a stale render.
          await options.preload?.();
          const host = await fixture<HTMLDivElement>(html`<div>${template}</div>`);
          const viewer = host.firstElementChild as ResponseViewer;
          const originalFetch = window.fetch;
          const obsoleteUrl = `https://example.test/obsolete.${options.extension}`;
          const currentUrl = `https://example.test/current.${options.extension}`;
          const obsoleteLabel = 'obsolete-document', currentLabel = 'current-document';
          const obsoleteSource = await options.source(obsoleteLabel), currentSource = await options.source(currentLabel);
          let resolveHeaders: ((response: Response) => void) | undefined;
          let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;
          const body = new ReadableStream<Uint8Array>({ start(controller) { bodyController = controller; } });
          const obsolete = new Response(body);
          const signals: (AbortSignal | null | undefined)[] = [];
          let errors = 0;
          viewer.addEventListener('lr-render-error', () => { errors++; });
          const content = () => renderedContent(viewer);
          window.fetch = async (input, init) => {
            if (String(input) !== obsoleteUrl && String(input) !== currentUrl) return originalFetch.call(window, input, init);
            signals.push(init?.signal);
            if (signals.length > 1) return new Response(currentSource);
            if (boundary === 'body') return obsolete;
            return new Promise<Response>(resolve => { resolveHeaders = resolve; });
          };
          try {
            viewer.src = obsoleteUrl;
            await waitUntil(() => boundary === 'headers' ? resolveHeaders !== undefined : obsolete.bodyUsed);
            expect(signals.length).to.equal(1);
            expect(content()).not.to.contain(obsoleteLabel);
            if (retirement === 'disconnect') {
              viewer.remove();
              await twoFrames();
            } else {
              viewer.src = currentUrl;
              await waitUntil(() => content().includes(currentLabel));
            }
            expect(signals[0]?.aborted).to.equal(true);
            bodyController!.enqueue(typeof obsoleteSource === 'string' ? new TextEncoder().encode(obsoleteSource) : new Uint8Array(obsoleteSource));
            bodyController!.close();
            resolveHeaders?.(obsolete);
            if (boundary === 'body') await waitUntil(() => !body.locked);
            await twoFrames();
            await viewer.updateComplete;
            expect(errors).to.equal(0);
            expect(content()).not.to.contain(obsoleteLabel);
            if (boundary === 'headers') expect(obsolete.bodyUsed).to.equal(false);
            if (retirement === 'disconnect') {
              expect(content()).not.to.contain(currentLabel);
              viewer.src = currentUrl;
              host.append(viewer);
              await waitUntil(() => content().includes(currentLabel));
            }
            expect(content()).to.contain(currentLabel);
            expect(content()).not.to.contain(obsoleteLabel);
            expect(signals.length).to.equal(2);
            expect(signals[1]?.aborted).to.equal(false);
            expect(errors).to.equal(0);
          } finally {
            viewer.remove();
            window.fetch = originalFetch;
          }
        });
      }
    }
  });
}
