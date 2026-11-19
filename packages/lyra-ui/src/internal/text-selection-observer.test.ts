import { expect, fixture, html } from '@open-wc/testing';
import * as anchorTarget from './anchor-target.js';
import { observeTextSelection, textSelectionShadowRoots } from './text-selection-observer.js';
import type { TextSelectRect } from '../components/viewers/document-viewer/anchors.js';

type SelectionStub = Partial<Selection> & {
  getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[];
};

function stubProperty(target: object, key: string, value: unknown): () => void {
  const own = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });
  return () => {
    if (own) Object.defineProperty(target, key, own);
    else Reflect.deleteProperty(target, key);
  };
}

function legacySelection(range: Range | null, extra: SelectionStub = {}): SelectionStub {
  return {
    rangeCount: range ? 1 : 0,
    isCollapsed: range?.collapsed ?? true,
    getRangeAt: () => range!,
    ...extra,
  };
}

async function frames(count = 2): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

async function shadowFixture(): Promise<{ host: HTMLElement; root: ShadowRoot; content: HTMLElement }> {
  const host = await fixture<HTMLDivElement>(html`<div></div>`);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<p part="content">shadow selection text</p><p part="other">outside</p>';
  return { host, root, content: root.querySelector<HTMLElement>('[part="content"]')! };
}

function contentRange(content: Element): Range {
  const range = document.createRange();
  range.selectNodeContents(content.firstChild!);
  return range;
}

