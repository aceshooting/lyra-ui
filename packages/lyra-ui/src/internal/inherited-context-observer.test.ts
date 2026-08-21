import { expect } from '@open-wc/testing';
import {
  beginInheritedContextUpdate,
  finishInheritedContextUpdate,
  observeInheritedContext,
  queueInheritedDirectionChange,
  recordInheritedDirectionRead,
  recordInheritedLocaleRead,
} from './inherited-context-observer.js';

// This module's ordinary reconnect/adoption/hostile-accessor/coalescing paths are already
// exercised at length, indirectly, through every direction/locale-sensitive test in
// src/internal/lyra-element.test.ts (every LyraElement subclass routes through
// observeInheritedContext()/recordInheritedDirectionRead()/recordInheritedLocaleRead()). This file
// adds direct unit coverage for the branches that style of integration test does not reach: the
// bfcache-persisted pagehide branch, no-active-subscription no-ops, and shared owner-lifecycle
// listener refcounting across more than one host in the same foreign document.

interface TestHost extends Element {
  requestUpdate(): unknown;
}

function foreignHost(document: Document): TestHost {
  const host = document.createElement('div') as unknown as TestHost;
  host.requestUpdate = () => {};
  document.body.append(host);
  return host;
}

it('is a safe no-op for a host that was never enrolled in observation', () => {
  const host = document.createElement('div');
  expect(() => queueInheritedDirectionChange(host)).not.to.throw();
  expect(() => recordInheritedDirectionRead(host, 'ltr')).not.to.throw();
  expect(() => recordInheritedLocaleRead(host, 'en')).not.to.throw();
});

it('ignores a persisted bfcache pagehide but releases the observer on a real unload pagehide', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const foreignWindow = frame.contentWindow!;
    const foreignDocument = frame.contentDocument!;
    const NativeMutationObserver = foreignWindow.MutationObserver;
    let disconnects = 0;
    class TrackingMutationObserver extends NativeMutationObserver {
      override disconnect(): void {
        disconnects += 1;
        super.disconnect();
      }
    }
    Object.defineProperty(foreignWindow, 'MutationObserver', {
      configurable: true,
      value: TrackingMutationObserver,
    });

    const host = foreignHost(foreignDocument);
    observeInheritedContext(host);
    recordInheritedDirectionRead(host, 'ltr');

    foreignWindow.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    expect(disconnects, 'a bfcache-persisted pagehide must not release the observer').to.equal(0);

    foreignWindow.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    expect(disconnects, 'a real unload pagehide must release the observer').to.equal(1);
  } finally {
    frame.remove();
  }
});

it('shares one pagehide listener across hosts in the same owner document and only removes it after the last unsubscribes', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const foreignWindow = frame.contentWindow!;
    const foreignDocument = frame.contentDocument!;
    let addCalls = 0;
    let removeCalls = 0;
    const originalAdd = foreignWindow.addEventListener.bind(foreignWindow);
    const originalRemove = foreignWindow.removeEventListener.bind(foreignWindow);
    foreignWindow.addEventListener = ((type: string, ...rest: unknown[]) => {
      if (type === 'pagehide') addCalls += 1;
      return (originalAdd as (...args: unknown[]) => void)(type, ...rest);
    }) as typeof foreignWindow.addEventListener;
    foreignWindow.removeEventListener = ((type: string, ...rest: unknown[]) => {
      if (type === 'pagehide') removeCalls += 1;
      return (originalRemove as (...args: unknown[]) => void)(type, ...rest);
    }) as typeof foreignWindow.removeEventListener;

    const hostA = foreignHost(foreignDocument);
    const hostB = foreignHost(foreignDocument);
    const stopA = observeInheritedContext(hostA);
    recordInheritedDirectionRead(hostA, 'ltr');
    const stopB = observeInheritedContext(hostB);
    recordInheritedDirectionRead(hostB, 'ltr');

    expect(addCalls).to.equal(1);
    stopA();
    expect(removeCalls, 'the second host still needs the shared listener').to.equal(0);
    stopB();
    expect(removeCalls, 'the last host releases the shared listener').to.equal(1);
  } finally {
    frame.remove();
  }
});

it('rolls back document and prospective-slot observations when shadow-root setup fails', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const foreignWindow = frame.contentWindow!;
  const foreignDocument = frame.contentDocument!;
  const originalObserver = foreignWindow.MutationObserver;
  const shell = foreignDocument.body.appendChild(foreignDocument.createElement('div'));
  const root = shell.attachShadow({ mode: 'open' });
  const host = foreignHost(foreignDocument);
  shell.append(host);
  const originalAdd = root.addEventListener;
  const originalRemove = root.removeEventListener;
  let disconnects = 0;

  class HostileMutationObserver implements MutationObserver {
    disconnect(): void {
      disconnects += 1;
      throw new Error('disconnect unavailable');
    }
    observe(): void {}
    takeRecords(): MutationRecord[] {
      return [];
    }
  }

  try {
    Object.defineProperty(foreignWindow, 'MutationObserver', {
      configurable: true,
      value: HostileMutationObserver,
    });
    root.addEventListener = (() => {
      throw new Error('listener unavailable');
    }) as typeof root.addEventListener;
    root.removeEventListener = (() => {
      throw new Error('listener cleanup unavailable');
    }) as typeof root.removeEventListener;

    const stop = observeInheritedContext(host);
    expect(() => recordInheritedDirectionRead(host, 'ltr')).not.to.throw();
    expect(disconnects).to.equal(2);
    stop();
  } finally {
    root.addEventListener = originalAdd;
    root.removeEventListener = originalRemove;
    Object.defineProperty(foreignWindow, 'MutationObserver', {
      configurable: true,
      value: originalObserver,
    });
    frame.remove();
  }
});

