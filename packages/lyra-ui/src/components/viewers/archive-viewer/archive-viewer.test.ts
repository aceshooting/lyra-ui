import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { LYRA_DEFAULT_STRINGS } from '../../../internal/localization.js';
import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import './archive-viewer.js';
import type { LyraArchiveViewer } from './archive-viewer.js';
import type { ArchiveLibraryApi } from './archive-loader.js';

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function buildZip(files: Record<string, string>): Promise<ArrayBuffer> {
  const module = (await import('jszip')) as unknown as { default: new () => ArchiveLibraryApi };
  const zip = new module.default();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function withDeclaredZipEntryCount(source: ArrayBuffer, count: number): ArrayBuffer {
  const copy = source.slice(0);
  const view = new DataView(copy);
  for (let offset = copy.byteLength - 22; offset >= 0; offset--) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    view.setUint16(offset + 8, count, true);
    view.setUint16(offset + 10, count, true);
    return copy;
  }
  throw new Error('ZIP end-of-central-directory record not found');
}

function stubFetch(buffer: ArrayBuffer, ok = true): () => void { const original = window.fetch; window.fetch = (() => Promise.resolve({ ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', arrayBuffer: () => Promise.resolve(buffer) } as Response)) as typeof window.fetch; return () => { window.fetch = original; }; }
function useLibrary(el: LyraArchiveViewer, library: ArchiveLibraryApi | null): void { (el as unknown as { loadLibrary: () => Promise<ArchiveLibraryApi | null> }).loadLibrary = () => Promise.resolve(library); }
function libraryWithEntries(names: string[]): ArchiveLibraryApi {
  return {
    loadAsync: async () => ({
      forEach(callback: (path: string, file: {
        name: string;
        dir: boolean;
        _data: { uncompressedSize: number };
      }) => void) {
        for (const name of names) {
          callback(name, {
            name,
            dir: name.endsWith('/'),
            _data: { uncompressedSize: name.endsWith('/') ? 0 : 1 },
          });
        }
      },
    }),
  } as unknown as ArchiveLibraryApi;
}

async function listingWithEntries(names: string[]): Promise<{
  el: LyraArchiveViewer;
  list: HTMLElement & {
    items: { name: string }[];
    rowHeight: string;
    scrollToIndex(index: number, options?: { behavior?: ScrollBehavior }): void;
    updateComplete: Promise<boolean>;
  };
  restore: () => void;
}> {
  const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
  useLibrary(el, libraryWithEntries(names));
  const restore = stubFetch(new ArrayBuffer(0));
  el.src = 'https://example.test/archive.zip';
  await waitUntil(() => {
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as
      | { items?: unknown[]; shadowRoot?: ShadowRoot }
      | null;
    return list?.items?.length === names.length
      && list.shadowRoot?.querySelector('[part~="entry-name"]') !== null;
  });
  return {
    el,
    list: el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
      items: { name: string }[];
      rowHeight: string;
      scrollToIndex(index: number, options?: { behavior?: ScrollBehavior }): void;
      updateComplete: Promise<boolean>;
    },
    restore,
  };
}

async function settleVirtualList(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/**
 * The anchor tests below mount an 81-entry `<lr-virtual-list>`, switch it from `row-height="auto"`
 * to a fixed height once its rows exist, and then drive repeated programmatic scrolls through
 * `scrollToAnchor()`'s retry loop. Chromium can dispatch a real `ErrorEvent` reading "ResizeObserver
 * loop completed with undelivered notifications" -- a documented, universally-benign browser
 * message, not a defect in anything this file asserts on. The harness turns any uncaught page error
 * into a failure of whichever test happens to be running, so unfiltered it failed these two tests on
 * CI's contended runner while never firing on a developer machine (verified: two consecutive CI runs
 * failed both tests through wtr's `retries: 1`, and the same file passes eight consecutive local
 * runs).
 *
 * This comment used to call that loop "inherent to virtualization" (measure row -> rebuild offsets
 * -> re-render the window -> apply the scroll-anchor correction). It is not. The avoidable half was
 * `<lr-virtual-list>` calling `observe()` on newly windowed rows from inside its own resize
 * callback, which is now fixed at the source (see `beginResizeDelivery()` there) -- measured to
 * take the same error from 2 to 0 occurrences per full-suite run in `src/performance.test.ts`,
 * whose listener was instrumented to count them.
 *
 * The filter is kept because this file's own count could never be reproduced locally in either
 * state (0 both before and after, matching the "never fires on a developer machine" note above), so
 * there is no local evidence that CI's contended runner is now clean. Removing it would be a guess.
 * Suppression stays scoped to that one message, exactly as `src/performance.test.ts` does; every
 * other uncaught error still fails its test as before.
 */
window.addEventListener(
  'error',
  (e) => {
    if (typeof e.message === 'string' && e.message.includes('ResizeObserver loop')) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);

describe('archive localization', () => { it('defines archive messages', () => { expect(LYRA_DEFAULT_STRINGS.archiveViewerUnavailable).to.be.a('string'); expect(LYRA_DEFAULT_STRINGS.archiveViewerEmpty).to.be.a('string'); expect(LYRA_DEFAULT_STRINGS.archiveViewerFolder).to.be.a('string'); expect(LYRA_DEFAULT_STRINGS.archiveViewerFile).to.be.a('string'); }); });

describe('lr-archive-viewer', () => {
  it('renders the empty state by default', async () => { const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`); expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.'); });
  it('lists ZIP entries and computes file sizes', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`); const buffer = await buildZip({ 'README.txt': 'hello world', 'src/index.js': 'console.log(1);' }); const restore = stubFetch(buffer);
    try { el.src = 'https://example.test/archive.zip'; await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null || el.shadowRoot!.querySelector('[part="error"]') !== null, undefined, { timeout: 5000 }); expect((el.shadowRoot!.querySelector('[part="error"]')) == null).to.be.true; const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: { name: string; dir: boolean; size: number }[] }; await waitUntil(() => list.items?.length === 3, undefined, { timeout: 5000 }); expect(list.items.map((item) => item.name).sort()).to.deep.equal(['README.txt', 'src/', 'src/index.js']); expect(list.items.find((item) => item.name === 'README.txt')!.size).to.equal(11); expect(list.items.find((item) => item.name === 'src/')!.dir).to.be.true; } finally { restore(); }
  });
  it('searches virtualized archive entry names and navigates the matching entry', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const restore = stubFetch(await buildZip({
      'README.txt': 'hello world',
      'src/index.js': 'console.log(1);',
    }));
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const eventPromise = oneEvent(el, 'lr-search-change');
      expect(await el.search('INDEX.JS')).to.equal(1);
      expect((await eventPromise).detail).to.deep.equal({
        query: 'INDEX.JS',
        matchCount: 1,
        activeIndex: 0,
      });
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { activeId: string };
      expect(list.activeId).to.equal('src/index.js');
      expect(await el.searchNext()).to.be.true;
    } finally {
      restore();
    }
  });
  it('navigates to the previous search match, wrapping from the first to the last', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const restore = stubFetch(await buildZip({
      'a/file-1.txt': '1',
      'a/file-2.txt': '2',
      'a/file-3.txt': '3',
    }));
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      expect(await el.search('file')).to.equal(3);
      const eventPromise = oneEvent(el, 'lr-search-change');
      expect(await el.searchPrevious()).to.be.true;
      expect((await eventPromise).detail.activeIndex).to.equal(2);
    } finally {
      restore();
    }
  });
  it('clears search matches when searching an empty query', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const restore = stubFetch(await buildZip({ 'README.txt': 'hello world' }));
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      expect(await el.search('README')).to.equal(1);
      expect(await el.search('')).to.equal(0);
    } finally {
      restore();
    }
  });
  it('no-ops scrolling to the active match when searching before the archive has loaded', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    expect(await el.search('anything')).to.equal(0);
  });
  it('no-ops scrolling to the active match when the search query has no matches', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const restore = stubFetch(await buildZip({ 'README.txt': 'hello world' }));
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      expect(await el.search('does-not-exist-xyz')).to.equal(0);
    } finally {
      restore();
    }
  });
  it('does not expose the internal virtual-list range event', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const restore = stubFetch(await buildZip({ 'README.txt': 'hello world' }));
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      let leaked = 0;
      el.addEventListener('lr-visible-range-changed', () => leaked++);
      el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(new CustomEvent(
        'lr-visible-range-changed',
        { detail: { start: 0, end: 1 }, bubbles: true, composed: true },
      ));
      expect(leaked).to.equal(0);
    } finally {
      restore();
    }
  });
  it('renders the empty archive message', async () => { const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`); const restore = stubFetch(await buildZip({})); try { el.src = 'https://example.test/empty.zip'; await waitUntil(() => el.shadowRoot!.querySelector('.empty-note')?.textContent === 'This archive is empty.'); } finally { restore(); } });

  it('rejects an excessive central-directory entry count before the ZIP peer materializes entries', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    let loadCalls = 0;
    useLibrary(el, {
      loadAsync: async () => {
        loadCalls++;
        return { forEach: () => {} };
      },
    } as unknown as ArchiveLibraryApi);
    const buffer = withDeclaredZipEntryCount(await buildZip({ 'one.txt': 'one' }), 10_001);
    const restore = stubFetch(buffer);
    try {
      const errorPromise = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/too-many-entries.zip';
      const event = await errorPromise as CustomEvent<{ error: unknown }>;
      await el.updateComplete;
      expect(loadCalls).to.equal(0);
      expect(event.detail.error).to.be.instanceOf(LyraResourceLimitError);
      expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(
        'This document is too large to preview.',
      );
    } finally {
      restore();
    }
  });
  it('renders a missing-peer error and rejects unsafe URLs', async () => { const missing = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`); useLibrary(missing, null); const restore = stubFetch(new ArrayBuffer(0)); try { missing.src = 'https://example.test/archive.zip'; await waitUntil(() => missing.shadowRoot!.querySelector('[part="error"]') !== null); expect(missing.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Archive preview is unavailable.'); } finally { restore(); }
    let called = false; const original = window.fetch; window.fetch = (() => { called = true; return Promise.reject(new Error('unexpected')); }) as typeof window.fetch; try { const unsafe = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer .src=${'java\tscript:alert(1)'}></lr-archive-viewer>`); await unsafe.updateComplete; expect(called).to.be.false; expect(unsafe.shadowRoot!.querySelector('[part="error"]')).to.exist; } finally { window.fetch = original; }
  });
  it('emits one lr-render-error for an unsafe source without fetching it', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const original = window.fetch;
    let fetchCalls = 0;
    let errorCount = 0;
    window.fetch = (() => {
      fetchCalls++;
      return Promise.reject(new Error('unexpected'));
    }) as typeof window.fetch;
    el.addEventListener('lr-render-error', () => errorCount++);
    try {
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'java\tscript:alert(1)';
      const event = (await Promise.race([
        eventPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
      ])) as CustomEvent<{ error: unknown }> | null;
      expect(event).to.not.be.null;
      if (!event) return;
      expect(event.detail.error).to.be.instanceOf(Error);
      await el.updateComplete;
      expect(fetchCalls).to.equal(0);
      expect(errorCount).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Document URL is not allowed.');
    } finally {
      window.fetch = original;
    }
  });
  it('applies localized empty strings and is accessible', async () => { const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer .strings=${{ documentPreviewEmpty: 'Aucun {type} à afficher.' }}></lr-archive-viewer>`); expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('Aucun document à afficher.'); await expect(el).to.be.accessible(); });

  it('uses declared entry sizes without decompressing each entry', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    let decompressCalls = 0;
    const fakeLibrary = {
      loadAsync: () => Promise.resolve({
        forEach(cb: (path: string, file: { name: string; dir: boolean; async: (type: string) => Promise<Uint8Array>; _data?: { uncompressedSize?: number } }) => void) {
          cb('README.txt', { name: 'README.txt', dir: false, _data: { uncompressedSize: 11 }, async: () => { decompressCalls++; return Promise.resolve(new Uint8Array(11)); } });
        },
      }),
    };
    useLibrary(el, fakeLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: { name: string; size: number }[] };
      await waitUntil(() => list.items?.length === 1);
      expect(list.items[0].size).to.equal(11);
      expect(decompressCalls).to.equal(0);
    } finally { restore(); }
  });

  it('falls back to decompressing an entry whose header omits the declared size', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const fakeLibrary = {
      loadAsync: () => Promise.resolve({
        forEach(cb: (path: string, file: { name: string; dir: boolean; async: (type: string) => Promise<Uint8Array>; _data?: { uncompressedSize?: number } }) => void) {
          const handlers = new Map<string, (...args: unknown[]) => void>();
          cb('README.txt', {
            name: 'README.txt',
            dir: false,
            async: () => Promise.reject(new Error('must use the bounded stream path')),
            internalStream: () => ({
              on(type: string, handler: (...args: unknown[]) => void) {
                handlers.set(type, handler);
                return this;
              },
              resume() {
                handlers.get('data')?.(new Uint8Array(11));
                handlers.get('end')?.();
              },
            }),
          } as never);
        },
      }),
    };
    useLibrary(el, fakeLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: { name: string; size: number }[] };
      await waitUntil(() => list.items?.length === 1 && list.items[0].size === 11);
      expect(list.items[0].size).to.equal(11);
    } finally { restore(); }
  });

  it('enforces the aggregate uncompressed ceiling when entry headers omit their sizes', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const oversizedLength = 60 * 1024 * 1024;
    let eagerAllocations = 0;
    const streamingFile = (name: string) => ({
      name,
      dir: false,
      async: async () => {
        eagerAllocations++;
        throw new Error('the missing-metadata path must not eagerly allocate the complete entry');
      },
      internalStream: () => {
        const handlers = new Map<string, (...args: unknown[]) => void>();
        return {
          on(type: string, handler: (...args: unknown[]) => void) {
            handlers.set(type, handler);
            return this;
          },
          resume() {
            handlers.get('data')?.({ length: oversizedLength } as Uint8Array);
            handlers.get('end')?.();
          },
        };
      },
    });
    const fakeLibrary = {
      loadAsync: () => Promise.resolve({
        forEach(cb: (path: string, file: { name: string; dir: boolean; async: (type: string) => Promise<Uint8Array> }) => void) {
          cb('one.bin', streamingFile('one.bin'));
          cb('two.bin', streamingFile('two.bin'));
        },
      }),
    };
    useLibrary(el, fakeLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    try {
      let errors = 0;
      el.addEventListener('lr-render-error', () => errors++);
      el.src = 'https://example.test/archive.zip';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="error"]') !== null || el.shadowRoot!.querySelector('lr-virtual-list') !== null,
      );
      expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
      expect(errors).to.equal(1);
      expect(eagerAllocations).to.equal(0);
    } finally {
      restore();
    }
  });

  it('fails closed when an entry with no declared size also has no measurable stream', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const fakeLibrary = {
      loadAsync: () => Promise.resolve({
        forEach(cb: (path: string, file: { name: string; dir: boolean; async: () => Promise<Uint8Array> }) => void) {
          cb('mystery.bin', {
            name: 'mystery.bin',
            dir: false,
            async: () => Promise.reject(new Error('the missing-metadata path must not eagerly decompress')),
            // deliberately no `internalStream`: the size cannot be measured at all.
          } as never);
        },
      }),
    };
    useLibrary(el, fakeLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    try {
      let errors = 0;
      el.addEventListener('lr-render-error', () => errors++);
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
      expect(errors).to.equal(1);
    } finally {
      restore();
    }
  });

  it('aborts a fallback size measurement when the element disconnects before the stream’s first "data" event', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const fakeLibrary = {
      loadAsync: () => Promise.resolve({
        forEach(cb: (path: string, file: { name: string; dir: boolean; async: () => Promise<Uint8Array> }) => void) {
          cb('big.bin', {
            name: 'big.bin',
            dir: false,
            async: () => Promise.reject(new Error('must use the bounded stream path')),
            internalStream: () => ({
              on(type: string, handler: (...args: unknown[]) => void) {
                handlers.set(type, handler);
                return this;
              },
              resume() {
                el.remove();
                handlers.get('data')?.(new Uint8Array(5));
                handlers.get('end')?.();
              },
            }),
          } as never);
        },
      }),
    };
    useLibrary(el, fakeLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    let errors = 0;
    el.addEventListener('lr-render-error', () => errors++);
    try {
      el.src = 'https://example.test/archive.zip';
      await aTimeout(30);
      expect((el as unknown as { fetchState: { kind: string } }).fetchState.kind).to.equal('loading');
      expect((el.shadowRoot!.querySelector('[part="error"]')) == null).to.be.true;
      expect(errors).to.equal(0);
    } finally {
      restore();
    }
  });

  it('aborts a fallback size measurement when the element disconnects between "data" and "end"', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const fakeLibrary = {
      loadAsync: () => Promise.resolve({
        forEach(cb: (path: string, file: { name: string; dir: boolean; async: () => Promise<Uint8Array> }) => void) {
          cb('big.bin', {
            name: 'big.bin',
            dir: false,
            async: () => Promise.reject(new Error('must use the bounded stream path')),
            internalStream: () => ({
              on(type: string, handler: (...args: unknown[]) => void) {
                handlers.set(type, handler);
                return this;
              },
              resume() {
                handlers.get('data')?.(new Uint8Array(5));
                el.remove();
                handlers.get('end')?.();
              },
            }),
          } as never);
        },
      }),
    };
    useLibrary(el, fakeLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    let errors = 0;
    el.addEventListener('lr-render-error', () => errors++);
    try {
      el.src = 'https://example.test/archive.zip';
      await aTimeout(30);
      expect((el as unknown as { fetchState: { kind: string } }).fetchState.kind).to.equal('loading');
      expect((el.shadowRoot!.querySelector('[part="error"]')) == null).to.be.true;
      expect(errors).to.equal(0);
    } finally {
      restore();
    }
  });

  it('ignores a redundant stream error once the size ceiling has already failed the measurement', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const oversizedLength = 101 * 1024 * 1024;
    let pauseCalls = 0;
    const fakeLibrary = {
      loadAsync: () => Promise.resolve({
        forEach(cb: (path: string, file: { name: string; dir: boolean; async: () => Promise<Uint8Array> }) => void) {
          const handlers = new Map<string, (...args: unknown[]) => void>();
          cb('one.bin', {
            name: 'one.bin',
            dir: false,
            async: () => Promise.reject(new Error('must not decompress eagerly')),
            internalStream: () => ({
              on(type: string, handler: (...args: unknown[]) => void) {
                handlers.set(type, handler);
                return this;
              },
              pause() { pauseCalls++; },
              resume() {
                handlers.get('data')?.({ length: oversizedLength } as Uint8Array);
                handlers.get('error')?.(new Error('a redundant stream error'));
                handlers.get('end')?.();
              },
            }),
          } as never);
        },
      }),
    };
    useLibrary(el, fakeLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    try {
      let errors = 0;
      el.addEventListener('lr-render-error', () => errors++);
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
      expect(errors).to.equal(1);
      expect(pauseCalls).to.equal(1);
    } finally {
      restore();
    }
  });

  it('reloads its source after reconnecting the same element instance', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    useLibrary(el, {
      loadAsync: async () => ({ forEach: () => {} }),
    } as unknown as ArchiveLibraryApi);
    const original = window.fetch;
    let fetchCount = 0;
    window.fetch = (() => {
      fetchCount++;
      return Promise.resolve({
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as Response);
    }) as typeof window.fetch;
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => fetchCount === 1);
      const container = document.createElement('div');
      document.body.append(container);
      container.append(el);
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(fetchCount).to.equal(2);
      container.remove();
    } finally {
      window.fetch = original;
    }
  });

  it('invalidates a stale archive rejection before a synchronous reconnect', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const firstLoad = deferred<never>();
    let loadCalls = 0;
    useLibrary(el, {
      loadAsync: () => {
        loadCalls++;
        return loadCalls === 1 ? firstLoad.promise : new Promise<never>(() => {});
      },
    } as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    const reconnectHost = document.createElement('div');
    document.body.append(reconnectHost);
    let errors = 0;
    el.addEventListener('lr-render-error', () => errors++);
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => loadCalls === 1);
      el.remove();
      firstLoad.reject(new Error('stale archive failure'));
      reconnectHost.append(el);
      await aTimeout(30);
      expect(errors).to.equal(0);
      expect(loadCalls).to.equal(2);
    } finally {
      reconnectHost.remove();
      restore();
    }
  });

  it('never accepts stale archive entries resolved before a synchronous reconnect', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const assignedStates: string[] = [];
    let prototype: object | null = el;
    let stateDescriptor: PropertyDescriptor | undefined;
    while (prototype && !stateDescriptor) {
      stateDescriptor = Object.getOwnPropertyDescriptor(prototype, 'fetchState');
      prototype = Object.getPrototypeOf(prototype) as object | null;
    }
    if (!stateDescriptor?.get || !stateDescriptor.set) {
      throw new Error('fetchState reactive accessor not found');
    }
    Object.defineProperty(el, 'fetchState', {
      configurable: true,
      get: () => stateDescriptor!.get!.call(el),
      set: (value: { kind: string }) => {
        assignedStates.push(value.kind);
        stateDescriptor!.set!.call(el, value);
      },
    });
    const firstLoad = deferred<{
      forEach(callback: (path: string, file: {
        name: string;
        dir: boolean;
        _data: { uncompressedSize: number };
      }) => void): void;
    }>();
    let loadCalls = 0;
    useLibrary(el, {
      loadAsync: () => {
        loadCalls++;
        return loadCalls === 1 ? firstLoad.promise : new Promise<never>(() => {});
      },
    } as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    const reconnectHost = document.createElement('div');
    document.body.append(reconnectHost);
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => loadCalls === 1);
      el.remove();
      firstLoad.resolve({
        forEach(callback) {
          callback('stale/old.txt', {
            name: 'stale/old.txt',
            dir: false,
            _data: { uncompressedSize: 1 },
          });
        },
      });
      reconnectHost.append(el);
      await aTimeout(30);
      expect(assignedStates.includes('loaded')).to.equal(false);
      expect(loadCalls).to.equal(2);
    } finally {
      reconnectHost.remove();
      restore();
    }
  });

  it('emits lr-render-error when the optional archive peer is unavailable', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    useLibrary(el, null);
    const restore = stubFetch(new ArrayBuffer(0));
    try {
      let errors = 0;
      el.addEventListener('lr-render-error', () => errors++);
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(errors).to.equal(1);
    } finally {
      restore();
    }
  });

  it('formats entry sizes with the effective locale', async () => {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer locale="ar-EG"></lr-archive-viewer>`);
    const fakeLibrary = {
      loadAsync: () => Promise.resolve({
        forEach(cb: (path: string, file: { name: string; dir: boolean; async: (type: string) => Promise<Uint8Array>; _data?: { uncompressedSize?: number } }) => void) {
          cb('README.txt', {
            name: 'README.txt',
            dir: false,
            _data: { uncompressedSize: 11 },
            async: async () => new Uint8Array(11),
          });
        },
      }),
    };
    useLibrary(el, fakeLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    try {
      el.src = 'https://example.test/archive.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part~="entry-size"]') != null);
      const size = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelector('[part~="entry-size"]')!;
      expect(size.textContent).to.include(new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(11));
    } finally {
      restore();
    }
  });

  it('names the listing region from `name`, forwards a host aria-label, and omits the role when neither is set', async () => {
    const unnamed = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer></lr-archive-viewer>`);
    const base = unnamed.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.be.null;
    expect(base.getAttribute('aria-label')).to.be.null;

    const named = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer name="backup.zip"></lr-archive-viewer>`);
    const namedBase = named.shadowRoot!.querySelector('[part="base"]')!;
    expect(namedBase.getAttribute('role')).to.equal('region');
    expect(namedBase.getAttribute('aria-label')).to.equal('backup.zip');

    const hostLabeled = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer aria-label="Backup contents"></lr-archive-viewer>`);
    const hostLabeledBase = hostLabeled.shadowRoot!.querySelector('[part="base"]')!;
    expect(hostLabeledBase.getAttribute('role')).to.equal('region');
    expect(hostLabeledBase.getAttribute('aria-label')).to.equal('Backup contents');

    const emptyHostLabel = await fixture<LyraArchiveViewer>(
      html`<lr-archive-viewer name="backup.zip" aria-label=""></lr-archive-viewer>`,
    );
    const emptyHostLabelBase = emptyHostLabel.shadowRoot!.querySelector('[part="base"]')!;
    expect(emptyHostLabelBase.getAttribute('role')).to.equal('region');
    expect(emptyHostLabelBase.hasAttribute('aria-label')).to.be.true;
    expect(emptyHostLabelBase.getAttribute('aria-label')).to.equal('');
  });
});