describe('observeTextSelection', () => {
  it('is the implementation anchor-target re-exports', () => {
    expect(anchorTarget.observeTextSelection === observeTextSelection).to.equal(true);
  });

  it('lists the host and content shadow roots once each, and none for light-DOM content', async () => {
    const { host, root, content } = await shadowFixture();
    expect(textSelectionShadowRoots(host, content).length).to.equal(1);
    expect(textSelectionShadowRoots(host, content)[0] === root).to.equal(true);
    const page = await fixture<HTMLDivElement>(html`<div><span>light</span></div>`);
    expect(textSelectionShadowRoots(page, page.firstElementChild!)).to.deep.equal([]);
  });

  it('reports synchronously from mouseup only when opted in, sharing the range de-duplication', async () => {
    const page = await fixture<HTMLDivElement>(html`<div><span>Opted in</span><span>Default</span></div>`);
    const [optedIn, plain] = [...page.children] as HTMLElement[];
    const reports: string[] = [];
    const releaseOptedIn = observeTextSelection(page, optedIn!, (_range, text) => reports.push(`in:${text}`),
      undefined, { mouseup: true });
    const releasePlain = observeTextSelection(page, plain!, (_range, text) => reports.push(`plain:${text}`));
    const selection = window.getSelection()!;
    try {
      selection.removeAllRanges();
      selection.addRange(contentRange(optedIn!));
      optedIn!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(reports).to.deep.equal(['in:Opted in']);
      optedIn!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      optedIn!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(reports.length, 'an unchanged range reports once').to.equal(1);
      selection.removeAllRanges();
      selection.addRange(contentRange(plain!));
      plain!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(reports.length, 'mouseup is opt-in').to.equal(1);
      releaseOptedIn();
      selection.removeAllRanges();
      selection.addRange(contentRange(optedIn!));
      optedIn!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(reports.length, 'release removes the mouseup listener').to.equal(1);
    } finally {
      releaseOptedIn();
      releasePlain();
      selection.removeAllRanges();
    }
  });

  it('reads through a supplied range reader, failing closed when it throws or points elsewhere', async () => {
    const page = await fixture<HTMLDivElement>(html`<div><span>Reader text</span><b>elsewhere</b></div>`);
    const content = page.querySelector('span')!;
    let next: () => Range | null = () => contentRange(content);
    const reports: string[] = [];
    const release = observeTextSelection(page, content, (_range, text) => reports.push(text), undefined, {
      readRange: () => next(),
    });
    try {
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      expect(reports).to.deep.equal(['Reader text']);
      next = () => { throw new Error('selection unavailable'); };
      content.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      next = () => contentRange(content);
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      expect(reports.length, 'an unreadable range resets the de-duplication').to.equal(2);
      next = () => contentRange(page.querySelector('b')!);
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      next = () => null;
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      expect(reports.length).to.equal(2);
    } finally {
      release();
    }
  });

  it('retries the legacy shadow selection only when asked after the composed query yields no range', async () => {
    const { host, root, content } = await shadowFixture();
    const range = contentRange(content);
    const restoreView = stubProperty(window, 'getSelection', () => legacySelection(null, {
      getComposedRanges: () => [],
    }));
    const restoreShadow = stubProperty(root, 'getSelection', () => legacySelection(range));
    const reports: string[] = [];
    const releaseStrict = observeTextSelection(host, content, (_range, text) => reports.push(`strict:${text}`));
    const releaseFallback = observeTextSelection(host, content, (_range, text) => reports.push(`fallback:${text}`),
      undefined, { legacyFallback: true });
    try {
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      expect(reports).to.deep.equal(['fallback:shadow selection text']);
    } finally {
      releaseStrict();
      releaseFallback();
      restoreShadow();
      restoreView();
    }
  });

  it('keeps a composed range and ignores a collapsed one when a legacy fallback is allowed', async () => {
    const { host, content } = await shadowFixture();
    const range = contentRange(content);
    let composed: StaticRange[] = [range];
    const restoreView = stubProperty(window, 'getSelection', () => legacySelection(null, {
      getComposedRanges: () => composed,
    }));
    const reports: string[] = [];
    const release = observeTextSelection(host, content, (_range, text) => reports.push(text), undefined, {
      legacyFallback: true,
    });
    try {
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      const collapsed = document.createRange();
      collapsed.setStart(content.firstChild!, 2);
      composed = [collapsed];
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      expect(reports).to.deep.equal(['shadow selection text']);
    } finally {
      release();
      restoreView();
    }
  });

  it('reports no selection when the legacy range read throws', async () => {
    const page = await fixture<HTMLDivElement>(html`<div><span>Throwing range</span></div>`);
    const content = page.firstElementChild!;
    const restore = stubProperty(window, 'getSelection', () => legacySelection(contentRange(content), {
      getRangeAt: () => { throw new DOMException('gone', 'IndexSizeError'); },
    }));
    const errors: string[] = [];
    const onError = (event: ErrorEvent): void => { errors.push(event.message); };
    window.addEventListener('error', onError);
    let reports = 0;
    const release = observeTextSelection(page, content, () => { reports++; });
    try {
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      document.dispatchEvent(new Event('selectionchange'));
      await frames();
      expect(reports).to.equal(0);
      expect(errors).to.deep.equal([]);
    } finally {
      release();
      window.removeEventListener('error', onError);
      restore();
    }
  });

  it('routes nothing when the composed query throws during a document selection change', async () => {
    const { host, content } = await shadowFixture();
    const restore = stubProperty(window, 'getSelection', () => legacySelection(null, {
      getComposedRanges: () => { throw new TypeError('hostile selection'); },
    }));
    const errors: string[] = [];
    const onError = (event: ErrorEvent): void => { errors.push(event.message); };
    window.addEventListener('error', onError);
    let reports = 0;
    const release = observeTextSelection(host, content, () => { reports++; });
    try {
      document.dispatchEvent(new Event('selectionchange'));
      await frames();
      expect(reports).to.equal(0);
      expect(errors).to.deep.equal([]);
    } finally {
      release();
      window.removeEventListener('error', onError);
      restore();
    }
  });

  it('still reports the bounded text when the selection geometry cannot be read', async () => {
    const page = await fixture<HTMLDivElement>(html`<div><span>Geometry fails</span></div>`);
    const content = page.firstElementChild!;
    const range = contentRange(content);
    Object.defineProperty(range, 'getClientRects', { configurable: true, value: () => { throw new Error('detached'); } });
    const reports: { text: string; rects: readonly TextSelectRect[] }[] = [];
    const release = observeTextSelection(page, content, (_range, text, rects) => reports.push({ text, rects }),
      undefined, { readRange: () => range });
    try {
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      expect(reports.map(({ text }) => text)).to.deep.equal(['Geometry fails']);
      expect(reports[0]!.rects.length).to.equal(0);
      expect(Object.isFrozen(reports[0]!.rects)).to.equal(true);
    } finally {
      release();
    }
  });
});
