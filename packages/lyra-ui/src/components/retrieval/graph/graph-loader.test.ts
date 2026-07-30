import { expect } from '@open-wc/testing';
import { loadD3, loadD3Modules } from './graph-loader.js';

it('resolves the d3 modules', async () => {
  const mods = await loadD3();
  expect(mods).to.not.be.null;
  expect(mods!.forceSimulation).to.exist;
  expect(mods!.drag).to.exist;
  expect(mods!.zoom).to.exist;
  expect(mods!.select).to.exist;
});

it('caches the module — a second call returns the same promise result', async () => {
  const a = loadD3();
  const b = loadD3();
  expect(a).to.equal(b);
});

it('exposes zoomIdentity and zoomTransform for programmatic camera control (focusNode/fit)', async () => {
  const mods = await loadD3();
  expect(mods!.zoomIdentity).to.exist;
  expect(mods!.zoomTransform).to.exist;
});

describe('loadD3Modules (uncached, dependency-injectable)', () => {
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
    const identity = {
      translate(): typeof identity {
        return this;
      },
      scale(): typeof identity {
        return this;
      },
    };
    const valid = {
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