describe('lr-archive-viewer anchor contract across virtualization', () => {
  afterEach(async () => {
    await settleVirtualList();
  });

  const names = [
    ...Array.from({ length: 40 }, (_, index) => `ordinary/file-${index}.txt`),
    'reports/2026/deep-target.csv',
    ...Array.from({ length: 40 }, (_, index) => `trailing/file-${index}.txt`),
  ];
  const targetIndex = 40;

  it('resolves a fragment id as the exact archive-entry path before scrolling its virtual row', async () => {
    const { el, list, restore } = await listingWithEntries(names);
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    try {
      list.rowHeight = '40';
      await list.updateComplete;
      expect(list.shadowRoot!.textContent).to.not.include(names[targetIndex]);
      expect(await el.scrollToAnchor({ kind: 'fragment', id: names[targetIndex]! })).to.be.true;
      await waitUntil(
        () => Array.from(list.shadowRoot!.querySelectorAll<HTMLElement>('[part~="entry-name"]'))
          .some((node) => node.textContent === names[targetIndex]),
      );
      const target = Array.from(list.shadowRoot!.querySelectorAll<HTMLElement>('[part~="entry-name"]'))
        .find((node) => node.textContent === names[targetIndex])!;
      expect(target.closest('[data-row-index]')?.getAttribute('data-row-index')).to.equal(String(targetIndex));
    } finally {
      restore();
    }
  });

  it('resolves a text quote against every entry path, including an unmounted row', async () => {
    const { el, list, restore } = await listingWithEntries(names);
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    try {
      list.rowHeight = '40';
      await list.updateComplete;
      expect(list.shadowRoot!.textContent).to.not.include(names[targetIndex]);
      expect(await el.scrollToAnchor({
        kind: 'text-quote',
        quote: 'deep-target.csv',
        prefix: 'reports/2026/',
      })).to.be.true;
      const target = Array.from(list.shadowRoot!.querySelectorAll<HTMLElement>('[part~="entry-name"]'))
        .find((node) => node.textContent === names[targetIndex])!;
      expect(target.closest('[data-row-index]')?.getAttribute('data-row-index')).to.equal(String(targetIndex));
    } finally {
      restore();
    }
  });

  it('never binds an untrusted archive entry name as a DOM id (DOM-clobbering hazard)', async () => {
    // Regression test: entry.name comes straight out of a fetched ZIP's central directory --
    // fully attacker-controlled. Binding it as a literal `id` is the canonical DOM-clobbering
    // primitive (an `id`/`name` colliding with a `document`/global property). Nothing in this
    // component or lr-virtual-list ever looked an entry up by DOM id (anchor resolution matches
    // entry.name against the DATA, see resolveArchiveAnchor above), so the attribute served no
    // purpose and is now never rendered at all.
    const dangerousNames = ['baseURI', 'body', 'title', 'documentElement'];
    const { list, restore } = await listingWithEntries(dangerousNames);
    try {
      list.rowHeight = '40';
      await list.updateComplete;
      const nameEls = Array.from(list.shadowRoot!.querySelectorAll<HTMLElement>('[part~="entry-name"]'));
      expect(nameEls).to.have.length.greaterThan(0);
      for (const el of nameEls) {
        expect(el.hasAttribute('id'), `unexpected id on entry "${el.textContent}"`).to.be.false;
      }
    } finally {
      restore();
    }
  });

  it('reports a failed fragment jump when a concurrent src reassignment lands during the row wait', async () => {
    const { el, list, restore } = await listingWithEntries(names);
    // One attempt only: the mixin's retry loop would otherwise re-resolve against the newly loaded
    // archive, which is correct behavior but hides this call's own result.
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 0;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 0;
    try {
      list.rowHeight = '40';
      await list.updateComplete;

      // applyAnchor() suspends on `this.updateComplete` after the row is confirmed mounted and
      // before its final entry-name lookup. Reassign `src` through the real public setter from
      // inside exactly that await -- a user clicking a different citation/file tab mid-jump.
      let updateCompleteGetter: (() => Promise<boolean>) | undefined;
      for (let proto = Object.getPrototypeOf(el); proto && !updateCompleteGetter; proto = Object.getPrototypeOf(proto)) {
        updateCompleteGetter = Object.getOwnPropertyDescriptor(proto, 'updateComplete')?.get as (() => Promise<boolean>) | undefined;
      }
      expect(typeof updateCompleteGetter, 'located the real updateComplete getter').to.equal('function');
      let accesses = 0;
      let swapped = false;
      Object.defineProperty(el, 'updateComplete', {
        configurable: true,
        get() {
          accesses += 1;
          const real = updateCompleteGetter!.call(this);
          // 1st access is the mixin's own pre-flight await; the 2nd is applyAnchor's.
          if (accesses !== 2) return real;
          return (async () => {
            await real;
            swapped = true;
            el.src = 'https://example.test/other-archive.zip';
            await updateCompleteGetter!.call(el);
            await aTimeout(0);
            return true;
          })();
        },
      });

      try {
        const found = await el.scrollToAnchor({ kind: 'fragment', id: names[targetIndex]! });
        expect(swapped, 'the reassignment really landed inside the jump').to.equal(true);
        expect(found, 'a jump whose archive was replaced mid-flight is not a success').to.equal(false);
      } finally {
        delete (el as unknown as { updateComplete?: unknown }).updateComplete;
      }
    } finally {
      restore();
    }
  });

  it('gives up scrolling to an anchored row once it is not immediately found and there is no browsing context to retry against', async () => {
    const { el, list, restore } = await listingWithEntries(names);
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    try {
      list.rowHeight = '40';
      await list.updateComplete;
      expect(list.shadowRoot!.textContent).to.not.include(names[targetIndex]);
      // Simulates an element adopted into a document with no browsing context (e.g.
      // `document.implementation.createHTMLDocument()`): `waitForArchiveRow()` cannot fall back to
      // `requestAnimationFrame` and must give up instead of retrying forever.
      Object.defineProperty(el, 'ownerDocument', {
        configurable: true,
        get: () => ({ defaultView: null }),
      });
      try {
        expect(await el.scrollToAnchor({ kind: 'fragment', id: names[targetIndex]! })).to.be.false;
      } finally {
        delete (el as unknown as { ownerDocument?: unknown }).ownerDocument;
      }
    } finally {
      restore();
    }
  });
});

