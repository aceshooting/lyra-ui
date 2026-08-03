import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './archive-viewer/archive-viewer.js';
import './calendar-viewer/calendar-viewer.js';
import './contact-viewer/contact-viewer.js';
import './csv-viewer/csv-viewer.js';
import './dataset-viewer/dataset-viewer.js';
import './document-preview/document-preview.js';
import './docx-viewer/docx-viewer.js';
import './ebook-viewer/ebook-viewer.js';
import './email-viewer/email-viewer.js';
import './geojson-view/geojson-view.js';
import './html-viewer/html-viewer.js';
import './notebook-viewer/notebook-viewer.js';
import './pdf-viewer/pdf-viewer.js';
import './pptx-viewer/pptx-viewer.js';
import './spreadsheet-viewer/spreadsheet-viewer.js';
import './svg-viewer/svg-viewer.js';
import './xml-viewer/xml-viewer.js';
import type { LyraDocumentPreview } from './document-preview/document-preview.class.js';
import type { LyraSvgViewer } from './svg-viewer/svg-viewer.class.js';

const REMOTE_VIEWER_TAGS = [
  'lr-archive-viewer',
  'lr-calendar-viewer',
  'lr-contact-viewer',
  'lr-csv-viewer',
  'lr-dataset-viewer',
  'lr-document-preview',
  'lr-docx-viewer',
  'lr-ebook-viewer',
  'lr-email-viewer',
  'lr-geojson-view',
  'lr-html-viewer',
  'lr-notebook-viewer',
  'lr-pdf-viewer',
  'lr-pptx-viewer',
  'lr-spreadsheet-viewer',
  'lr-svg-viewer',
  'lr-xml-viewer',
] as const;

const LOAD_METHOD_BY_TAG: Record<(typeof REMOTE_VIEWER_TAGS)[number], string> = {
  'lr-archive-viewer': 'load',
  'lr-calendar-viewer': 'load',
  'lr-contact-viewer': 'load',
  'lr-csv-viewer': 'load',
  'lr-dataset-viewer': 'load',
  'lr-document-preview': 'fetchText',
  'lr-docx-viewer': 'load',
  'lr-ebook-viewer': 'load',
  'lr-email-viewer': 'load',
  'lr-geojson-view': 'load',
  'lr-html-viewer': 'load',
  'lr-notebook-viewer': 'loadFromSrc',
  'lr-pdf-viewer': 'load',
  'lr-pptx-viewer': 'mount',
  'lr-spreadsheet-viewer': 'load',
  'lr-svg-viewer': 'load',
  'lr-xml-viewer': 'loadFromSrc',
};

function unresolvedResponse(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}

function deferredResponse(): {
  readonly promise: Promise<Response>;
  readonly resolve: (response: Response) => void;
} {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await aTimeout(10);
  }
  throw new Error(message);
}

