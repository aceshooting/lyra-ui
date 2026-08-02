import { expect, fixture, html, aTimeout } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { invalidateLyraTheme, ThemeWatcher } from './theme-watcher.js';

const activeDisconnects = new Set<() => void>();

afterEach(() => {
  for (const disconnect of [...activeDisconnects]) disconnect();
  activeDisconnects.clear();
});

/** A minimal ReactiveControllerHost backed by a real element, capturing the controller the
 *  ThemeWatcher registers so tests can drive its lifecycle hooks directly. */
async function makeHost(ownerDocument: Document = document): Promise<{
  host: ReactiveControllerHost & Element;
  connect(): void;
  disconnect(): void;
}> {
  const el = ownerDocument === document
    ? ((await fixture(html`<div></div>`)) as HTMLElement)
    : ownerDocument.body.appendChild(ownerDocument.createElement('div'));
  const controllers: ReactiveController[] = [];
  const host = Object.assign(el, {
    addController(c: ReactiveController) {
      controllers.push(c);
    },
    removeController() {},
    requestUpdate() {},
    updateComplete: Promise.resolve(true),
  }) as unknown as ReactiveControllerHost & Element;
  let connected = false;
  const disconnect = () => {
    if (!connected) return;
    connected = false;
    controllers.forEach((c) => c.hostDisconnected?.());
    activeDisconnects.delete(disconnect);
  };
  return {
    host,
    connect: () => {
      if (connected) return;
      connected = true;
      activeDisconnects.add(disconnect);
      controllers.forEach((c) => c.hostConnected?.());
    },
    disconnect,
  };
}

