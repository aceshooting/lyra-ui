import { expect, fixture, html, aTimeout } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { ThemeWatcher } from './theme-watcher.js';

/** A minimal ReactiveControllerHost backed by a real element, capturing the controller the
 *  ThemeWatcher registers so tests can drive its lifecycle hooks directly. */
async function makeHost(): Promise<{
  host: ReactiveControllerHost & Element;
  connect(): void;
  disconnect(): void;
}> {
  const el = (await fixture(html`<div></div>`)) as HTMLElement;
  const controllers: ReactiveController[] = [];
  const host = Object.assign(el, {
    addController(c: ReactiveController) {
      controllers.push(c);
    },
    removeController() {},
    requestUpdate() {},
    updateComplete: Promise.resolve(true),
  }) as unknown as ReactiveControllerHost & Element;
  return {
    host,
    connect: () => controllers.forEach((c) => c.hostConnected?.()),
    disconnect: () => controllers.forEach((c) => c.hostDisconnected?.()),
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
    parent.setAttribute('data-theme', 'dark');
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
});
