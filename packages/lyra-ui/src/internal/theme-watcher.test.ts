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

// theme-watcher.ts publishes its per-realm hub under this well-known Symbol.for() key so that
// separately evaluated copies of the module (see the "separately evaluated ThemeWatcher modules"
// test) still share one instrumentation pass. That same registry key lets a test reach the hub
// from outside the module -- the only way to force `installed`/`patches` into states
// (already-installed, never-installed) that installRealmInstrumentation()/
// uninstallRealmInstrumentation() guard against but that ThemeWatcher's own call sites never
// organically produce (every real call site only invokes them while the hub is in the opposite
// state already).
const THEME_HUB_KEY = Symbol.for('@aceshooting/lyra-ui.theme-invalidation.v1');
interface TestableThemeHub {
  installed: boolean;
  patches: unknown[];
}
function hubForRealm(realm: Window): TestableThemeHub {
  return (realm as unknown as Record<symbol, unknown>)[THEME_HUB_KEY] as TestableThemeHub;
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

      mediaRule.media.mediaText = '(min-width: 1px)';
      await aTimeout(0);
      expect(calls).to.equal(2);

      style.sheet!.media.mediaText = '(min-width: 1px)';
      await aTimeout(0);
      expect(calls).to.equal(3);

      link.rel = 'stylesheet';
      await aTimeout(0);
      expect(calls).to.equal(4);
    } finally {
      style.remove();
      link.remove();
      disconnect();
    }
  });

  it('continues past an opaque nested rule while locating a later relevant media list', async () => {
    const first = document.createElement('style');
    first.textContent = '@media all {}';
    const second = document.createElement('style');
    second.textContent = ':root {}';
    document.head.append(first, second);
    const mediaRule = first.sheet!.cssRules[0] as CSSMediaRule;
    const originalRules = Object.getOwnPropertyDescriptor(mediaRule, 'cssRules');
    const { host, connect, disconnect } = await makeHost();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    try {
      connect();
      await aTimeout(0);
      calls = 0;
      Object.defineProperty(mediaRule, 'cssRules', {
        configurable: true,
        get() {
          throw new Error('opaque nested rules');
        },
      });
      second.sheet!.media.mediaText = '(min-width: 2px)';
      await aTimeout(0);
      expect(calls).to.equal(1);
    } finally {
      if (originalRules) Object.defineProperty(mediaRule, 'cssRules', originalRules);
      else Reflect.deleteProperty(mediaRule, 'cssRules');
      first.remove();
      second.remove();
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

  it('does not scan watched roots for an unrelated shadow-root stylesheet replacement', async () => {
    const { host, connect, disconnect } = await makeHost();
    const watchedRoot = host.attachShadow({ mode: 'open' });
    const unrelatedHost = document.body.appendChild(document.createElement('div'));
    const unrelatedRoot = unrelatedHost.attachShadow({ mode: 'open' });
    const watchedSheets = watchedRoot.adoptedStyleSheets;
    const unrelatedSheets = unrelatedRoot.adoptedStyleSheets;
    const originalQuerySelectorAll = watchedRoot.querySelectorAll.bind(watchedRoot);
    let watchedRootScans = 0;
    Object.defineProperty(watchedRoot, 'querySelectorAll', {
      configurable: true,
      value(selectors: string) {
        if (selectors === 'style, link') watchedRootScans += 1;
        return originalQuerySelectorAll(selectors);
      },
    });
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    try {
      connect();
      const baselineScans = watchedRootScans;
      unrelatedRoot.adoptedStyleSheets = [new CSSStyleSheet()];
      await aTimeout(0);
      expect(calls).to.equal(0);
      expect(watchedRootScans).to.equal(baselineScans);

      watchedRoot.adoptedStyleSheets = [new CSSStyleSheet()];
      await aTimeout(0);
      expect(calls).to.equal(1);
      expect(watchedRootScans).to.be.greaterThan(baselineScans);
    } finally {
      disconnect();
      watchedRoot.adoptedStyleSheets = watchedSheets;
      unrelatedRoot.adoptedStyleSheets = unrelatedSheets;
      unrelatedHost.remove();
      delete (watchedRoot as unknown as Record<string, unknown>)
        .querySelectorAll;
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

  it('ignores inline declaration writes outside the watched host ancestry', async () => {
    const { host, connect, disconnect } = await makeHost();
    const unrelated = document.body.appendChild(document.createElement('div'));
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    try {
      connect();
      unrelated.style.setProperty('--lr-theme-test', 'unrelated');
      await aTimeout(0);
      expect(calls).to.equal(0);

      host.style.setProperty('--lr-theme-test', 'host');
      await aTimeout(0);
      expect(calls).to.equal(1);
    } finally {
      unrelated.remove();
      disconnect();
    }
  });

  it('ignores an unadopted constructed stylesheet until it can affect the watched root', async () => {
    const { host, connect, disconnect } = await makeHost();
    const originalSheets = document.adoptedStyleSheets;
    const sheet = new CSSStyleSheet();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    try {
      connect();
      sheet.replaceSync(':root { --lr-theme-test: red; }');
      await aTimeout(0);
      expect(calls).to.equal(0);

      document.adoptedStyleSheets = [...originalSheets, sheet];
      await aTimeout(0);
      expect(calls).to.equal(1);
      calls = 0;

      (sheet.cssRules[0] as CSSStyleRule).style.setProperty('--lr-theme-test', 'blue');
      await aTimeout(0);
      expect(calls).to.equal(1);
    } finally {
      document.adoptedStyleSheets = originalSheets;
      disconnect();
    }
  });

  it('ignores CSSOM writes in a sibling shadow tree that cannot style the host', async () => {
    const { host, connect, disconnect } = await makeHost();
    const sibling = document.body.appendChild(document.createElement('div'));
    const siblingRoot = sibling.attachShadow({ mode: 'open' });
    const style = siblingRoot.appendChild(document.createElement('style'));
    style.textContent = ':host { --lr-theme-test: red; }';
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    try {
      connect();
      (style.sheet!.cssRules[0] as CSSStyleRule).style.setProperty(
        '--lr-theme-test',
        'blue',
      );
      await aTimeout(0);
      expect(calls).to.equal(0);
    } finally {
      sibling.remove();
      disconnect();
    }
  });

  it('reacts to inline custom-property writes on the host assigned slot', async () => {
    const { host, connect, disconnect } = await makeHost();
    const shell = document.body.appendChild(document.createElement('div'));
    const root = shell.attachShadow({ mode: 'open' });
    const slot = root.appendChild(document.createElement('slot'));
    shell.append(host);
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    try {
      connect();
      expect(host.assignedSlot).to.equal(slot);
      slot.style.setProperty('--lr-theme-test', 'slotted');
      await aTimeout(0);
      expect(calls).to.equal(1);
      expect(getComputedStyle(host).getPropertyValue('--lr-theme-test').trim()).to.equal('slotted');
    } finally {
      disconnect();
      shell.remove();
    }
  });

  it("reacts to CSSOM writes in the watched host's own :host stylesheet", async () => {
    const { host, connect, disconnect } = await makeHost();
    const root = host.attachShadow({ mode: 'open' });
    const style = root.appendChild(document.createElement('style'));
    style.textContent = ':host { --lr-theme-test: initial; }';
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    try {
      connect();
      (style.sheet!.cssRules[0] as CSSStyleRule).style.setProperty(
        '--lr-theme-test',
        'updated',
      );
      await aTimeout(0);
      expect(calls).to.equal(1);
      expect(getComputedStyle(host).getPropertyValue('--lr-theme-test').trim()).to.equal('updated');
    } finally {
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

  it('replaces a stylesheet media-query subscription without retaining the stale listener', async () => {
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
    const style = document.createElement('style');
    style.media = '(min-width: 640px)';
    style.textContent = ':root {}';
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    try {
      connect();
      document.head.append(style);
      await aTimeout(0);

      const initialCallbacks = listeners.get('(min-width: 640px)');
      expect(initialCallbacks?.size).to.equal(1);
      calls = 0;
      initialCallbacks?.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
      await aTimeout(0);
      expect(calls).to.equal(1);

      style.media = '(min-width: 720px)';
      await aTimeout(0);
      expect(initialCallbacks?.size, 'the old MediaQueryList must be detached').to.equal(0);
      const replacementCallbacks = listeners.get('(min-width: 720px)');
      expect(replacementCallbacks?.size).to.equal(1);

      calls = 0;
      replacementCallbacks?.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
      await aTimeout(0);
      expect(calls).to.equal(1);

      disconnect();
      expect(replacementCallbacks?.size, 'the current MediaQueryList is also released').to.equal(0);
    } finally {
      style.remove();
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

  it('preserves an async CSSStyleSheet method return value and a deferred rejection', async () => {
    const original = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'replace')!;
    const expectedError = new Error('replace failed');
    let rejectReplace!: (reason: unknown) => void;
    const expectedPromise = new Promise<CSSStyleSheet>((_resolve, reject) => {
      rejectReplace = reject;
    });
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
      const rejection = returned.then(
        () => undefined,
        (error) => error,
      );
      rejectReplace(expectedError);
      expect(await rejection).to.equal(expectedError);
      await aTimeout(0);
      expect(calls).to.equal(0);
    } finally {
      disconnect();
      Object.defineProperty(CSSStyleSheet.prototype, 'replace', original);
    }
  });

  it('shares one realm patch across separately evaluated ThemeWatcher modules', async () => {
    const copyA = await import('../../dist/internal/theme-watcher.js?realm-copy=a');
    const copyB = await import('../../dist/internal/theme-watcher.js?realm-copy=b');
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

  it('invalidateLyraTheme no-ops for a root whose document has no defaultView', () => {
    // Documents minted via DOMImplementation (rather than by the browser navigating a browsing
    // context) are never associated with a window, so realmFor() resolves them to `undefined`.
    const detachedDocument = document.implementation.createHTMLDocument('detached');
    const detachedElement = detachedDocument.body.appendChild(detachedDocument.createElement('div'));
    expect(detachedDocument.defaultView).to.equal(null);
    expect(() => invalidateLyraTheme(detachedDocument)).to.not.throw();
    expect(() => invalidateLyraTheme(detachedElement)).to.not.throw();
  });

  it('does nothing when connecting a host owned by a defaultView-less document', () => {
    const detachedDocument = document.implementation.createHTMLDocument('detached');
    const detachedHost = detachedDocument.body.appendChild(detachedDocument.createElement('div'));
    const controllers: ReactiveController[] = [];
    const host = Object.assign(detachedHost, {
      addController(c: ReactiveController) {
        controllers.push(c);
      },
      removeController() {},
      requestUpdate() {},
      updateComplete: Promise.resolve(true),
    }) as unknown as ReactiveControllerHost & Element;
    new ThemeWatcher(host, () => {});
    expect(() => controllers.forEach((c) => c.hostConnected?.())).to.not.throw();
    expect(() => controllers.forEach((c) => c.hostDisconnected?.())).to.not.throw();
  });

  it('skips media-query refresh when matchMedia is unavailable (defensive branch)', async () => {
    const { host, connect, disconnect } = await makeHost();
    const original = window.matchMedia;
    // @ts-expect-error -- deliberately removing the global to exercise the fallback
    delete window.matchMedia;
    try {
      new ThemeWatcher(host, () => {});
      expect(() => connect()).to.not.throw();
    } finally {
      window.matchMedia = original;
      disconnect();
    }
  });

  it('is a no-op when installRealmInstrumentation runs against an already-installed hub', async () => {
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow as Window;
    const watched = await makeHost(frameDocument);
    new ThemeWatcher(watched.host, () => {});
    watched.connect();
    const hub = hubForRealm(frameWindow);
    expect(hub.installed).to.be.true;
    expect(hub.patches.length).to.be.greaterThan(0);
    watched.disconnect();
    expect(hub.installed).to.be.false;
    expect(hub.patches.length).to.equal(0);

    // Force the hub back into "installed" with no subscribers -- the only way to reach
    // installRealmInstrumentation's own idempotency guard, since subscribeRealm() only ever calls
    // it while `installed` is false.
    hub.installed = true;
    try {
      expect(() => watched.connect()).to.not.throw();
      // The guard returned before touching hub.patches, so nothing got (re)installed.
      expect(hub.patches.length).to.equal(0);
    } finally {
      watched.disconnect();
    }
  });

  it('is a no-op when uninstallRealmInstrumentation runs against a hub that was never installed', async () => {
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow as unknown as { CSSStyleSheet: { prototype: object } };
    const watched = await makeHost(frameDocument);
    new ThemeWatcher(watched.host, () => {});
    watched.connect();
    const hub = hubForRealm(frameWindow as unknown as Window);
    expect(hub.installed).to.be.true;
    expect(hub.patches.length).to.be.greaterThan(0);
    const patchedInsertRule = Object.getOwnPropertyDescriptor(
      frameWindow.CSSStyleSheet.prototype,
      'insertRule',
    )?.value;

    // Force the hub to report "not installed" while a real subscriber is still connected -- the
    // only way to reach uninstallRealmInstrumentation's own idempotency guard, since the sole
    // real call site only invokes it while `installed` is true.
    hub.installed = false;
    watched.disconnect();

    // The guard returned before reverting anything: the frame's CSSOM prototype is still patched
    // and the hub's bookkeeping is untouched (both would be reset by a real uninstall).
    expect(
      Object.getOwnPropertyDescriptor(frameWindow.CSSStyleSheet.prototype, 'insertRule')?.value,
    ).to.equal(patchedInsertRule);
    expect(hub.installed).to.be.false;
    expect(hub.patches.length).to.be.greaterThan(0);
  });

  it('is a no-op when the subscribeRealm unsubscribe closure runs twice', async () => {
    const { host, connect, disconnect } = await makeHost();
    let calls = 0;
    const watcher = new ThemeWatcher(host, () => calls++);
    connect();
    const unsubscribeRealm = (watcher as unknown as { unsubscribeRealm?: () => void }).unsubscribeRealm;
    expect(unsubscribeRealm).to.be.a('function');
    expect(() => {
      unsubscribeRealm!();
      unsubscribeRealm!();
    }).to.not.throw();
    disconnect();
    host.setAttribute('data-theme', 'a');
    await aTimeout(0);
    expect(calls).to.equal(0);
  });

  it('skips a root without a documentElement when installing the MutationObserver', async () => {
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow as Window & typeof globalThis;
    frameDocument.documentElement?.remove();
    expect(frameDocument.documentElement).to.equal(null);

    const detachedHost = frameDocument.createElement('div');
    const controllers: ReactiveController[] = [];
    const host = Object.assign(detachedHost, {
      addController(c: ReactiveController) {
        controllers.push(c);
      },
      removeController() {},
      requestUpdate() {},
      updateComplete: Promise.resolve(true),
    }) as unknown as ReactiveControllerHost & Element;

    let observeCalls = 0;
    const originalObserve = frameWindow.MutationObserver.prototype.observe;
    frameWindow.MutationObserver.prototype.observe = function (
      this: MutationObserver,
      target: Node,
      options?: MutationObserverInit,
    ): void {
      observeCalls += 1;
      originalObserve.call(this, target, options);
    };
    new ThemeWatcher(host, () => {});
    try {
      expect(() => controllers.forEach((c) => c.hostConnected?.())).to.not.throw();
      // The only root is the stripped document, whose `documentElement` is null -- installObserver
      // must `continue` past it rather than calling observe() with a null target.
      expect(observeCalls).to.equal(0);
    } finally {
      controllers.forEach((c) => c.hostDisconnected?.());
      frameWindow.MutationObserver.prototype.observe = originalObserve;
    }
  });

  it('does not throw when Document/ShadowRoot prototypes are absent or lack adoptedStyleSheets', async () => {
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow as unknown as Record<string, unknown>;
    const originalShadowRoot = frameWindow.ShadowRoot;
    const originalDocumentCtor = frameWindow.Document;
    frameWindow.ShadowRoot = undefined; // patchAdoptedStyleSheets: `!prototype` guard
    frameWindow.Document = { prototype: Object.create(null) }; // patchAdoptedStyleSheets: `!target` guard
    const watched = await makeHost(frameDocument);
    new ThemeWatcher(watched.host, () => {});
    try {
      expect(() => watched.connect()).to.not.throw();
    } finally {
      watched.disconnect();
      frameWindow.ShadowRoot = originalShadowRoot;
      frameWindow.Document = originalDocumentCtor;
    }
  });

  it('does not throw when a style-related target property exists without a setter', async () => {
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow as unknown as Record<string, unknown>;
    const originalDocumentCtor = frameWindow.Document;
    const originalMediaList = frameWindow.MediaList;
    const fakeDocumentProto: Record<string, unknown> = {};
    Object.defineProperty(fakeDocumentProto, 'adoptedStyleSheets', {
      value: [],
      writable: true,
      configurable: true,
    }); // data property, no setter -> patchAdoptedStyleSheets' `!original?.set` guard
    frameWindow.Document = { prototype: fakeDocumentProto };
    const fakeMediaListProto: Record<string, unknown> = {};
    Object.defineProperty(fakeMediaListProto, 'mediaText', {
      value: '',
      writable: true,
      configurable: true,
    }); // data property, no setter -> patchSetter's `!original?.set` guard
    frameWindow.MediaList = { prototype: fakeMediaListProto };
    const watched = await makeHost(frameDocument);
    new ThemeWatcher(watched.host, () => {});
    try {
      expect(() => watched.connect()).to.not.throw();
    } finally {
      watched.disconnect();
      frameWindow.Document = originalDocumentCtor;
      frameWindow.MediaList = originalMediaList;
    }
  });

  it('discovers a stylesheet nested inside a shadow root and registers its media query', async () => {
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

    const shadowHost = document.createElement('div');
    document.body.append(shadowHost);
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
    const hostEl = shadowRoot.appendChild(document.createElement('span'));
    const controllers: ReactiveController[] = [];
    const host = Object.assign(hostEl, {
      addController(c: ReactiveController) {
        controllers.push(c);
      },
      removeController() {},
      requestUpdate() {},
      updateComplete: Promise.resolve(true),
    }) as unknown as ReactiveControllerHost & Element;

    const style = document.createElement('style');
    style.media = '(min-width: 400px)';
    style.textContent = ':root {}';
    shadowRoot.appendChild(style);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    shadowRoot.appendChild(link);

    new ThemeWatcher(host, () => {});
    try {
      controllers.forEach((c) => c.hostConnected?.());
      // sheetsForRoot's ShadowRoot branch (querySelectorAll('style, link')) is the only way this
      // shadow-scoped <style>'s media query could have been discovered: shadow-root stylesheets
      // never appear in Document.styleSheets.
      expect(listeners.get('(min-width: 400px)')?.size).to.equal(1);
    } finally {
      controllers.forEach((c) => c.hostDisconnected?.());
      shadowHost.remove();
      window.matchMedia = originalMatchMedia;
    }
  });

  it('removes a stale media-query listener once a later refreshMediaQueries pass drops it', async () => {
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
    const style = document.createElement('style');
    style.media = '(min-width: 400px)';
    style.textContent = ':root {}';
    document.head.append(style);
    new ThemeWatcher(host, () => {});
    try {
      connect();
      await aTimeout(0);
      const staleCallbacks = listeners.get('(min-width: 400px)');
      expect(staleCallbacks?.size).to.equal(1);

      style.removeAttribute('media');
      await aTimeout(0);
      expect(staleCallbacks?.size).to.equal(0);
    } finally {
      style.remove();
      disconnect();
      window.matchMedia = originalMatchMedia;
    }
  });

  it('reacts to a load event dispatched at a stylesheet <link>', async () => {
    // A real network/data-URL load races the MutationObserver's own insertion-triggered call (both
    // fire within the same coalescing window), which would make a bare `calls` counter unable to
    // attribute the increment specifically to onStylesheetLoad rather than onMutations. Dispatching
    // a synthetic 'load' event once the insertion-triggered call has already settled isolates the
    // handler's own guard (`isStyleCarrier(target) && target.localName === 'link'`) deterministically.
    const { host, connect, disconnect } = await makeHost();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    document.head.append(link);
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    try {
      connect();
      await aTimeout(0);
      calls = 0;
      link.dispatchEvent(new Event('load'));
      await aTimeout(0);
      expect(calls).to.equal(1);
    } finally {
      link.remove();
      disconnect();
    }
  });

  it('replaces a malformed pre-existing hub value at the shared registry key with a fresh valid hub', async () => {
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow as Window;
    // A configurable, ordinarily-assigned value (unlike the frozen-null case below) at the
    // well-known key -- shaped nothing like a real hub, so hubFor()'s shape validation must
    // reject adopting it and overwrite it with a freshly created one instead.
    (frameWindow as unknown as Record<symbol, unknown>)[THEME_HUB_KEY] = { junk: true };
    const watched = await makeHost(frameDocument);
    let calls = 0;
    new ThemeWatcher(watched.host, () => calls++);
    try {
      watched.connect();
      const hub = hubForRealm(frameWindow);
      expect(hub.installed).to.be.true;
      expect(hub.patches.length).to.be.greaterThan(0);
      watched.host.setAttribute('data-theme', 'dark');
      await aTimeout(0);
      expect(calls).to.equal(1);
    } finally {
      watched.disconnect();
      iframe.remove();
    }
  });

  it('conservatively invalidates for a mutation subject whose realm constructor is unavailable', async () => {
    const { host, connect, disconnect } = await makeHost();
    let calls = 0;
    const watcher = new ThemeWatcher(host, () => calls++);
    connect();
    const realmField = watcher as unknown as { realm?: unknown };
    const originalRealm = realmField.realm;
    // None of mutationCanAffectHost's known-constructor branches can match a CSSStyleDeclaration
    // subject against a realm reference this bare -- the conservative "unknown platform object"
    // fallback must still invalidate rather than silently dropping the mutation.
    realmField.realm = {};
    try {
      host.style.setProperty('--lr-theme-test', 'value');
      await aTimeout(0);
      expect(calls).to.equal(1);
    } finally {
      realmField.realm = originalRealm;
      disconnect();
    }
  });

  it('drops a change queued before a disconnect/reconnect cycle instead of firing against a stale generation', async () => {
    const { host, connect, disconnect } = await makeHost();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    connect();
    // invalidateLyraTheme() synchronously calls queueChange(), which captures the *current*
    // generation and schedules a microtask before either disconnect() or the following connect()
    // below has a chance to run.
    invalidateLyraTheme(document);
    disconnect();
    connect();
    await aTimeout(0);
    // The microtask queued against the old generation must not fire onChange after the reconnect
    // bumped the generation twice (once on disconnect, once on connect).
    expect(calls).to.equal(0);
    disconnect();
  });

  it('keeps explicit invalidation working when a realm cannot store its shared hub', async () => {
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow as Window;
    // An embedder may have made this shared registry slot immutable before Lyra loads. The
    // public invalidation API must still find the fallback hub created for that realm.
    Object.defineProperty(frameWindow, THEME_HUB_KEY, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: null,
    });
    const watched = await makeHost(frameDocument);
    let calls = 0;
    new ThemeWatcher(watched.host, () => calls++);
    try {
      watched.connect();
      invalidateLyraTheme(frameDocument);
      await aTimeout(0);
      expect(calls).to.equal(1);
    } finally {
      watched.disconnect();
      iframe.remove();
    }
  });

  it('keeps DOM theme observation available when a realm locks CSSOM descriptors', async () => {
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow as Window & typeof globalThis;
    const locks = [
      [frameWindow.CSSStyleSheet.prototype, 'insertRule'],
      [frameWindow.CSSStyleDeclaration.prototype, 'setProperty'],
    ] as const;
    for (const [target, key] of locks) {
      const descriptor = Object.getOwnPropertyDescriptor(target, key)!;
      Object.defineProperty(target, key, { ...descriptor, configurable: false, writable: false });
    }
    const adoptedStyleSheets = Object.getOwnPropertyDescriptor(
      frameWindow.Document.prototype,
      'adoptedStyleSheets',
    );
    if (adoptedStyleSheets?.configurable) {
      Object.defineProperty(frameWindow.Document.prototype, 'adoptedStyleSheets', {
        ...adoptedStyleSheets,
        configurable: false,
      });
    }

    const watched = await makeHost(frameDocument);
    let calls = 0;
    new ThemeWatcher(watched.host, () => calls++);
    try {
      watched.connect();
      watched.host.setAttribute('data-theme', 'locked-realm');
      await aTimeout(0);
      expect(calls).to.equal(1);
    } finally {
      watched.disconnect();
      // The locked descriptors belong only to this disposable iframe realm.
      iframe.remove();
    }
  });

  it('preserves a later CSSOM integration while its watcher disconnects', async () => {
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const stylesheetPrototype = (
      iframe.contentWindow as Window & typeof globalThis
    ).CSSStyleSheet.prototype;
    const original = Object.getOwnPropertyDescriptor(stylesheetPrototype, 'insertRule')!;
    const watched = await makeHost(frameDocument);
    new ThemeWatcher(watched.host, () => {});
    const replacement = () => 0;
    try {
      watched.connect();
      const patched = Object.getOwnPropertyDescriptor(stylesheetPrototype, 'insertRule')!;
      Object.defineProperty(stylesheetPrototype, 'insertRule', { ...patched, value: replacement });
      watched.disconnect();
      expect(Object.getOwnPropertyDescriptor(stylesheetPrototype, 'insertRule')?.value).to.equal(replacement);
    } finally {
      watched.disconnect();
      Object.defineProperty(stylesheetPrototype, 'insertRule', original);
      iframe.remove();
    }
  });

  it('reacts to a browser media-query change event', async () => {
    const originalMatchMedia = window.matchMedia;
    const events = new Map<string, EventTarget>();
    window.matchMedia = ((query: string) => {
      const target = new EventTarget();
      events.set(query, target);
      return {
        media: query,
        matches: false,
        onchange: null,
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
        addListener() {},
        removeListener() {},
        dispatchEvent: target.dispatchEvent.bind(target),
      } as unknown as MediaQueryList;
    }) as typeof matchMedia;
    const { host, connect, disconnect } = await makeHost();
    let calls = 0;
    new ThemeWatcher(host, () => calls++);
    try {
      connect();
      events.get('(prefers-color-scheme: dark)')?.dispatchEvent(new Event('change'));
      await aTimeout(0);
      expect(calls).to.equal(1);

      disconnect();
      events.get('(prefers-color-scheme: dark)')?.dispatchEvent(new Event('change'));
      await aTimeout(0);
      expect(calls).to.equal(1);
    } finally {
      disconnect();
      window.matchMedia = originalMatchMedia;
    }
  });
});