describe('ThemeWatcher', () => {
  it('invokes onChange (coalesced) when a watched attribute mutates on the host', async () => {
    const { host, connect } = await makeHost();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    connect();
    host.setAttribute('data-theme', 'a');
    host.setAttribute('data-color-scheme', 'b');
    await aTimeout(0);
    expect(calls).to.equal(1);
  });

  it('invokes onChange when a watched attribute mutates on an ancestor', async () => {
    const parent = (await fixture(html`<div><span></span></div>`)) as HTMLElement;
    const child = parent.querySelector('span') as HTMLElement;
    const controllers: ReactiveController[] = [];
    const host = Object.assign(child, {
      addController(c: ReactiveController) {
        controllers.push(c);
      },
      removeController() {},
      requestUpdate() {},
      updateComplete: Promise.resolve(true),
    }) as unknown as ReactiveControllerHost & Element;
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    controllers.forEach((c) => c.hostConnected?.());
    try {
      parent.setAttribute('data-theme', 'dark');
      await aTimeout(0);
      expect(calls).to.equal(1);
    } finally {
      controllers.forEach((c) => c.hostDisconnected?.());
    }
  });

  it('invokes onChange when data-lr-theme toggles on an ancestor', async () => {
    // data-lr-theme is the library's own light/dark switch: an ancestor carrying it re-resolves
    // every token in tokens.styles.ts and tokens/palette.styles.ts, with nothing else to observe.
    const parent = (await fixture(html`<div><span></span></div>`)) as HTMLElement;
    const child = parent.querySelector('span') as HTMLElement;
    const controllers: ReactiveController[] = [];
    const host = Object.assign(child, {
      addController(c: ReactiveController) {
        controllers.push(c);
      },
      removeController() {},
      requestUpdate() {},
      updateComplete: Promise.resolve(true),
    }) as unknown as ReactiveControllerHost & Element;
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    controllers.forEach((c) => c.hostConnected?.());
    try {
      parent.setAttribute('data-lr-theme', 'dark');
      await aTimeout(0);
      expect(calls).to.equal(1);
      parent.setAttribute('data-lr-theme', 'light');
      await aTimeout(0);
      expect(calls).to.equal(2);
    } finally {
      controllers.forEach((c) => c.hostDisconnected?.());
    }
  });

  it('invokes onChange when data-lr-theme mutates on the host itself', async () => {
    const { host, connect } = await makeHost();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    connect();
    host.setAttribute('data-lr-theme', 'dark');
    await aTimeout(0);
    expect(calls).to.equal(1);
  });

  it('stops observing after hostDisconnected()', async () => {
    const { host, connect, disconnect } = await makeHost();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    connect();
    disconnect();
    host.setAttribute('data-theme', 'a');
    await aTimeout(0);
    expect(calls).to.equal(0);
  });

  it('does nothing when the host document has no defaultView (defensive branch)', async () => {
    const { host, connect } = await makeHost();
    new ThemeWatcher(host, () => {});
    Object.defineProperty(host, 'ownerDocument', { configurable: true, value: { defaultView: null } });
    try {
      expect(() => connect()).to.not.throw();
    } finally {
      delete (host as unknown as Record<string, unknown>).ownerDocument;
    }
  });

  it('skips the MutationObserver when the global is unavailable (defensive branch)', async () => {
    const { host, connect } = await makeHost();
    const original = window.MutationObserver;
    // @ts-expect-error -- deliberately removing the global to exercise the fallback
    delete window.MutationObserver;
    try {
      new ThemeWatcher(host, () => {});
      expect(() => connect()).to.not.throw();
    } finally {
      window.MutationObserver = original;
    }
  });

  it('coalesces explicit public invalidations and is server-safe without a root', async () => {
    const { host, connect } = await makeHost();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    connect();
    invalidateLyraTheme(document);
    invalidateLyraTheme(host);
    await aTimeout(0);
    expect(calls).to.equal(1);
    expect(() => invalidateLyraTheme()).to.not.throw();
  });

  it('reacts to stylesheet text and rule-only changes', async () => {
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    let calls = 0;
    const watched = await makeHost(frameDocument);
    new ThemeWatcher(watched.host, () => calls++);
    watched.connect();

    const style = frameDocument.createElement('style');
    style.textContent = ':root { --lr-theme-test: red; }';
    frameDocument.head.append(style);
    try {
      await aTimeout(0);
      calls = 0;
      style.textContent = ':root { --lr-theme-test: orange; }';
      await aTimeout(0);
      expect(calls).to.equal(1);

      style.sheet!.insertRule(':root { --lr-theme-test: blue; }');
      style.sheet!.deleteRule(0);
      await aTimeout(0);
      expect(calls).to.equal(2);
    } finally {
      style.remove();
      watched.disconnect();
    }
  });

  it('keeps stylesheet instrumentation isolated to its browser realm', async () => {
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const top = await makeHost();
    const frame = await makeHost(frameDocument);
    let topCalls = 0;
    let frameCalls = 0;
    new ThemeWatcher(top.host, () => topCalls++);
    new ThemeWatcher(frame.host, () => frameCalls++);
    top.connect();
    frame.connect();
    const topStyle = document.createElement('style');
    const frameStyle = frameDocument.createElement('style');
    topStyle.textContent = ':root {}';
    frameStyle.textContent = ':root {}';
    document.head.append(topStyle);
    frameDocument.head.append(frameStyle);
    try {
      await aTimeout(0);
      topCalls = 0;
      frameCalls = 0;
      frameStyle.sheet!.insertRule(':root { --lr-theme-test: plum; }');
      await aTimeout(0);
      expect(frameCalls).to.equal(1);
      expect(topCalls).to.equal(0);

      topStyle.sheet!.insertRule(':root { --lr-theme-test: gold; }');
      await aTimeout(0);
      expect(topCalls).to.equal(1);
      expect(frameCalls).to.equal(1);
    } finally {
      topStyle.remove();
      frameStyle.remove();
      top.disconnect();
      frame.disconnect();
    }
  });

  it('reacts to nested grouping-rule, media-text, and link activation changes', async () => {
    const { host, connect, disconnect } = await makeHost();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    connect();
    const style = document.createElement('style');
    style.textContent = '@media all {}';
    const link = document.createElement('link');
    link.rel = 'preload';
    document.head.append(style, link);
    try {
      await aTimeout(0);
      calls = 0;
      const mediaRule = style.sheet!.cssRules[0] as CSSMediaRule;
      mediaRule.insertRule(':root { --lr-theme-test: teal; }');
      mediaRule.deleteRule(0);
      await aTimeout(0);
      expect(calls).to.equal(1);

      style.sheet!.media.mediaText = '(min-width: 1px)';
      await aTimeout(0);
      expect(calls).to.equal(2);

      link.rel = 'stylesheet';
      await aTimeout(0);
      expect(calls).to.equal(3);
    } finally {
      style.remove();
      link.remove();
      disconnect();
    }
  });

  it('reacts to adopted stylesheet replacement and constructed-sheet mutation', async () => {
    const { host, connect, disconnect } = await makeHost();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    connect();
    const originalSheets = document.adoptedStyleSheets;
    const sheet = new CSSStyleSheet();
    try {
      document.adoptedStyleSheets = [...originalSheets, sheet];
      await aTimeout(0);
      expect(calls).to.equal(1);

      sheet.replaceSync(':root { --lr-theme-test: green; }');
      await aTimeout(0);
      expect(calls).to.equal(2);

      const returned = sheet.replace(':root { --lr-theme-test: purple; }');
      expect(returned).to.be.instanceOf(Promise);
      await returned;
      await aTimeout(0);
      expect(calls).to.equal(3);
    } finally {
      document.adoptedStyleSheets = originalSheets;
      disconnect();
    }
  });

  it('reacts when a constructed rule declaration changes without replacing its sheet', async () => {
    const { host, connect, disconnect } = await makeHost();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    connect();
    const originalSheets = document.adoptedStyleSheets;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(':root { --lr-theme-test: red; }');
    try {
      document.adoptedStyleSheets = [...originalSheets, sheet];
      await aTimeout(0);
      calls = 0;
      const declaration = (sheet.cssRules[0] as CSSStyleRule).style;
      declaration.setProperty('--lr-theme-test', 'blue');
      await aTimeout(0);
      expect(calls).to.equal(1);

      declaration.removeProperty('--lr-theme-test');
      await aTimeout(0);
      expect(calls).to.equal(2);
    } finally {
      document.adoptedStyleSheets = originalSheets;
      disconnect();
    }
  });

  it('reacts to media-query-only theme changes and removes the listener on disconnect', async () => {
    const originalMatchMedia = window.matchMedia;
    const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>();
    window.matchMedia = ((query: string) => {
      const callbacks = listeners.get(query) ?? new Set<(event: MediaQueryListEvent) => void>();
      listeners.set(query, callbacks);
      return {
        media: query,
        matches: false,
        onchange: null,
        addEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
          callbacks.add(listener as (event: MediaQueryListEvent) => void);
        },
        removeEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
          callbacks.delete(listener as (event: MediaQueryListEvent) => void);
        },
        addListener() {},
        removeListener() {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    }) as typeof matchMedia;
    const { host, connect, disconnect } = await makeHost();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    try {
      connect();
      const callbacks = listeners.get('(prefers-color-scheme: dark)');
      expect(callbacks?.size).to.equal(1);
      callbacks?.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
      await aTimeout(0);
      expect(calls).to.equal(1);
      disconnect();
      expect(callbacks?.size).to.equal(0);
    } finally {
      disconnect();
      window.matchMedia = originalMatchMedia;
    }
  });

  it('restores CSSOM descriptors after the last watcher disconnects', async () => {
    const descriptors = [
      [CSSStyleSheet.prototype, 'insertRule'],
      [CSSGroupingRule.prototype, 'insertRule'],
      [CSSStyleDeclaration.prototype, 'setProperty'],
      [MediaList.prototype, 'mediaText'],
      [Document.prototype, 'adoptedStyleSheets'],
    ] as const;
    const before = descriptors.map(([target, key]) =>
      Object.getOwnPropertyDescriptor(target, key));
    const { host, connect, disconnect } = await makeHost();
    new ThemeWatcher(host, () => {});
    connect();
    expect(Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'insertRule')?.value).to.not.equal(
      before[0]?.value,
    );
    disconnect();
    await aTimeout(0);
    descriptors.forEach(([target, key], index) => {
      expect(Object.getOwnPropertyDescriptor(target, key)).to.deep.equal(before[index]);
    });
  });

  it('keeps one realm patch active until every watcher disconnects', () => {
    const first = makeHost();
    const second = makeHost();
    return Promise.all([first, second]).then(([a, b]) => {
      const original = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'insertRule')?.value;
      new ThemeWatcher(a.host, () => {});
      new ThemeWatcher(b.host, () => {});
      a.connect();
      const patched = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'insertRule')?.value;
      b.connect();
      a.disconnect();
      expect(Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'insertRule')?.value).to.equal(patched);
      b.disconnect();
      expect(Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'insertRule')?.value).to.equal(original);
    });
  });

  it('preserves an async CSSStyleSheet method return value and rejection', async () => {
    const original = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'replace')!;
    const expectedError = new Error('replace failed');
    const expectedPromise = Promise.reject<CSSStyleSheet>(expectedError);
    void expectedPromise.catch(() => undefined);
    Object.defineProperty(CSSStyleSheet.prototype, 'replace', {
      ...original,
      value() {
        return expectedPromise;
      },
    });
    const { host, connect, disconnect } = await makeHost();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    try {
      connect();
      const returned = new CSSStyleSheet().replace(':root {}');
      expect(returned).to.equal(expectedPromise);
      let rejection: unknown;
      try {
        await returned;
      } catch (error) {
        rejection = error;
      }
      expect(rejection).to.equal(expectedError);
      await aTimeout(0);
      expect(calls).to.equal(0);
    } finally {
      disconnect();
      Object.defineProperty(CSSStyleSheet.prototype, 'replace', original);
    }
  });

  it('shares one realm patch across separately evaluated ThemeWatcher modules', async () => {
    const copyA = await import('./theme-watcher.js?realm-copy=a');
    const copyB = await import('./theme-watcher.js?realm-copy=b');
    const a = await makeHost();
    const b = await makeHost();
    const original = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'insertRule')?.value;
    new copyA.ThemeWatcher(a.host, () => {});
    new copyB.ThemeWatcher(b.host, () => {});
    a.connect();
    const sharedPatch = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'insertRule')?.value;
    b.connect();
    expect(Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'insertRule')?.value).to.equal(sharedPatch);
    a.disconnect();
    expect(Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'insertRule')?.value).to.equal(sharedPatch);
    b.disconnect();
    expect(Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'insertRule')?.value).to.equal(original);
  });
});
