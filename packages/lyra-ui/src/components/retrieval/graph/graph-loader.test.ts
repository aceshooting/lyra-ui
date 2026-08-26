import { expect } from '@open-wc/testing';
import { loadD3, loadD3Modules, type D3ZoomTransform } from './graph-loader.js';

function createD3PeerApis() {
  const identity: D3ZoomTransform = {
    k: 1,
    x: 0,
    y: 0,
    translate(): typeof identity {
      return this;
    },
    scale(): typeof identity {
      return this;
    },
    toString: () => 'translate(0,0) scale(1)',
  };

  return {
    force: {
      forceSimulation: () => ({}),
      forceLink: () => ({}),
      forceManyBody: () => ({}),
      forceCenter: () => ({}),
      forceCollide: () => ({}),
    },
    drag: { drag: () => ({}) },
    zoom: {
      zoom: () => ({}),
      zoomIdentity: identity,
      zoomTransform: () => identity,
    },
    selection: { select: () => ({}) },
  };
}

it('resolves the d3 modules', async () => {
  const mods = await loadD3();
  expect(mods).to.not.be.null;
  expect((mods!.forceSimulation) != null).to.equal(true);
  expect((mods!.drag) != null).to.equal(true);
  expect((mods!.zoom) != null).to.equal(true);
  expect((mods!.select) != null).to.equal(true);
});

it('caches the module — a second call returns the same promise result', async () => {
  const a = loadD3();
  const b = loadD3();
  expect(a).to.equal(b);
});

it('exposes zoomIdentity and zoomTransform for programmatic camera control (focusNode/fit)', async () => {
  const mods = await loadD3();
  expect(mods!.zoomIdentity).to.exist;
  expect((mods!.zoomTransform) != null).to.equal(true);
});

describe('loadD3Modules (uncached, dependency-injectable)', () => {
  it('resolves all four D3 APIs from default-wrapped module namespaces', async () => {
    const peers = createD3PeerApis();

    const modules = await loadD3Modules(
      () => Promise.resolve({ default: peers.force }),
      () => Promise.resolve({ default: peers.drag }),
      () => Promise.resolve({ default: peers.zoom }),
      () => Promise.resolve({ default: peers.selection }),
    );

    expect(modules).to.not.equal(null);
    expect(Object.is(modules!.forceSimulation, peers.force.forceSimulation)).to.equal(true);
    expect((modules!.drag) === (peers.drag.drag)).to.equal(true);
    expect((modules!.zoom) === (peers.zoom.zoom)).to.equal(true);
    expect(modules!.zoomIdentity).to.equal(peers.zoom.zoomIdentity);
    expect((modules!.zoomTransform) === (peers.zoom.zoomTransform)).to.equal(true);
    expect(Object.is(modules!.select, peers.selection.select)).to.equal(true);
  });

  it('prefers usable D3 APIs on module namespaces over their default exports', async () => {
    const direct = createD3PeerApis();
    const fallback = createD3PeerApis();

    const modules = await loadD3Modules(
      () => Promise.resolve({ ...direct.force, default: fallback.force }),
      () => Promise.resolve({ ...direct.drag, default: fallback.drag }),
      () => Promise.resolve({ ...direct.zoom, default: fallback.zoom }),
      () => Promise.resolve({ ...direct.selection, default: fallback.selection }),
    );

    expect(modules).to.not.equal(null);
    expect(Object.is(modules!.forceSimulation, direct.force.forceSimulation)).to.equal(true);
    expect((modules!.drag) === (direct.drag.drag)).to.equal(true);
    expect((modules!.zoom) === (direct.zoom.zoom)).to.equal(true);
    expect(Object.is(modules!.select, direct.selection.select)).to.equal(true);
  });

  it('accepts a callable peer namespace when it also exposes the required APIs', async () => {
    const peers = createD3PeerApis();
    const callableForce = Object.assign(() => undefined, peers.force);

    const modules = await loadD3Modules(
      () => Promise.resolve(callableForce),
      () => Promise.resolve(peers.drag),
      () => Promise.resolve(peers.zoom),
      () => Promise.resolve(peers.selection),
    );

    expect(modules).to.not.equal(null);
    expect(Object.is(modules!.forceSimulation, peers.force.forceSimulation)).to.equal(true);
  });

  it('fails closed when a default-wrapped D3 peer lacks a required API', async () => {
    const peers = createD3PeerApis();
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const modules = await loadD3Modules(
        () => Promise.resolve({ default: peers.force }),
        () => Promise.resolve({ default: peers.drag }),
        () => Promise.resolve({ default: peers.zoom }),
        () => Promise.resolve({ default: { select: 'not callable' } }),
      );

      expect(modules).to.equal(null);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('reports the exact missing callable capability', async () => {
    const peers = createD3PeerApis();
    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      const modules = await loadD3Modules(
        () => Promise.resolve(peers.force),
        () => Promise.resolve(peers.drag),
        () => Promise.resolve(peers.zoom),
        () => Promise.resolve({}),
      );

      expect(modules).to.equal(null);
      const error = warnings.flat().find((value) => value instanceof TypeError);
      expect((error as TypeError).message).to.include('select()');
    } finally {
      console.warn = originalWarn;
    }
  });

  it('resolves null when any one of the four peer dependencies fails to load', async () => {
    const err = new Error('d3-force boom');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      const mods = await loadD3Modules(
        () => Promise.reject(err),
        () => import('d3-drag'),
        () => import('d3-zoom'),
        () => import('d3-selection'),
      );
      expect(mods).to.equal(null);
      expect(calls.flat()).to.contain(err);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('logs the real caught error (not a generic message) on failure', async () => {
    const err = new Error('specific d3 failure reason');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      await loadD3Modules(
        () => Promise.reject(err),
        () => import('d3-drag'),
        () => import('d3-zoom'),
        () => import('d3-selection'),
      );
    } finally {
      console.warn = originalWarn;
    }
    const loggedArgs = calls.flat();
    expect(loggedArgs).to.contain(err);
  });

  it('fails closed when resolved peer modules omit a required callable capability', async () => {
    const valid = createD3PeerApis();
    const malformed = [
      { ...valid, force: { ...valid.force, forceSimulation: undefined } },
      { ...valid, drag: { drag: 'not callable' } },
      { ...valid, zoom: { ...valid.zoom, zoomTransform: undefined } },
      { ...valid, selection: { select: null } },
    ];
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      for (const peers of malformed) {
        const result = await loadD3Modules(
          async () => peers.force,
          async () => peers.drag,
          async () => peers.zoom,
          async () => peers.selection,
        );
        expect(result === null).to.be.true;
      }
    } finally {
      console.warn = originalWarn;
    }
  });
});
