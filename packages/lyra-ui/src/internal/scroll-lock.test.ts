import { expect } from '@open-wc/testing';
import { lockScroll } from './scroll-lock.js';

afterEach(() => {
  document.documentElement.style.overflow = '';
  document.documentElement.style.paddingInlineEnd = '';
});

it('sets overflow: hidden on the document element while locked', () => {
  const release = lockScroll();
  expect(document.documentElement.style.overflow).to.equal('hidden');
  release();
});

it('restores the previous overflow value once released', () => {
  document.documentElement.style.overflow = 'auto';
  const release = lockScroll();
  expect(document.documentElement.style.overflow).to.equal('hidden');
  release();
  expect(document.documentElement.style.overflow).to.equal('auto');
});

it('only unlocks once every concurrent lock has released', () => {
  const releaseA = lockScroll();
  const releaseB = lockScroll();
  releaseA();
  expect(document.documentElement.style.overflow).to.equal('hidden');
  releaseB();
  expect(document.documentElement.style.overflow).to.equal('');
});

it('is a no-op if the same release function is called twice', () => {
  const releaseA = lockScroll();
  const releaseB = lockScroll();
  releaseA();
  releaseA();
  expect(document.documentElement.style.overflow).to.equal('hidden');
  // Clean up the still-outstanding second lock — otherwise this test would
  // permanently leak an un-released lock into the shared module-level ref
  // count, silently breaking every test that runs after it in this file.
  releaseB();
});

describe('scrollbar-width gutter compensation', () => {
  // This test environment (Playwright/Chromium via @web/test-runner-playwright)
  // launches Chromium with `--hide-scrollbars`, one of Playwright's own
  // default Chromium launch args (confirmed by inspecting the actual
  // launched process, and empirically: `document.documentElement.clientWidth`
  // equals `window.innerWidth` even when the page is forced to overflow
  // vertically — `scrollHeight` exceeds `clientHeight` and
  // `document.scrollingElement` is `<html>`, but no layout space is ever
  // reserved for a scrollbar). There is no way, from page content alone, to
  // make a real, space-consuming scrollbar appear here, so a test that
  // merely forces a tall body and checks `innerWidth - clientWidth > 0`
  // would silently no-op (assert nothing) in this sandbox.
  //
  // Instead, stub the real `documentElement.clientWidth` getter to report
  // what a genuine classic (non-overlay) scrollbar would: a value smaller
  // than `innerWidth` by a fixed, known amount. This exercises the actual
  // production code path (`(doc.defaultView?.innerWidth ?? 0) -
  // root.clientWidth`) and asserts against real `getComputedStyle`/`style`
  // reads — only the otherwise-unreliable browser measurement is stubbed,
  // not `lockScroll` itself.
  const root = document.documentElement;
  const FAKE_SCROLLBAR_WIDTH = 17;
  let originalDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(root, 'clientWidth');
    Object.defineProperty(root, 'clientWidth', {
      configurable: true,
      get: () => window.innerWidth - FAKE_SCROLLBAR_WIDTH,
    });
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(root, 'clientWidth', originalDescriptor);
    } else {
      delete (root as unknown as Record<string, unknown>).clientWidth;
    }
    root.style.paddingInlineEnd = '';
  });

  it('adds inline-end padding equal to the scrollbar width while locked, then restores it', () => {
    const beforePadding = getComputedStyle(root).paddingInlineEnd;
    const release = lockScroll();
    const lockedPadding = parseFloat(getComputedStyle(root).paddingInlineEnd);
    expect(lockedPadding).to.be.closeTo(FAKE_SCROLLBAR_WIDTH, 0.5);

    release();
    expect(root.style.paddingInlineEnd).to.equal('');
    expect(getComputedStyle(root).paddingInlineEnd).to.equal(beforePadding);
  });

  it('adds to (not replaces) a pre-existing padding-inline-end value', () => {
    root.style.paddingInlineEnd = '10px';
    const release = lockScroll();
    const lockedPadding = parseFloat(getComputedStyle(root).paddingInlineEnd);
    expect(lockedPadding).to.be.closeTo(10 + FAKE_SCROLLBAR_WIDTH, 0.5);
    release();
  });

  it('restores the exact prior padding-inline-end value, not just clears it', () => {
    root.style.paddingInlineEnd = '7px';

    const release = lockScroll();
    expect(root.style.paddingInlineEnd).to.not.equal('7px');

    release();
    expect(root.style.paddingInlineEnd).to.equal('7px');
  });

  it('does not add padding when there is no scrollbar to compensate for', () => {
    Object.defineProperty(root, 'clientWidth', {
      configurable: true,
      get: () => window.innerWidth, // no scrollbar removed: full width already
    });
    const beforePadding = root.style.paddingInlineEnd;
    const release = lockScroll();
    expect(root.style.paddingInlineEnd).to.equal(beforePadding);
    release();
  });
});

it('locks scroll on a given target document instead of only the top-level document', () => {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const iframeDoc = iframe.contentDocument!;
  const release = lockScroll(iframeDoc);
  expect(iframeDoc.documentElement.style.overflow).to.equal('hidden');
  release();
  expect(iframeDoc.documentElement.style.overflow).to.equal('');
  iframe.remove();
});

it('ref-counts each document independently, so locking one does not affect another', () => {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const iframeDoc = iframe.contentDocument!;

  const releaseTop = lockScroll();
  const releaseIframe = lockScroll(iframeDoc);

  expect(document.documentElement.style.overflow).to.equal('hidden');
  expect(iframeDoc.documentElement.style.overflow).to.equal('hidden');

  releaseIframe();
  expect(iframeDoc.documentElement.style.overflow).to.equal('');
  expect(document.documentElement.style.overflow).to.equal('hidden');

  releaseTop();
  expect(document.documentElement.style.overflow).to.equal('');

  iframe.remove();
});
