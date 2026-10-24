import { expect, fixture, fixtureCleanup, html } from '@open-wc/testing';
import { prepareMapLocalImage } from './map-local-image.js';
import { projectMapLocalImageUrl } from './map-local-image-url.js';

const base = 'https://example.test/page';
describe('map local image preparation', () => {
  afterEach(fixtureCleanup);
  it('admits only strict raster data and nonopaque same-origin blob URLs', () => {
    for (const input of ['data:image/svg+xml;base64,PHN2Zy8+', 'data:image/png,AAAA', 'data:image/png;base64,A===',
      'data:image/png;base64, AA==', 'blob:null/opaque', 'blob:https://other.test/a', 'blob:https://user@example.test/a',
      'blob:https://example.test/a#fragment', 'javascript:alert(1)']) expect(projectMapLocalImageUrl(input, base)).to.equal(undefined);
    expect(projectMapLocalImageUrl('data:image/png;base64,AAAA', base)?.kind).to.equal('data');
    expect(projectMapLocalImageUrl('blob:https://example.test/abc', base)?.kind).to.equal('blob');
    expect(projectMapLocalImageUrl(`data:image/png;base64,${'AAAA'.repeat(350_000)}`, base)).to.equal(undefined);
  });
  it('decodes an owned raster URL and releases it only on disposal, without revoking its input', async () => {
    const owner = await fixture<HTMLElement>(html`<div></div>`);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
    canvas.getContext('2d')!.fillRect(0, 0, 2, 2);
    const input = URL.createObjectURL(await (await fetch(canvas.toDataURL('image/png'))).blob());
    const result = await prepareMapLocalImage(input, { owner, signal: new AbortController().signal, isCurrent: () => true });
    try {
      expect(result.url === input).to.equal(false);
      expect((await fetch(result.url)).ok).to.equal(true);
      result.dispose(); result.dispose();
      let revoked = false; try { await fetch(result.url); } catch { revoked = true; }
      expect(revoked).to.equal(true); expect((await fetch(input)).ok).to.equal(true);
    } finally { result.dispose(); URL.revokeObjectURL(input); }
  });
  it('rejects MIME-mismatched and revoked input before forwarding it', async () => {
    const owner = await fixture<HTMLElement>(html`<div></div>`);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
    const input = URL.createObjectURL(new Blob(['invalid'], { type: 'image/png' })); URL.revokeObjectURL(input);
    for (const url of [input, canvas.toDataURL('image/png').replace('image/png', 'image/jpeg')]) {
      let rejected = false;
      try { const image = await prepareMapLocalImage(url, { owner, signal: new AbortController().signal, isCurrent: () => true }); image.dispose(); }
      catch { rejected = true; }
      expect(rejected).to.equal(true);
    }
  });
  it('does not wait for an uncooperative blob fetch after cancellation', async () => {
    const owner = await fixture<HTMLElement>(html`<div></div>`), controller = new AbortController();
    const fetchAtStart = window.fetch;
    const input = URL.createObjectURL(new Blob(['invalid'], { type: 'image/png' }));
    try {
      window.fetch = () => new Promise<Response>(() => {});
      const pending = prepareMapLocalImage(input, { owner, signal: controller.signal, isCurrent: () => true });
      controller.abort();
      let rejected = false; try { await pending; } catch { rejected = true; }
      expect(rejected).to.equal(true);
    } finally { window.fetch = fetchAtStart; URL.revokeObjectURL(input); }
  });
  it('rejects oversized decoded dimensions before creating an owned native URL', async () => {
    const owner = await fixture<HTMLElement>(html`<div></div>`), canvas = document.createElement('canvas');
    canvas.width = 2049; canvas.height = 1;
    const input = canvas.toDataURL('image/png'), original = URL.createObjectURL;
    let creates = 0, rejected = false;
    try {
      URL.createObjectURL = value => { creates++; return original.call(URL, value); };
      try { const image = await prepareMapLocalImage(input, { owner, signal: new AbortController().signal, isCurrent: () => true }); image.dispose(); }
      catch { rejected = true; }
    } finally { URL.createObjectURL = original; }
    expect(rejected).to.equal(true); expect(creates).to.equal(0);
  });
  it('releases an owned decoding URL when its generation is aborted', async () => {
    const owner = await fixture<HTMLElement>(html`<div></div>`), canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const controller = new AbortController(), create = URL.createObjectURL, revoke = URL.revokeObjectURL;
    const created: string[] = [], revoked: string[] = [];
    try {
      URL.createObjectURL = value => { const url = create.call(URL, value); created.push(url); return url; };
      URL.revokeObjectURL = url => { revoked.push(url); revoke.call(URL, url); };
      const pending = prepareMapLocalImage(canvas.toDataURL('image/png'), { owner, signal: controller.signal, isCurrent: () => true });
      controller.abort();
      try { await pending; } catch { /* Expected cancellation. */ }
      expect(created).to.have.length(1); expect(revoked).to.deep.equal(created);
    } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
  });

  it('admits the inherited document origin under a foreign base and after owner adoption', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const doc = frame.contentDocument!, view = frame.contentWindow!;
    const baseElement = doc.createElement('base'); baseElement.href = 'https://cdn.test/assets/'; doc.head.append(baseElement);
    const owner = document.createElement('div'); document.body.append(owner); doc.body.append(doc.adoptNode(owner));
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
    const input = URL.createObjectURL(await (await fetch(canvas.toDataURL('image/png'))).blob());
    try {
      expect(view.origin).to.equal(window.origin); expect(doc.baseURI).to.equal('https://cdn.test/assets/');
      const result = await prepareMapLocalImage(input, { owner, signal: new AbortController().signal, isCurrent: () => true });
      try { expect((await view.fetch(result.url)).ok).to.equal(true); } finally { result.dispose(); }
      let fetches = 0; const original = view.fetch;
      view.fetch = async (...args) => { fetches++; return original.apply(view, args); };
      try {
        let rejected = false;
        try { await prepareMapLocalImage('blob:https://cdn.test/foreign', { owner, signal: new AbortController().signal, isCurrent: () => true }); }
        catch { rejected = true; }
        expect(rejected).to.equal(true); expect(fetches).to.equal(0);
      } finally { view.fetch = original; }
    } finally { URL.revokeObjectURL(input); owner.remove(); }
  });
  it('rejects a pending preparation when its owner is adopted into another document', async () => {
    const owner = await fixture<HTMLElement>(html`<div></div>`), frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
    const response = await fetch(canvas.toDataURL('image/png')), original = window.fetch;
    const input = URL.createObjectURL(await response.clone().blob());
    let deliver!: (response: Response) => void;
    try {
      window.fetch = () => new Promise<Response>(resolve => { deliver = resolve; });
      const pending = prepareMapLocalImage(input, { owner, signal: new AbortController().signal, isCurrent: () => true });
      frame.contentDocument!.body.append(frame.contentDocument!.adoptNode(owner)); deliver(response);
      let rejected = false; try { await pending; } catch { rejected = true; }
      expect(rejected).to.equal(true);
    } finally { window.fetch = original; URL.revokeObjectURL(input); owner.remove(); }
  });
  it('bounds valid and malformed base64 at the encoded-byte ceiling without recursive matching', () => {
    const size = 1024 * 1024;
    const encoded = btoa('a'.repeat(size));
    expect(projectMapLocalImageUrl(`data:image/png;base64,${encoded}`, window.origin)?.kind).to.equal('data');
    expect(projectMapLocalImageUrl(`data:image/png;base64,${btoa('a'.repeat(size + 1))}`, window.origin)).to.equal(undefined);
    expect(projectMapLocalImageUrl(`data:image/png;base64,${encoded.slice(0, -1)}!`, window.origin)).to.equal(undefined);
  });

});

