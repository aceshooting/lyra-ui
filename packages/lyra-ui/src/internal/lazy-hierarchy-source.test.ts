import { expect } from '@open-wc/testing';
import * as controller from './hierarchy-source-controller.js';
import * as view from './hierarchy-source-view.js';
import * as summary from './hierarchy-summary-source.js';
import {
  __resetHierarchySourceRuntimeForTesting,
  HierarchySourceRuntimeGate,
  loadHierarchySourceRuntime,
} from './lazy-hierarchy-source.js';

afterEach(() => __resetHierarchySourceRuntimeForTesting());

function gateHost() {
  return { isConnected: true, ownerDocument: document, updates: 0, requestUpdate() { this.updates++; } };
}

describe('loadHierarchySourceRuntime', () => {
  it('resolves the controller, view and summary modules once and registers their elements once', async () => {
    let registrations = 0;
    const register = () => { registrations++; return Promise.resolve(); };
    const first = loadHierarchySourceRuntime(register);
    expect(loadHierarchySourceRuntime(register) === first, 'concurrent callers share the attempt').to.equal(true);
    const runtime = await first;
    expect([runtime.controller === controller, runtime.view === view, runtime.summary === summary]).to.deep.equal([true, true, true]);
    expect(Object.isFrozen(runtime)).to.equal(true);
    expect(await loadHierarchySourceRuntime(() => Promise.reject(new Error('unused'))) === runtime).to.equal(true);
    expect(registrations).to.equal(1);
  });

  it('forgets a rejected registration so the next request retries', async () => {
    const failed = loadHierarchySourceRuntime(() => Promise.reject(new Error('chunk unavailable')));
    expect(await failed.then(() => 'loaded', () => 'rejected')).to.equal('rejected');
    const thrown = loadHierarchySourceRuntime(() => { throw new Error('registration threw'); });
    expect(await thrown.then(() => 'loaded', () => 'rejected')).to.equal('rejected');
    const runtime = await loadHierarchySourceRuntime(() => Promise.resolve());
    expect(runtime.controller === controller).to.equal(true);
  });
});

describe('HierarchySourceRuntimeGate', () => {
  it('resolves for a live binding, requests the render that uses it and then serves it synchronously', async () => {
    const host = gateHost();
    const gate = new HierarchySourceRuntimeGate(host, () => Promise.resolve());
    expect(gate.runtime === undefined).to.equal(true);
    const runtime = await gate.ensure(() => true);
    expect(runtime?.view === view).to.equal(true);
    expect(gate.runtime === runtime).to.equal(true);
    expect(host.updates).to.equal(1);
    expect(await gate.ensure(() => true) === runtime).to.equal(true);
    expect(await gate.ensure(() => false) === undefined).to.equal(true);
    host.isConnected = false;
    expect(await gate.ensure(() => true) === undefined).to.equal(true);
    expect(host.updates).to.equal(1);
  });

  it('drops a load superseded by a new binding, a disconnect or an adoption, and retries a failed one', async () => {
    for (const lose of ['rebound', 'disconnected', 'adopted'] as const) {
      __resetHierarchySourceRuntimeForTesting();
      const host = gateHost();
      let bound = true;
      const gate = new HierarchySourceRuntimeGate(host, () => {
        if (lose === 'rebound') bound = false;
        if (lose === 'disconnected') host.isConnected = false;
        if (lose === 'adopted') host.ownerDocument = document.implementation.createHTMLDocument();
        return Promise.resolve();
      });
      expect(await gate.ensure(() => bound) === undefined, lose).to.equal(true);
      expect(host.updates, lose).to.equal(0);
      expect(gate.runtime !== undefined, `${lose} still caches the loaded runtime`).to.equal(true);
    }
    __resetHierarchySourceRuntimeForTesting();
    const host = gateHost();
    let attempts = 0;
    const gate = new HierarchySourceRuntimeGate(host, () => ++attempts === 1 ? Promise.reject(new Error('offline')) : Promise.resolve());
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message: unknown) => { warnings.push(String(message)); };
    try {
      expect(await gate.ensure(() => true) === undefined).to.equal(true);
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings.length, 'a failed load leaves a development diagnostic').to.equal(1);
    expect(gate.runtime === undefined).to.equal(true);
    expect((await gate.ensure(() => true))?.summary === summary).to.equal(true);
    expect(attempts).to.equal(2);
  });
});