it('contains owner pagehide listener installation and removal failures', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const foreignWindow = frame.contentWindow!;
  const foreignDocument = frame.contentDocument!;
  const originalAdd = foreignWindow.addEventListener;
  const originalRemove = foreignWindow.removeEventListener;
  try {
    foreignWindow.addEventListener = ((type: string, ...rest: unknown[]) => {
      if (type === 'pagehide') throw new Error('pagehide install unavailable');
      return (originalAdd as (...args: unknown[]) => void).call(foreignWindow, type, ...rest);
    }) as typeof foreignWindow.addEventListener;
    const installHost = foreignHost(foreignDocument);
    const stopInstall = observeInheritedContext(installHost);
    expect(() => recordInheritedDirectionRead(installHost, 'ltr')).not.to.throw();
    stopInstall();

    foreignWindow.addEventListener = originalAdd;
    const removalHost = foreignHost(foreignDocument);
    const stopRemoval = observeInheritedContext(removalHost);
    recordInheritedDirectionRead(removalHost, 'ltr');
    foreignWindow.removeEventListener = ((type: string, ...rest: unknown[]) => {
      if (type === 'pagehide') throw new Error('pagehide cleanup unavailable');
      return (originalRemove as (...args: unknown[]) => void).call(foreignWindow, type, ...rest);
    }) as typeof foreignWindow.removeEventListener;
    expect(() => stopRemoval()).not.to.throw();
  } finally {
    foreignWindow.addEventListener = originalAdd;
    foreignWindow.removeEventListener = originalRemove;
    frame.remove();
  }
});

it('contains hostile locale and direction resolution during observer delivery', async () => {
  const wrapper = document.body.appendChild(document.createElement('div'));
  const host = foreignHost(document);
  wrapper.append(host);
  let updates = 0;
  host.requestUpdate = () => updates++;
  const stop = observeInheritedContext(host);
  recordInheritedLocaleRead(host, 'en');
  recordInheritedDirectionRead(host, 'ltr');
  const originalGetAttribute = host.getAttribute;
  try {
    wrapper.setAttribute('lang', 'fr');
    host.getAttribute = () => {
      throw new Error('attribute unavailable');
    };
    await Promise.resolve();
    await Promise.resolve();
    expect(updates).to.equal(0);
  } finally {
    host.getAttribute = originalGetAttribute;
    stop();
    wrapper.remove();
  }
});

it('rebinds direction observation when an unassigned light child gains a slot', async () => {
  const shell = document.body.appendChild(document.createElement('div'));
  const root = shell.attachShadow({ mode: 'open' });
  const host = foreignHost(document);
  shell.append(host);
  const stop = observeInheritedContext(host);
  try {
    recordInheritedDirectionRead(host, 'ltr');
    root.append(document.createElement('slot'));
    await Promise.resolve();
    await Promise.resolve();
    expect(host.assignedSlot).to.equal(root.querySelector('slot'));
  } finally {
    stop();
    shell.remove();
  }
});

it('replaces an active subscription and leaves both stop callbacks idempotent', () => {
  const host = foreignHost(document);
  const firstStop = observeInheritedContext(host);
  recordInheritedLocaleRead(host, 'en');
  recordInheritedDirectionRead(host, 'ltr');
  const secondStop = observeInheritedContext(host);

  expect(() => {
    firstStop();
    recordInheritedLocaleRead(host, 'en');
    recordInheritedDirectionRead(host, 'ltr');
    secondStop();
    secondStop();
  }).not.to.throw();
  host.remove();
});

it('contains slot-listener cleanup failures and handles a detached element root', () => {
  const detachedRoot = document.createElement('section');
  const detached = document.createElement('div') as unknown as TestHost;
  detached.requestUpdate = () => {};
  detachedRoot.append(detached);
  const stopDetached = observeInheritedContext(detached);
  expect(() => recordInheritedDirectionRead(detached, 'ltr')).not.to.throw();
  stopDetached();

  const shell = document.body.appendChild(document.createElement('div'));
  const root = shell.attachShadow({ mode: 'open' });
  const host = foreignHost(document);
  shell.append(host);
  const originalRemove = root.removeEventListener;
  const stop = observeInheritedContext(host);
  recordInheritedDirectionRead(host, 'ltr');
  root.removeEventListener = (() => {
    throw new Error('slot listener cleanup unavailable');
  }) as typeof root.removeEventListener;
  try {
    expect(() => stop()).not.to.throw();
  } finally {
    root.removeEventListener = originalRemove;
    shell.remove();
  }
});

it('uses the live inherited baseline after a render is aborted', async () => {
  const wrapper = document.body.appendChild(document.createElement('div'));
  const host = foreignHost(document);
  wrapper.append(host);
  let updates = 0;
  host.requestUpdate = () => updates++;
  const stop = observeInheritedContext(host);
  try {
    beginInheritedContextUpdate(host);
    recordInheritedLocaleRead(host, 'en');
    recordInheritedDirectionRead(host, 'ltr');
    finishInheritedContextUpdate(host);

    wrapper.setAttribute('lang', 'fr');
    wrapper.setAttribute('dir', 'rtl');
    await Promise.resolve();
    await Promise.resolve();
    expect(updates).to.equal(0);
  } finally {
    stop();
    wrapper.remove();
  }
});