describe('map local image preparation boundaries', () => {
  afterEach(fixtureCleanup);
  const contextOf = (owner: HTMLElement, signal = new AbortController().signal) => ({ owner, signal, isCurrent: () => true });
  async function rejected(work: Promise<unknown>): Promise<boolean> {
    try { await work; return false; } catch { return true; }
  }
  function rectangle(): string {
    const canvas = document.createElement('canvas'); canvas.width = 3; canvas.height = 2;
    canvas.getContext('2d')!.fillRect(0, 0, 3, 2);
    return canvas.toDataURL('image/png');
  }

  it('rejects an owner whose document has no window', async () => {
    const owner = document.implementation.createHTMLDocument('detached').createElement('div');
    expect(await rejected(prepareMapLocalImage('data:image/png;base64,AAAA', contextOf(owner)))).to.equal(true);
  });

  it('stops waiting when the request itself cancels the preparation', async () => {
    const owner = await fixture<HTMLElement>(html`<div></div>`), controller = new AbortController(), original = window.fetch;
    const input = URL.createObjectURL(new Blob(['invalid'], { type: 'image/png' }));
    try {
      window.fetch = () => { controller.abort(); return new Promise<Response>(() => {}); };
      expect(await rejected(prepareMapLocalImage(input, contextOf(owner, controller.signal)))).to.equal(true);
    } finally { window.fetch = original; URL.revokeObjectURL(input); }
  });

  it('rejects a data URL whose base64 text is not canonical before creating a native URL', async () => {
    const owner = await fixture<HTMLElement>(html`<div></div>`), create = URL.createObjectURL;
    let creates = 0;
    try {
      URL.createObjectURL = value => { creates++; return create.call(URL, value); };
      expect(await rejected(prepareMapLocalImage('data:image/png;base64,AAB=', contextOf(owner)))).to.equal(true);
    } finally { URL.createObjectURL = create; }
    expect(creates).to.equal(0);
  });

  it('rejects a response that reports a foreign final URL or carries no media type', async () => {
    const owner = await fixture<HTMLElement>(html`<div></div>`);
    for (const mode of ['redirected', 'untyped'] as const) {
      const input = URL.createObjectURL(new Blob(['x'])), original = window.fetch;
      try {
        window.fetch = async () => {
          const response = new Response(new Uint8Array([1, 2, 3]), mode === 'untyped' ? {} : { headers: { 'content-type': 'image/png' } });
          Object.defineProperty(response, 'type', { value: 'basic' });
          if (mode === 'redirected') Object.defineProperty(response, 'url', { value: 'https://other.test/image.png' });
          return response;
        };
        expect(await rejected(prepareMapLocalImage(input, contextOf(owner))), mode).to.equal(true);
      } finally { window.fetch = original; URL.revokeObjectURL(input); }
    }
  });

  it('accepts a decode with swapped axes and rejects one that matches neither orientation', async () => {
    const owner = await fixture<HTMLElement>(html`<div></div>`), descriptor = Object.getOwnPropertyDescriptor(window, 'Image');
    const decoding = (width: number, height: number) => class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = width;
      naturalHeight = height;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
      removeAttribute() {}
    };
    try {
      Object.defineProperty(window, 'Image', { configurable: true, value: decoding(2, 3) });
      const rotated = await prepareMapLocalImage(rectangle(), contextOf(owner));
      expect(rotated.encodedBytes).to.be.greaterThan(0);
      rotated.dispose();
      Object.defineProperty(window, 'Image', { configurable: true, value: decoding(5, 5) });
      expect(await rejected(prepareMapLocalImage(rectangle(), contextOf(owner)))).to.equal(true);
    } finally {
      if (descriptor) Object.defineProperty(window, 'Image', descriptor); else Reflect.deleteProperty(window, 'Image');
    }
  });
});