describe('lr-archive-viewer part reachability through the embedded virtual list', () => {
  // Entry rows are produced by this component's `renderItem` but committed into
  // `<lr-virtual-list>`'s OWN shadow root, one boundary deeper than this component's stylesheet.
  // Every assertion reads back the *rendered* result on the real row element -- a declaration that
  // never matches is indistinguishable from a working one when read off the stylesheet source.
  function resolveDeclaration(root: ShadowRoot, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    root.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  const listingLibrary = {
    loadAsync: () => Promise.resolve({
      forEach(cb: (path: string, file: { name: string; dir: boolean; async: (type: string) => Promise<Uint8Array>; _data?: { uncompressedSize?: number } }) => void) {
        cb('src/', { name: 'src/', dir: true, _data: { uncompressedSize: 0 }, async: () => Promise.resolve(new Uint8Array(0)) });
        cb('README.txt', { name: 'README.txt', dir: false, _data: { uncompressedSize: 11 }, async: () => Promise.resolve(new Uint8Array(11)) });
      },
    }),
  };

  async function listing(className = ''): Promise<{ el: LyraArchiveViewer; vlistRoot: ShadowRoot; restore: () => void }> {
    const el = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer class=${className} name="backup.zip"></lr-archive-viewer>`);
    useLibrary(el, listingLibrary as unknown as ArchiveLibraryApi);
    const restore = stubFetch(new ArrayBuffer(0));
    el.src = 'https://example.test/archive.zip';
    await waitUntil(
      () => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part~="entry"]') != null,
      undefined,
      { timeout: 5000 },
    );
    return { el, vlistRoot: el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!, restore };
  }

  it('applies the entry-row layout to rows rendered inside the virtual list', async () => {
    const { vlistRoot, restore } = await listing();
    try {
      const row = vlistRoot.querySelector('[part~="entry"]') as HTMLElement;
      const style = getComputedStyle(row);
      expect(style.display).to.equal('flex');
      expect(style.alignItems).to.equal('center');
      expect(style.fontSize).to.equal(resolveDeclaration(vlistRoot, 'font-size: var(--lr-font-size-sm)', 'font-size'));
      const quiet = resolveDeclaration(vlistRoot, 'color: var(--lr-color-text-quiet)', 'color');
      const size = vlistRoot.querySelector('[part~="entry-size"]') as HTMLElement;
      expect(getComputedStyle(size).color).to.equal(quiet);
      expect(getComputedStyle(size).fontSize).to.equal(
        resolveDeclaration(vlistRoot, 'font-size: var(--lr-font-size-md-sm)', 'font-size'),
      );
      const icon = vlistRoot.querySelector('[part~="entry-icon"]') as HTMLElement;
      // `inline-flex` blockifies to `flex` here because the icon is a flex item of the row; a
      // <span> with no rule applied would compute to `block` instead.
      expect(getComputedStyle(icon).display).to.equal('flex');
      expect(getComputedStyle(icon).color).to.equal(quiet);
      const name = vlistRoot.querySelector('[part~="entry-name"]') as HTMLElement;
      expect(getComputedStyle(name).textOverflow).to.equal('ellipsis');
      expect(getComputedStyle(name).whiteSpace).to.equal('nowrap');
    } finally {
      restore();
    }
  });

  it('gives a directory entry name the directory treatment and a file entry name the plain one', async () => {
    const { vlistRoot, restore } = await listing();
    try {
      const dirName = vlistRoot.querySelector('[part~="entry-name-dir"]') as HTMLElement;
      expect(dirName.textContent).to.equal('src/');
      const semibold = resolveDeclaration(vlistRoot, 'font-weight: var(--lr-font-weight-semibold)', 'font-weight');
      expect(getComputedStyle(dirName).fontWeight).to.equal(semibold);

      const names = vlistRoot.querySelectorAll('[part~="entry-name"]');
      expect(names).to.have.lengthOf(2);
      const fileName = Array.from(names).find((node) => node.textContent === 'README.txt') as HTMLElement;
      expect(fileName.getAttribute('part')).to.equal('entry-name');
      expect(getComputedStyle(fileName).fontWeight).to.not.equal(semibold);
    } finally {
      restore();
    }
  });

  it('isolates entry names and formatted sizes from an inherited RTL direction', async () => {
    const { vlistRoot, restore } = await listing();
    try {
      const names = Array.from(vlistRoot.querySelectorAll('[part~="entry-name"]'));
      expect(names.every((name) => name.getAttribute('dir') === 'auto')).to.be.true;
      expect(vlistRoot.querySelector('[part~="entry-size"]')!.getAttribute('dir')).to.equal('auto');
    } finally {
      restore();
    }
  });

  it('lets a consumer stylesheet reach the virtualized rows through exportparts', async () => {
    const sheet = document.createElement('style');
    sheet.textContent = `
      lr-archive-viewer.consumer-probe::part(entry) { background: rgb(1, 2, 3); }
      lr-archive-viewer.consumer-probe::part(entry-name-dir) { color: rgb(4, 5, 6); }
    `;
    document.head.append(sheet);
    const { vlistRoot, restore } = await listing('consumer-probe');
    try {
      const row = vlistRoot.querySelector('[part~="entry"]') as HTMLElement;
      expect(getComputedStyle(row).backgroundColor).to.equal('rgb(1, 2, 3)');
      const dirName = vlistRoot.querySelector('[part~="entry-name-dir"]') as HTMLElement;
      expect(getComputedStyle(dirName).color).to.equal('rgb(4, 5, 6)');
    } finally {
      restore();
      sheet.remove();
    }
  });

  it('emits one entry-scoped text-quote anchor for a selection inside the nested shadow root', async function () {
    const { el, vlistRoot, restore } = await listing();
    const name = Array.from(vlistRoot.querySelectorAll<HTMLElement>('[part~="entry-name"]'))
      .find((node) => node.textContent === 'README.txt')!;
    const textNode = Array.from(name.childNodes)
      .find((node): node is Text => node.nodeType === Node.TEXT_NODE && node.textContent === 'README.txt')!;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 'README'.length);
    const selection = (
      vlistRoot as unknown as { getSelection?: () => Selection | null }
    ).getSelection?.() ?? window.getSelection()!;
    const events: CustomEvent[] = [];
    el.addEventListener('lr-text-select', (event) => events.push(event as CustomEvent));
    try {
      selection.removeAllRanges();
      selection.addRange(range);
      // WebKit silently drops a programmatic `addRange()` whose boundary nodes live in a shadow
      // tree (verified: `rangeCount` stays 0 and `getComposedRanges()` returns nothing, while
      // Chromium and Firefox both accept it). There is then no selection for the component to read,
      // so this asserts nothing about `lr-archive-viewer` -- a real drag-selection still works
      // there, it is only the *programmatic* setup that has no WebKit equivalent. Skip rather than
      // fail, so the gap stays visible in the report instead of reading as a product defect.
      if (selection.rangeCount === 0) this.skip();
      name.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true }));
      await aTimeout(30);
      expect(events).to.have.lengthOf(1);
      expect(events[0]!.detail.text).to.equal('README');
      expect(events[0]!.detail.anchor).to.deep.include({
        kind: 'text-quote',
        quote: 'README',
      });
    } finally {
      selection.removeAllRanges();
      restore();
    }
  });

  it('does not emit lr-text-select when there is no active selection', async () => {
    const { el, vlistRoot, restore } = await listing();
    const selection = (
      vlistRoot as unknown as { getSelection?: () => Selection | null }
    ).getSelection?.() ?? window.getSelection()!;
    const events: CustomEvent[] = [];
    el.addEventListener('lr-text-select', (event) => events.push(event as CustomEvent));
    try {
      selection.removeAllRanges();
      const row = vlistRoot.querySelector('[part~="entry"]') as HTMLElement;
      row.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true }));
      await aTimeout(30);
      expect(events).to.have.lengthOf(0);
    } finally {
      restore();
    }
  });

  it('does not emit lr-text-select for a selection with no renderable text (the decorative icon)', async () => {
    // A real drag-selection over pure SVG glyph content (no text) gets auto-collapsed by the
    // engine before it can ever reach `addRange()` -- verified empirically in this environment, not
    // something this component controls. Stubbing `getComposedRanges()` to report a *valid*,
    // non-collapsed composed range over just the icon span (one sibling index to the next, no text
    // node in between) reaches the same `emitSelection()` code path deterministically instead.
    const { el, vlistRoot, restore } = await listing();
    const row = vlistRoot.querySelector('[part~="entry"]') as HTMLElement;
    const globalSelectionObj = window.getSelection() as (Selection & { getComposedRanges?: unknown }) | null;
    const hadOwn = globalSelectionObj
      ? Object.prototype.hasOwnProperty.call(globalSelectionObj, 'getComposedRanges')
      : false;
    const ownDescriptor = globalSelectionObj && hadOwn
      ? Object.getOwnPropertyDescriptor(globalSelectionObj, 'getComposedRanges')
      : undefined;
    if (globalSelectionObj) {
      Object.defineProperty(globalSelectionObj, 'getComposedRanges', {
        configurable: true,
        // Spans row's first child (the icon span) as a whole sibling range -- non-collapsed
        // (offset 0 to 1) but containing no text node at all.
        value: () => [{ startContainer: row, startOffset: 0, endContainer: row, endOffset: 1 }],
      });
    }
    const events: CustomEvent[] = [];
    el.addEventListener('lr-text-select', (event) => events.push(event as CustomEvent));
    try {
      row.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true }));
      await aTimeout(30);
      expect(events).to.have.lengthOf(0);
    } finally {
      if (globalSelectionObj) {
        if (hadOwn && ownDescriptor) {
          Object.defineProperty(globalSelectionObj, 'getComposedRanges', ownDescriptor);
        } else {
          delete (globalSelectionObj as unknown as { getComposedRanges?: unknown }).getComposedRanges;
        }
      }
      restore();
    }
  });

  it('resolves a selection through the document-level selection fallback when composed-range lookup and the nested shadow selection are both unavailable', async function () {
    const { el, vlistRoot, restore } = await listing();
    const name = Array.from(vlistRoot.querySelectorAll<HTMLElement>('[part~="entry-name"]'))
      .find((node) => node.textContent === 'README.txt')!;
    const textNode = Array.from(name.childNodes)
      .find((node): node is Text => node.nodeType === Node.TEXT_NODE && node.textContent === 'README.txt')!;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 'README'.length);
    const events: CustomEvent[] = [];
    el.addEventListener('lr-text-select', (event) => events.push(event as CustomEvent));
    // Forces the full fallback chain this test targets: without a supported `getComposedRanges`
    // *and* without the nested shadow root's own `getSelection()`, the component must fall all the
    // way back to the document-level `getSelection()` -- both stubs are restored afterward, since
    // these are shared built-ins (a prototype method and the shadow root instance itself).
    const globalSelectionObj = window.getSelection() as (Selection & { getComposedRanges?: unknown }) | null;
    const hadOwnComposed = globalSelectionObj
      ? Object.prototype.hasOwnProperty.call(globalSelectionObj, 'getComposedRanges')
      : false;
    const composedDescriptor = globalSelectionObj && hadOwnComposed
      ? Object.getOwnPropertyDescriptor(globalSelectionObj, 'getComposedRanges')
      : undefined;
    if (globalSelectionObj) {
      Object.defineProperty(globalSelectionObj, 'getComposedRanges', { configurable: true, value: undefined });
    }
    const hadOwnNestedSelection = Object.prototype.hasOwnProperty.call(vlistRoot, 'getSelection');
    const nestedSelectionDescriptor = hadOwnNestedSelection
      ? Object.getOwnPropertyDescriptor(vlistRoot, 'getSelection')
      : undefined;
    Object.defineProperty(vlistRoot, 'getSelection', { configurable: true, value: undefined });
    try {
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      // Same WebKit programmatic-selection gap noted above -- skip rather than fail.
      if (selection.rangeCount === 0) this.skip();
      name.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true }));
      await aTimeout(30);
      expect(events).to.have.lengthOf(1);
      expect(events[0]!.detail.text).to.equal('README');
      selection.removeAllRanges();
    } finally {
      if (globalSelectionObj) {
        if (hadOwnComposed && composedDescriptor) {
          Object.defineProperty(globalSelectionObj, 'getComposedRanges', composedDescriptor);
        } else {
          delete (globalSelectionObj as unknown as { getComposedRanges?: unknown }).getComposedRanges;
        }
      }
      if (hadOwnNestedSelection && nestedSelectionDescriptor) {
        Object.defineProperty(vlistRoot, 'getSelection', nestedSelectionDescriptor);
      } else {
        delete (vlistRoot as unknown as { getSelection?: unknown }).getSelection;
      }
      restore();
    }
  });

  it('does not emit lr-text-select when there is no browsing context to read any selection from at all', async () => {
    // The absolute-last resort of `nestedSelection ?? globalSelection ?? null`: reachable only when
    // the element's own `ownerDocument.defaultView` is null (e.g. adopted into a windowless
    // document -- see the analogous `scrollToAnchor` test above) *and* the nested shadow root
    // exposes no `getSelection()`, so neither fallback ever produces a Selection to read.
    const { el, vlistRoot, restore } = await listing();
    const hadOwnNestedSelection = Object.prototype.hasOwnProperty.call(vlistRoot, 'getSelection');
    const nestedSelectionDescriptor = hadOwnNestedSelection
      ? Object.getOwnPropertyDescriptor(vlistRoot, 'getSelection')
      : undefined;
    Object.defineProperty(vlistRoot, 'getSelection', { configurable: true, value: undefined });
    Object.defineProperty(el, 'ownerDocument', {
      configurable: true,
      get: () => ({ defaultView: null }),
    });
    const events: CustomEvent[] = [];
    el.addEventListener('lr-text-select', (event) => events.push(event as CustomEvent));
    try {
      const row = vlistRoot.querySelector('[part~="entry"]') as HTMLElement;
      row.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true }));
      await aTimeout(30);
      expect(events).to.have.lengthOf(0);
    } finally {
      delete (el as unknown as { ownerDocument?: unknown }).ownerDocument;
      if (hadOwnNestedSelection && nestedSelectionDescriptor) {
        Object.defineProperty(vlistRoot, 'getSelection', nestedSelectionDescriptor);
      } else {
        delete (vlistRoot as unknown as { getSelection?: unknown }).getSelection;
      }
      restore();
    }
  });

  it('runs the previous entry-selection cleanup when the archive reloads to an empty listing', async () => {
    const { el, restore } = await listing();
    const originalCleanup = (
      el as unknown as { archiveSelectionCleanup?: () => void }
    ).archiveSelectionCleanup;
    expect(originalCleanup).to.be.a('function');
    let cleanupCalls = 0;
    (el as unknown as { archiveSelectionCleanup?: () => void }).archiveSelectionCleanup = () => {
      cleanupCalls++;
      originalCleanup!();
    };
    useLibrary(el, { loadAsync: () => Promise.resolve({ forEach: () => {} }) } as unknown as ArchiveLibraryApi);
    try {
      el.src = 'https://example.test/empty.zip';
      await waitUntil(() => el.shadowRoot!.querySelector('.empty-note') !== null);
      expect(cleanupCalls).to.equal(1);
    } finally {
      restore();
    }
  });

  it('does not append a second highlight stylesheet when one is already present in the virtual-list shadow root', async () => {
    const { el, vlistRoot, restore } = await listing();
    try {
      expect(vlistRoot.querySelectorAll('style[data-lr-archive-highlight-styles]')).to.have.lengthOf(1);
      (el as unknown as { styledVirtualListRoot: ShadowRoot | null }).styledVirtualListRoot = null;
      (el as unknown as { syncArchiveNestedRoot(): void }).syncArchiveNestedRoot();
      expect(vlistRoot.querySelectorAll('style[data-lr-archive-highlight-styles]')).to.have.lengthOf(1);
    } finally {
      restore();
    }
  });

  it('paints a visible entry-path text quote in the fallback highlight path', async () => {
    const originalHighlight = (globalThis as { Highlight?: unknown }).Highlight;
    (globalThis as { Highlight?: unknown }).Highlight = undefined;
    try {
      const { el, vlistRoot, restore } = await listing();
      try {
        el.highlights = [{
          id: 'readme',
          tone: 'warning',
          anchor: { kind: 'text-quote', quote: 'README' },
        }];
        await el.updateComplete;
        await waitUntil(
          () => vlistRoot.querySelector('mark[data-lr-highlight-tone="warning"]') !== null,
        );
        const mark = vlistRoot.querySelector<HTMLElement>(
          'mark[data-lr-highlight-tone="warning"]',
        )!;
        expect(mark.getAttribute('part')).to.include('highlight');
        expect(getComputedStyle(mark).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
      } finally {
        restore();
      }
    } finally {
      (globalThis as { Highlight?: unknown }).Highlight = originalHighlight;
    }
  });

  it('renders a neutral-tone highlight with real contrast against the ambient entry-row background', async () => {
    const originalHighlight = (globalThis as { Highlight?: unknown }).Highlight;
    (globalThis as { Highlight?: unknown }).Highlight = undefined;
    try {
      const { el, vlistRoot, restore } = await listing();
      try {
        el.highlights = [{ id: 'readme', tone: 'neutral', anchor: { kind: 'text-quote', quote: 'README' } }];
        await el.updateComplete;
        await waitUntil(() => vlistRoot.querySelector('mark[data-lr-highlight-tone="neutral"]') !== null);
        const mark = vlistRoot.querySelector<HTMLElement>('mark[data-lr-highlight-tone="neutral"]')!;
        const row = mark.closest('[part~="entry"]') as HTMLElement;

        // `neutral` is a first-class documented LyraHighlightTone. Falling its background back to
        // the very token the viewer paints its own surface with makes the highlight invisible --
        // the row shows exactly that ambient colour, so the marked text reads as unhighlighted.
        const ambient = resolveDeclaration(vlistRoot, 'background: var(--lr-color-surface)', 'background-color');
        expect(getComputedStyle(mark).backgroundColor).to.not.equal(ambient);
        expect(getComputedStyle(mark).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
        expect(getComputedStyle(mark).backgroundColor).to.not.equal(getComputedStyle(row).backgroundColor);

        // Still fully retunable through the documented cssprop.
        el.style.setProperty('--lr-archive-viewer-highlight-neutral-background', 'rgb(9, 8, 7)');
        expect(getComputedStyle(mark).backgroundColor).to.equal('rgb(9, 8, 7)');
      } finally {
        restore();
      }
    } finally {
      (globalThis as { Highlight?: unknown }).Highlight = originalHighlight;
    }
  });

  it('is accessible with entries listed', async () => {
    const { el, vlistRoot, restore } = await listing();
    try {
      expect(vlistRoot.querySelectorAll('[part~="entry"]')).to.have.lengthOf(2);
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });
});