it('fetches every remote viewer through its adopted iframe realm and resolves its relative base', async () => {
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const ownerDocument = iframe.contentDocument!;
  const ownerWindow = iframe.contentWindow!;
  const base = ownerDocument.createElement('base');
  base.href = 'https://viewer-frame.example/application/nested/';
  ownerDocument.head.append(base);

  const ownerRequests: string[] = [];
  const parentRequests: string[] = [];
  const originalOwnerFetch = ownerWindow.fetch;
  const originalParentFetch = window.fetch;
  ownerWindow.fetch = ((input: RequestInfo | URL) => {
    ownerRequests.push(String(input));
    return unresolvedResponse();
  }) as typeof fetch;
  window.fetch = ((input: RequestInfo | URL) => {
    parentRequests.push(String(input));
    return unresolvedResponse();
  }) as typeof fetch;

  try {
    for (const tagName of REMOTE_VIEWER_TAGS) {
      const element = document.createElement(tagName) as HTMLElement & {
        src: string;
        mimeType?: string;
        updateComplete: Promise<boolean>;
        requestUpdate: () => void;
      };
      // Let Lit create the shadow root and its constructable stylesheets in the definition realm
      // before adoption. Constructable sheets themselves cannot be shared into a second document;
      // moving an already-rendered host is the platform-supported adoption path used by consumers.
      document.body.append(element);
      await element.updateComplete;
      ownerDocument.adoptNode(element);
      // Suppress this disposable instance's reactive repaint and reconnect-scheduled load. That
      // avoids constructing nested loading components whose module-level stylesheets belong to the
      // parent definition realm, while still invoking each viewer's real load method explicitly.
      element.requestUpdate = () => undefined;
      (element as unknown as { scheduleAfterUpdate: () => void }).scheduleAfterUpdate =
        () => undefined;
      element.src = `resources/${tagName}.fixture`;
      if (tagName === 'lr-document-preview') element.mimeType = 'text/plain';
      const loadMethod = LOAD_METHOD_BY_TAG[tagName];
      const controls = element as unknown as Record<string, (...args: string[]) => Promise<void>>;
      const requestsBeforeDetachedAttempt = ownerRequests.length;
      if (tagName === 'lr-document-preview') {
        await controls[loadMethod](element.src);
      } else {
        await controls[loadMethod]();
      }
      expect(
        ownerRequests.length,
        `${tagName} must fail closed while adopted but disconnected`,
      ).to.equal(requestsBeforeDetachedAttempt);

      ownerDocument.body.append(element);
      if (tagName === 'lr-document-preview') {
        void controls[loadMethod](element.src);
      } else {
        void controls[loadMethod]();
      }
      await waitFor(
        () => ownerRequests.length === requestsBeforeDetachedAttempt + 1,
        `${tagName} did not fetch through its connected owner realm`,
      );
      element.remove();
    }

    await waitFor(
      () => ownerRequests.length === REMOTE_VIEWER_TAGS.length,
      `Expected ${REMOTE_VIEWER_TAGS.length} iframe fetches, received ${ownerRequests.length}`,
    );

    expect(parentRequests, 'no viewer may fall back to the parent realm fetch').to.deep.equal([]);
    expect(ownerRequests.sort()).to.deep.equal(
      REMOTE_VIEWER_TAGS.map(
        (tagName) => `https://viewer-frame.example/application/nested/resources/${tagName}.fixture`,
      ).sort(),
    );
  } finally {
    ownerWindow.fetch = originalOwnerFetch;
    window.fetch = originalParentFetch;
    iframe.remove();
  }
});

it('restarts an adopted text preview in the new fetch realm and ignores the old response', async () => {
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const ownerDocument = iframe.contentDocument!;
  const ownerWindow = iframe.contentWindow!;
  const base = ownerDocument.createElement('base');
  base.href = 'https://adopted-frame.example/base/';
  ownerDocument.head.append(base);

  const parentRequest = deferredResponse();
  const ownerRequest = deferredResponse();
  const parentUrls: string[] = [];
  const ownerUrls: string[] = [];
  const originalOwnerFetch = ownerWindow.fetch;
  const originalParentFetch = window.fetch;
  window.fetch = ((input: RequestInfo | URL) => {
    parentUrls.push(String(input));
    return parentRequest.promise;
  }) as typeof fetch;
  ownerWindow.fetch = ((input: RequestInfo | URL) => {
    ownerUrls.push(String(input));
    return ownerRequest.promise;
  }) as typeof fetch;

  try {
    const element = await fixture<LyraDocumentPreview>(html`
      <lr-document-preview src="documents/message.txt" mime-type="text/plain"></lr-document-preview>
    `);
    await waitFor(() => parentUrls.length === 1, 'The initial parent-realm request did not start');

    ownerDocument.adoptNode(element);
    ownerDocument.body.append(element);
    await waitFor(() => ownerUrls.length === 1, 'The adopted owner-realm request did not restart');

    parentRequest.resolve(new Response('stale parent response'));
    await aTimeout(0);
    ownerRequest.resolve(new Response('current adopted response'));
    await waitFor(
      () => element.shadowRoot?.querySelector('pre')?.textContent === 'current adopted response',
      'The adopted response did not become the rendered text',
    );

    expect(parentUrls).to.deep.equal([new URL('documents/message.txt', document.baseURI).href]);
    expect(ownerUrls).to.deep.equal(['https://adopted-frame.example/base/documents/message.txt']);
    expect(element.shadowRoot?.textContent).not.to.contain('stale parent response');
  } finally {
    ownerWindow.fetch = originalOwnerFetch;
    window.fetch = originalParentFetch;
    iframe.remove();
  }
});

