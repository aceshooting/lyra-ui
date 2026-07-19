import { expect } from '@open-wc/testing';
import {
  registerToolRenderer,
  getDefaultToolRendererRegistry,
  findToolRenderer,
  loadToolRenderer,
  clearToolRenderers,
  type ToolRendererDefinition,
} from './registry.js';

afterEach(() => {
  clearToolRenderers();
});

describe('registerToolRenderer / getDefaultToolRendererRegistry', () => {
  it('adds an entry to the module-level default registry', () => {
    const def: ToolRendererDefinition = { render: () => 'x' };
    registerToolRenderer('get_weather', def);
    expect(getDefaultToolRendererRegistry().get('get_weather')).to.equal(def);
  });

  it('overwrites an existing entry registered under the same name', () => {
    registerToolRenderer('get_weather', { render: () => 'first' });
    const second: ToolRendererDefinition = { render: () => 'second' };
    registerToolRenderer('get_weather', second);
    expect(getDefaultToolRendererRegistry().get('get_weather')).to.equal(second);
    expect(getDefaultToolRendererRegistry().size).to.equal(1);
  });
});

describe('clearToolRenderers', () => {
  it('empties the default registry so a later test starts clean', () => {
    registerToolRenderer('get_weather', { render: () => 'x' });
    clearToolRenderers();
    expect(getDefaultToolRendererRegistry().size).to.equal(0);
  });
});

describe('findToolRenderer', () => {
  it('returns undefined against an empty registry', () => {
    expect(findToolRenderer('get_weather', { ok: true })).to.equal(undefined);
  });

  it('matches by exact tool-name key first, ignoring matches() on that same entry or any other', () => {
    const byName: ToolRendererDefinition = { render: () => 'by-name' };
    const byShape: ToolRendererDefinition = { render: () => 'by-shape', matches: () => true };
    registerToolRenderer('get_weather', byName);
    registerToolRenderer('other', byShape);
    expect(findToolRenderer('get_weather', { anything: true })).to.equal(byName);
  });

  it('falls back to a shape-based matches() scan when no exact name matches', () => {
    const def: ToolRendererDefinition = {
      render: () => 'x',
      matches: (payload) => typeof payload === 'object' && payload !== null && 'results' in payload,
    };
    registerToolRenderer('some_search_tool', def);
    expect(findToolRenderer('unregistered_tool_name', { results: [] })).to.equal(def);
    expect(findToolRenderer('unregistered_tool_name', { other: true })).to.equal(undefined);
  });

  it('scans matches() candidates in registration order, returning the first hit', () => {
    const first: ToolRendererDefinition = { render: () => 'first', matches: () => true };
    const second: ToolRendererDefinition = { render: () => 'second', matches: () => true };
    registerToolRenderer('a', first);
    registerToolRenderer('b', second);
    expect(findToolRenderer('unregistered', {})).to.equal(first);
  });

  it('accepts an explicit registry instead of touching the default one', () => {
    const custom: Map<string, ToolRendererDefinition> = new Map();
    const def: ToolRendererDefinition = { render: () => 'custom' };
    custom.set('get_weather', def);

    expect(findToolRenderer('get_weather', {}, custom)).to.equal(def);
    expect(getDefaultToolRendererRegistry().size, 'the default registry must be untouched').to.equal(0);
  });
});

describe('loadToolRenderer', () => {
  it('resolves immediately (no load called) for a definition that already has render', async () => {
    const def: ToolRendererDefinition = { render: () => 'x' };
    const resolved = await loadToolRenderer(def);
    expect(resolved).to.equal(def);
  });

  it('awaits and unwraps a load() that resolves a ToolRendererDefinition directly', async () => {
    const real: ToolRendererDefinition = { render: () => 'loaded' };
    const def: ToolRendererDefinition = { load: () => Promise.resolve(real) };
    const resolved = await loadToolRenderer(def);
    expect(resolved).to.equal(real);
  });

  it('awaits and unwraps a load() that resolves a { default } module namespace object', async () => {
    const real: ToolRendererDefinition = { render: () => 'loaded' };
    const def: ToolRendererDefinition = { load: () => Promise.resolve({ default: real }) };
    const resolved = await loadToolRenderer(def);
    expect(resolved).to.equal(real);
  });

  it('calls load() at most once per definition -- a second resolution reuses the cached promise', async () => {
    let calls = 0;
    const real: ToolRendererDefinition = { render: () => 'loaded' };
    const def: ToolRendererDefinition = {
      load: () => {
        calls++;
        return Promise.resolve(real);
      },
    };
    await loadToolRenderer(def);
    await loadToolRenderer(def);
    expect(calls).to.equal(1);
  });

  it('keys the cache by definition identity, not tool name -- two distinct definitions each get their own load() call', async () => {
    let calls = 0;
    const makeDef = (): ToolRendererDefinition => ({
      load: () => {
        calls++;
        return Promise.resolve({ render: () => 'x' });
      },
    });
    const defA = makeDef();
    const defB = makeDef();
    await loadToolRenderer(defA);
    await loadToolRenderer(defB);
    expect(calls).to.equal(2);
  });

  it('does not cache a rejected load() -- a later call retries', async () => {
    let calls = 0;
    const real: ToolRendererDefinition = { render: () => 'loaded' };
    const def: ToolRendererDefinition = {
      load: () => {
        calls++;
        return calls === 1 ? Promise.reject(new Error('transient failure')) : Promise.resolve(real);
      },
    };

    let firstError: unknown;
    try {
      await loadToolRenderer(def);
    } catch (err) {
      firstError = err;
    }
    expect(firstError).to.be.instanceOf(Error);

    const resolved = await loadToolRenderer(def);
    expect(resolved).to.equal(real);
    expect(calls).to.equal(2);
  });
});
