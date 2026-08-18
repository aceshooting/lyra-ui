import { expect } from '@open-wc/testing';
import {
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