it('uses an adopted document preview owner realm for reduced-motion scrolling', async () => {
  const element = await fixture<LyraDocumentPreview>(html`
    <lr-document-preview mime-type="image/png" src="data:image/png;base64,AA=="></lr-document-preview>
  `);
  const specialId = 'region" ] owner';
  element.highlights = [
    { id: specialId, anchor: { kind: 'region', rect: { x: 10, y: 10, width: 20, height: 20 } } },
  ];
  await element.updateComplete;
  const region = element.shadowRoot!.querySelector('[part="region-highlight"]') as HTMLElement;
  let behavior: ScrollBehavior | undefined;
  region.scrollIntoView = (options) => {
    behavior = typeof options === 'object' ? options.behavior : undefined;
  };

  const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const ownerWindow = iframe.contentWindow!;
  const originalParentMatchMedia = window.matchMedia;
  const originalOwnerMatchMedia = ownerWindow.matchMedia;
  const originalParentEscape = window.CSS.escape;
  const originalOwnerEscape = ownerWindow.CSS.escape;
  let parentQueries = 0;
  let ownerQueries = 0;
  window.matchMedia = (() => {
    parentQueries++;
    return { matches: false } as MediaQueryList;
  }) as typeof window.matchMedia;
  ownerWindow.matchMedia = (() => {
    ownerQueries++;
    return { matches: true } as MediaQueryList;
  }) as typeof ownerWindow.matchMedia;
  window.CSS.escape = () => {
    throw new Error('ambient CSS.escape must not be used');
  };
  (ownerWindow.CSS as unknown as { escape?: typeof CSS.escape }).escape = undefined;

  try {
    iframe.contentDocument!.adoptNode(element);
    expect(await element.scrollToAnchor(specialId)).to.equal(true);
    expect(behavior).to.equal('auto');
    expect(parentQueries).to.equal(0);
    expect(ownerQueries).to.equal(1);
  } finally {
    window.matchMedia = originalParentMatchMedia;
    ownerWindow.matchMedia = originalOwnerMatchMedia;
    window.CSS.escape = originalParentEscape;
    ownerWindow.CSS.escape = originalOwnerEscape;
    iframe.remove();
  }
});

it('uses an adopted SVG viewer owner realm for reduced-motion scrolling', async () => {
  const element = await fixture<LyraSvgViewer>(html`<lr-svg-viewer></lr-svg-viewer>`);
  const readyState = {
    kind: 'loaded' as const,
    markup: '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>',
  };
  const specialId = 'region" ] owner';
  (element as unknown as { fetchState: typeof readyState }).fetchState = readyState;
  element.highlights = [
    { id: specialId, anchor: { kind: 'region', rect: { x: 10, y: 10, width: 20, height: 20 } } },
  ];
  await element.updateComplete;
  const region = element.shadowRoot!.querySelector('[part="region-highlight"]') as HTMLElement;
  let behavior: ScrollBehavior | undefined;
  region.scrollIntoView = (options) => {
    behavior = typeof options === 'object' ? options.behavior : undefined;
  };

  const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const ownerWindow = iframe.contentWindow!;
  const originalParentMatchMedia = window.matchMedia;
  const originalOwnerMatchMedia = ownerWindow.matchMedia;
  const originalParentEscape = window.CSS.escape;
  const originalOwnerEscape = ownerWindow.CSS.escape;
  let parentQueries = 0;
  let ownerQueries = 0;
  window.matchMedia = (() => {
    parentQueries++;
    return { matches: false } as MediaQueryList;
  }) as typeof window.matchMedia;
  ownerWindow.matchMedia = (() => {
    ownerQueries++;
    return { matches: true } as MediaQueryList;
  }) as typeof ownerWindow.matchMedia;
  window.CSS.escape = () => {
    throw new Error('ambient CSS.escape must not be used');
  };
  (ownerWindow.CSS as unknown as { escape?: typeof CSS.escape }).escape = undefined;

  try {
    // Preserve the already-rendered region while exercising the adopted owner policy. SVG viewer
    // intentionally clears load state on disconnect; this disposable regression instance suppresses
    // that repaint, restores the captured ready state, and calls the real anchor path directly.
    (element as unknown as { requestUpdate: () => void }).requestUpdate = () => undefined;
    iframe.contentDocument!.adoptNode(element);
    (element as unknown as { fetchState: typeof readyState }).fetchState = readyState;
    const found = await (
      element as unknown as { applyAnchor: (anchor: { kind: 'region'; rect: { x: number; y: number; width: number; height: number } }) => Promise<boolean> }
    ).applyAnchor(element.highlights[0]!.anchor as { kind: 'region'; rect: { x: number; y: number; width: number; height: number } });
    expect(found).to.equal(true);
    expect(behavior).to.equal('auto');
    expect(parentQueries).to.equal(0);
    expect(ownerQueries).to.equal(1);
  } finally {
    window.matchMedia = originalParentMatchMedia;
    ownerWindow.matchMedia = originalOwnerMatchMedia;
    window.CSS.escape = originalParentEscape;
    ownerWindow.CSS.escape = originalOwnerEscape;
    iframe.remove();
  }
});
