import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { __setDompurifyImporterForTesting } from '../../internal/dompurify-loader.js';
import { expectDevWarning } from '../../../test/expected-dev-warnings.js';
import { twoFrames } from '../../../test/frames.js';
import type { LyraHtmlViewer } from './html-viewer/html-viewer.class.js';
import type { LyraSvgViewer } from './svg-viewer/svg-viewer.class.js';
import './html-viewer/html-viewer.js';
import './svg-viewer/svg-viewer.js';

type MarkupKind = 'html' | 'svg';

function source(kind: MarkupKind, label: string): string {
  return kind === 'html' ? `<p onclick="return false">${label}</p>`
    : `<svg xmlns="http://www.w3.org/2000/svg"><text onclick="return false">${label}</text></svg>`;
}

for (const kind of ['html', 'svg'] as const) {
  const template = kind === 'html' ? html`<lr-html-viewer></lr-html-viewer>` : html`<lr-svg-viewer></lr-svg-viewer>`;
  const contentSelector = `[part="${kind}"]`;

  for (const failure of ['rejection', 'unusable module'] as const) {
    it(`${kind} viewer rejects a sanitizer ${failure} without reading the body and recovers with sanitized content`, async () => {
      const viewer = await fixture<LyraHtmlViewer | LyraSvgViewer>(template);
      const fetch = window.fetch;
      const failedUrl = `https://example.test/unsafe.${kind}`;
      const currentUrl = `https://example.test/current.${kind}`;
      const blocked = new Response(source(kind, 'Must stay hidden'));
      const message = 'Document sanitization is unavailable.';
      const errors: unknown[] = [];
      viewer.addEventListener('lr-render-error', event => errors.push(event));
      viewer.strings = { documentViewerMissingSanitizer: message };
      expectDevWarning('lyra-dompurify-unavailable');
      __setDompurifyImporterForTesting(() => failure === 'rejection'
        ? Promise.reject(new Error('Private sanitizer import diagnostic')) : Promise.resolve({}));
      window.fetch = async (input, init) => {
        if (String(input) === failedUrl) return blocked;
        if (String(input) === currentUrl) return new Response(source(kind, 'Current document'));
        return fetch.call(window, input, init);
      };
      try {
        const error = oneEvent(viewer, 'lr-render-error');
        viewer.src = failedUrl;
        const event = await error;
        await viewer.updateComplete;
        expect(event.detail.error.message).to.equal(message);
        expect(viewer.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(message);
        expect(viewer.shadowRoot!.querySelectorAll(contentSelector).length).to.equal(0);
        expect(viewer.shadowRoot!.textContent).not.to.include('Must stay hidden');
        expect(viewer.shadowRoot!.textContent).not.to.include('Private sanitizer import diagnostic');
        expect(blocked.bodyUsed).to.equal(false);

        __setDompurifyImporterForTesting(undefined);
        viewer.src = currentUrl;
        await waitUntil(() => viewer.shadowRoot!.querySelector(contentSelector)?.textContent?.includes('Current document'));
        expect(viewer.shadowRoot!.querySelectorAll('[onclick]').length).to.equal(0);
        expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
        expect(errors.length).to.equal(1);
        expect(blocked.bodyUsed).to.equal(false);
      } finally {
        viewer.remove();
        window.fetch = fetch;
        __setDompurifyImporterForTesting(undefined);
      }
    });
  }

  for (const retirement of ['disconnect', 'replacement'] as const) {
    it(`${kind} viewer ignores a delayed sanitizer failure after ${retirement}`, async () => {
      const host = await fixture<HTMLDivElement>(html`<div>${template}</div>`);
      const viewer = host.firstElementChild as LyraHtmlViewer | LyraSvgViewer;
      const fetch = window.fetch;
      const oldUrl = `https://example.test/obsolete.${kind}`;
      const currentUrl = `https://example.test/recovered.${kind}`;
      const obsolete = new Response(source(kind, 'Obsolete document'));
      let rejectImport: ((error: Error) => void) | undefined;
      let errors = 0;
      viewer.addEventListener('lr-render-error', () => { errors++; });
      expectDevWarning('lyra-dompurify-unavailable');
      __setDompurifyImporterForTesting(() => new Promise((_resolve, reject) => { rejectImport = reject; }));
      window.fetch = async (input, init) => {
        if (String(input) === oldUrl) return obsolete;
        if (String(input) === currentUrl) return new Response(source(kind, 'Current document'));
        return fetch.call(window, input, init);
      };
      const content = () => viewer.shadowRoot!.querySelector(contentSelector)?.textContent ?? '';
      try {
        viewer.src = oldUrl;
        await waitUntil(() => rejectImport !== undefined);
        expect(obsolete.bodyUsed).to.equal(false);
        __setDompurifyImporterForTesting(undefined);
        if (retirement === 'disconnect') viewer.remove();
        else {
          viewer.src = currentUrl;
          await waitUntil(() => content().includes('Current document'));
        }
        rejectImport!(new Error('Obsolete sanitizer import failed'));
        await twoFrames();
        await viewer.updateComplete;
        expect(errors).to.equal(0);
        expect(obsolete.bodyUsed).to.equal(false);
        expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
        expect(content()).not.to.include('Obsolete document');
        if (retirement === 'disconnect') {
          expect(content()).not.to.include('Current document');
          viewer.src = currentUrl;
          host.append(viewer);
          await waitUntil(() => content().includes('Current document'));
        }
        expect(content()).to.include('Current document');
        expect(viewer.shadowRoot!.querySelectorAll('[onclick]').length).to.equal(0);
        expect(errors).to.equal(0);
      } finally {
        viewer.remove();
        window.fetch = fetch;
        __setDompurifyImporterForTesting(undefined);
      }
    });
  }
}
