import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import '../../lr-icon.js';
import type { LyraIcon } from '../../lr-icon.js';
import { __clearIconResourceCacheForTesting } from './icon-resource.js';

const CIRCLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle></svg>';

function response(body: string, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    statusText: ok ? 'OK' : 'Not Found',
    text: () => Promise.resolve(body),
  } as Response;
}

/** Stubs `window.fetch` with per-URL deferred responses that ignore abort signals, so a superseded
 *  request still settles after the icon has moved on. */
function stubDeferredFetch(): { settle(url: string, value: Response): void; restore(): void; requested: string[] } {
  const original = window.fetch;
  const pending = new Map<string, (value: Response) => void>();
  const requested: string[] = [];
  window.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    return new Promise<Response>((resolve) => pending.set(url, resolve));
  }) as typeof window.fetch;
  return {
    requested,
    settle(url, value) {
      pending.get(url)?.(value);
    },
    restore() {
      window.fetch = original;
    },
  };
}

describe('lr-icon superseded remote loads', () => {
  afterEach(() => __clearIconResourceCacheForTesting());

  it('publishes only the latest source when an earlier request fails late', async () => {
    const fetches = stubDeferredFetch();
    try {
      const el = await fixture<LyraIcon>(html`<lr-icon></lr-icon>`);
      const errors: string[] = [];
      el.addEventListener('lr-error', (event) => errors.push((event as CustomEvent<{ src: string }>).detail.src));
      el.src = 'https://icons.test/first.svg';
      await el.updateComplete;
      await aTimeout(0);
      const loaded = oneEvent(el, 'lr-load');
      el.src = 'https://icons.test/second.svg';
      await el.updateComplete;
      await aTimeout(0);
      fetches.settle('https://icons.test/first.svg', response('', false));
      fetches.settle('https://icons.test/second.svg', response(CIRCLE_SVG));
      const event = (await loaded) as CustomEvent<{ src: string }>;
      expect(event.detail.src).to.equal('https://icons.test/second.svg');
      await aTimeout(0);
      expect(errors).to.deep.equal([]);
      expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    } finally {
      fetches.restore();
    }
  });

  it('stays silent when a request settles after the icon was disconnected', async () => {
    const fetches = stubDeferredFetch();
    try {
      const el = await fixture<LyraIcon>(html`<lr-icon></lr-icon>`);
      const events: string[] = [];
      el.addEventListener('lr-error', () => events.push('error'));
      el.addEventListener('lr-load', () => events.push('load'));
      el.src = 'https://icons.test/detached.svg';
      await el.updateComplete;
      await aTimeout(0);
      el.remove();
      fetches.settle('https://icons.test/detached.svg', response('', false));
      await aTimeout(20);
      expect(events).to.deep.equal([]);
    } finally {
      fetches.restore();
    }
  });
});

describe('lr-icon undefined upstream spellings', () => {
  it('clears name and src when assigned undefined', async () => {
    const el = await fixture<LyraIcon>(html`<lr-icon name="search"></lr-icon>`);
    el.name = undefined;
    el.src = undefined;
    await el.updateComplete;
    expect(el.name).to.equal('');
    expect(el.src).to.equal('');
    expect(el.getAttribute('name') ?? '').to.equal('');
  });

  it('removes the rotation token when rotate is cleared to undefined', async () => {
    const el = await fixture<LyraIcon>(html`<lr-icon name="search" rotate="90"></lr-icon>`);
    expect(el.style.getPropertyValue('--lr-icon-rotate')).to.equal('90deg');
    el.rotate = undefined as unknown as number;
    await el.updateComplete;
    expect(el.style.getPropertyValue('--lr-icon-rotate')).to.equal('');
  });
});

describe('lr-icon owner realm without fetch', () => {
  it('fails closed with the load fallback when the owner window cannot fetch', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      await new Promise<void>((resolve) => {
        if (frame.contentDocument?.readyState === 'complete') resolve();
        else frame.addEventListener('load', () => resolve(), { once: true });
      });
      const frameWindow = frame.contentWindow as Window & typeof globalThis;
      Object.defineProperty(frameWindow, 'fetch', { configurable: true, value: undefined });
      const el = document.createElement('lr-icon') as LyraIcon;
      const errored = oneEvent(el, 'lr-error');
      frame.contentDocument!.body.append(el);
      el.src = 'https://icons.test/no-fetch.svg';
      const event = (await errored) as CustomEvent<{ src: string }>;
      expect(event.detail.src).to.equal('https://icons.test/no-fetch.svg');
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
    } finally {
      frame.remove();
    }
  });
});
