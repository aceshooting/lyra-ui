import { expect, waitUntil } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type {
  LyraHierarchyProjection, LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchySource, LyraSourceSearchResult,
} from '../data-sources.js';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import '../components/layout/virtual-list/virtual-list.js';
import type { LyraVirtualList } from '../components/layout/virtual-list/virtual-list.class.js';
import { HierarchySourceController, hierarchyField, hierarchyText } from './hierarchy-source-controller.js';

type Source = LyraHierarchySource<string, LyraHierarchyQuery>;
const row = (key: string): LyraHierarchyRow<string> => ({
  key, value: `${key} value`, parentKey: null, level: 1, position: 1, setSize: 1,
  childCount: 0, selected: false, expanded: false,
});
function projection(state: string): LyraHierarchyProjection<string> {
  return { state, total: 1, rows: {
    count: 1, keyAt: () => 'k0', indexOfKey: (key: string | number) => key === 'k0' ? 0 : -1, itemAt: () => row('k0'),
  } };
}
function provider(state: string): Source {
  return { revision: 1, project: async () => projection(state) };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });
function setup() {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => { controllers.add(controller); },
    removeController: (controller: ReactiveController) => { controllers.delete(controller); },
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  const inner = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('button'));
  document.body.append(host);
  cleanups.push(() => { host.remove(); for (const controller of controllers) controller.hostDisconnected?.(); });
  const hooks = { onChange: () => {}, accepted: () => {} };
  const observed: string[] = [];
  const control: HierarchySourceController<string> = new HierarchySourceController<string>(host, {
    normalize: value => {
      if (typeof value !== 'string') throw new TypeError('Expected a string row');
      return value;
    },
    onChange: () => { if (control.projection) observed.push(control.projection.state); hooks.onChange(); },
    accepted: () => hooks.accepted(),
  });
  return { control, host, inner, hooks, observed };
}
type Setup = ReturnType<typeof setup>;
async function landed(test: Setup, state: string): Promise<void> {
  await waitUntil(() => test.control.projection?.state === state && !test.control.loading, `the ${state} projection landed`);
  expect(test.control.error).to.equal(false);
  expect(test.observed.includes('obsolete'), 'the revoked projection never became visible').to.equal(false);
}

describe('hierarchy field readers', () => {
  it('reads own data fields and rejects non-records and accessors', () => {
    expect(hierarchyField({ a: 1 }, 'a')).to.equal(1);
    expect(hierarchyField({}, 'a')).to.equal(undefined);
    for (const value of [null, undefined, 'text', 5]) {
      expect(() => hierarchyField(value, 'a'), String(value)).to.throw(TypeError, 'Invalid hierarchy record');
    }
    expect(() => hierarchyField({ get a() { return 1; } }, 'a')).to.throw(TypeError, 'Invalid hierarchy field');
  });

  it('bounds display text and substitutes the fallback for anything that is not a string', () => {
    expect(hierarchyText('label')).to.equal('label');
    expect(hierarchyText(5)).to.equal('');
    expect(hierarchyText(undefined, 'fallback')).to.equal('fallback');
    expect(hierarchyText('x'.repeat(65_536)).length).to.equal(65_536);
    expect(() => hierarchyText('x'.repeat(65_537))).to.throw(RangeError, 'row budget');
  });
});

describe('hierarchy source validation', () => {
  it('reports an error for a source that is not an object with a project function, then recovers', async () => {
    const test = setup();
    for (const bad of [null, 5, {}, { revision: 1 }]) {
      test.control.update(bad as never, 'en');
      expect(test.control.error, String(bad)).to.equal(true);
      expect(test.control.projection).to.equal(undefined);
    }
    test.control.update(provider('good'), 'en');
    expect(await test.control.whenReady()).to.equal(true);
    expect(test.control.error).to.equal(false);
    expect(test.control.projection?.state).to.equal('good');
  });
});

describe('hierarchy row metadata', () => {
  const projectionOf = (rowOf: (index: number) => unknown): LyraHierarchyProjection<string> => ({
    state: 'rows', total: 2, rows: {
      count: 2, keyAt: (index: number) => `k${index}`, indexOfKey: (key: string | number) => Number(String(key).slice(1)),
      itemAt: rowOf as never,
    },
  });

  it('keeps an explicit disabled flag on a row, and drops a row whose disabled flag is not a boolean', async () => {
    const test = setup();
    const source: Source = { revision: 1, project: async () => projectionOf((index) => (
      index === 0 ? { ...row('k0'), disabled: true } : { ...row('k1'), disabled: 'yes' }
    )) };
    test.control.update(source, 'en');
    expect(await test.control.whenReady()).to.equal(true);
    await waitUntil(() => test.control.window.source.itemAt(0).state === 'ready');
    const disabled = test.control.slot(0);
    expect(disabled.state === 'ready' && disabled.value.disabled).to.equal(true);
    expect(test.control.activeKey, 'a disabled row is never the roving tab stop').to.equal(undefined);
    expect(test.control.slot(1).state, 'a non-boolean disabled flag is an invalid row').to.equal('error');

    const plain: Source = { revision: 2, project: async () => projectionOf((index) => row(`k${index}`)) };
    test.control.update(plain, 'en');
    expect(await test.control.whenReady()).to.equal(true);
    await waitUntil(() => test.control.window.source.itemAt(0).state === 'ready');
    const normal = test.control.slot(0);
    expect(normal.state === 'ready' && Object.hasOwn(normal.value, 'disabled')).to.equal(false);
    expect(test.control.activeKey).to.equal('k0');
  });
});

describe('hierarchy update re-entry', () => {
  it('keeps the update a query getter makes while its own query is being read', async () => {
    const test = setup();
    let armed = true;
    const query = new Proxy({ search: '', hiddenKinds: [] as string[] }, {
      getOwnPropertyDescriptor(target, key) {
        if (armed) { armed = false; test.control.update(provider('replacement'), 'fr'); }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    test.control.update(provider('obsolete'), 'en', false, query);
    await landed(test, 'replacement');
  });

  it('keeps the update an invalid query getter makes before the query is rejected', async () => {
    const test = setup();
    let armed = true;
    const query = new Proxy({ search: 5 as unknown as string, hiddenKinds: [] as string[] }, {
      getOwnPropertyDescriptor(target, key) {
        if (armed) { armed = false; test.control.update(provider('replacement'), 'fr'); }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    test.control.update(provider('obsolete'), 'en', false, query);
    await landed(test, 'replacement');
    expect(test.control.error).to.equal(false);
  });

  it('keeps the update an abort listener makes while the source is being replaced', async () => {
    const test = setup();
    const pending = deferred<LyraHierarchyProjection<string>>();
    const first = provider('first');
    let started = false;
    let nested = false;
    first.project = request => {
      started = true;
      request.signal.addEventListener('abort', () => {
        if (nested) return;
        nested = true;
        test.control.update(provider('replacement'), 'fr');
      }, { once: true });
      return pending.promise;
    };
    test.control.update(first, 'en');
    await waitUntil(() => started);
    test.control.update(provider('second'), 'de');
    pending.resolve(projection('first'));
    await landed(test, 'replacement');
  });
});

describe('hierarchy projection revocation', () => {
  it('settles a queued projection when its host moves to another document before the load starts', async () => {
    const test = setup();
    let calls = 0;
    const source = provider('queued');
    source.project = async () => { calls += 1; return projection('queued'); };
    test.control.update(source, 'en');
    const other = document.implementation.createHTMLDocument('adopted');
    other.body.append(other.adoptNode(test.host));
    expect(await test.control.whenReady()).to.equal(false);
    expect(calls).to.equal(0);
    expect(test.control.projection).to.equal(undefined);
  });

  it('settles both queued projections when a source replacement arrives in the same turn', async () => {
    const test = setup();
    let obsoleteCalls = 0;
    const obsolete = provider('obsolete');
    obsolete.project = async () => { obsoleteCalls += 1; return projection('obsolete'); };
    test.control.update(obsolete, 'en');
    const first = test.control.whenReady();
    test.control.update(provider('replacement'), 'fr');
    expect(await first).to.equal(false);
    await landed(test, 'replacement');
    expect(obsoleteCalls).to.equal(0);
  });

  it('keeps a replacement that arrives in the microtask gap before the provider is called', async () => {
    const test = setup();
    let obsoleteCalls = 0;
    const obsolete = provider('obsolete');
    obsolete.project = async () => { obsoleteCalls += 1; return projection('obsolete'); };
    test.control.update(obsolete, 'en');
    queueMicrotask(() => test.control.update(provider('replacement'), 'fr'));
    await landed(test, 'replacement');
    expect(obsoleteCalls).to.equal(0);
  });

  it('keeps a replacement installed by the getter that reads the provider function', async () => {
    const test = setup();
    let armed = false;
    let obsoleteCalls = 0;
    const obsolete = { revision: 1, get project() {
      if (armed) { armed = false; test.control.update(provider('replacement'), 'fr'); }
      return async () => { obsoleteCalls += 1; return projection('obsolete'); };
    } } as unknown as Source;
    test.control.update(obsolete, 'en');
    armed = true;
    await landed(test, 'replacement');
    expect(obsoleteCalls).to.equal(0);
  });

  it('keeps a replacement installed while the row count is being read for binding', async () => {
    const test = setup();
    let reads = 0;
    const obsolete = provider('obsolete');
    obsolete.project = async () => ({ state: 'obsolete', total: 1, rows: {
      get count() {
        reads += 1;
        if (reads === 2) test.control.update(provider('replacement'), 'fr');
        return 1;
      },
      keyAt: () => 'k0', indexOfKey: () => 0, itemAt: () => row('k0'),
    } });
    test.control.update(obsolete, 'en');
    await landed(test, 'replacement');
    expect(reads).to.be.at.least(2);
  });

  it('keeps a replacement installed by the change notification of a new projection', async () => {
    const test = setup();
    test.hooks.onChange = () => {
      if (test.control.projection?.state !== 'obsolete') return;
      test.hooks.onChange = () => {};
      test.control.update(provider('replacement'), 'fr');
    };
    test.control.update(provider('obsolete'), 'en');
    await waitUntil(() => test.control.projection?.state === 'replacement' && !test.control.loading);
    expect(test.control.error).to.equal(false);
  });

  it('keeps a replacement installed by the acceptance callback of a user action', async () => {
    const test = setup();
    test.control.update(provider('initial'), 'en');
    expect(await test.control.whenReady()).to.equal(true);
    const accepted: string[] = [];
    test.hooks.accepted = () => {
      accepted.push('accepted');
      test.hooks.accepted = () => {};
      test.control.update(provider('replacement'), 'fr');
    };
    const toggled = test.control.project({ type: 'toggle', key: 'k0', expanded: true }, true, row('k0'));
    expect(await toggled).to.equal(false);
    await landed(test, 'replacement');
    expect(accepted).to.deep.equal(['accepted']);
  });

  it('abandons a request whose lease is revoked by the abort listener of the load it replaces', async () => {
    const test = setup();
    const pending = deferred<LyraHierarchyProjection<string>>();
    const first = provider('obsolete');
    let started = false;
    first.project = request => {
      started = true;
      request.signal.addEventListener('abort', () => test.control.update(provider('replacement'), 'fr'), { once: true });
      return pending.promise;
    };
    test.control.update(first, 'en');
    await waitUntil(() => started);
    expect(await test.control.reveal('k0')).to.equal(false);
    // The revoked provider keeps its permit until it settles; release it so the replacement can run.
    pending.resolve(projection('obsolete'));
    await landed(test, 'replacement');
  });

  it('settles the projection a second request supersedes before it starts', async () => {
    const test = setup();
    test.control.update(provider('initial'), 'en');
    expect(await test.control.whenReady()).to.equal(true);
    const first = test.control.project({ type: 'toggle', key: 'k0', expanded: true });
    const second = test.control.project({ type: 'toggle', key: 'k0', expanded: false });
    expect(await first).to.equal(false);
    expect(await second).to.equal(true);
  });

  it('does not restart a cancelled queued request and releases the loading state', async () => {
    const test = setup();
    let calls = 0;
    const source = provider('initial');
    const project = source.project;
    source.project = request => { calls += 1; return project(request); };
    test.control.update(source, 'en');
    expect(await test.control.whenReady()).to.equal(true);
    const afterLoad = calls;
    const queued = test.control.project({ type: 'toggle', key: 'k0', expanded: true });
    test.control.cancelPending();
    expect(await queued).to.equal(false);
    expect(test.control.loading).to.equal(false);

    const reveal = test.control.reveal('k0');
    test.control.cancelSearch();
    expect(await reveal).to.equal(false);
    expect(test.control.loading).to.equal(false);
    await Promise.resolve();
    expect(calls, 'neither cancelled request reached the provider').to.equal(afterLoad);
  });

  it('ignores cancelPending() before any projection exists', () => {
    const test = setup();
    expect(() => test.control.cancelPending()).to.not.throw();
    expect(test.control.loading).to.equal(false);
  });
});

describe('hierarchy focus restoration', () => {
  async function readyWithActiveRow(test: Setup, source: Source): Promise<void> {
    test.control.update(source, 'en');
    expect(await test.control.whenReady()).to.equal(true);
    const slot = test.control.slot(0);
    expect(slot.state).to.equal('ready');
    expect(test.control.activeKey).to.equal('k0');
  }

  it('resolves the focused row key again after a user action and survives a replacement during the lookup', async () => {
    const test = setup();
    const lookups: Array<string | number> = [];
    const source = provider('initial');
    source.project = async request => ({
      state: request.action.type === 'toggle' ? 'toggled' : 'initial',
      total: 1,
      rows: {
        count: 1, keyAt: () => 'k0', itemAt: () => row('k0'),
        indexOfKey: (key: string | number) => { lookups.push(key); return 0; },
      },
    });
    await readyWithActiveRow(test, source);
    await focusByKeyboard(test.inner);
    test.control.focusRow(0, row('k0'));
    const toggled = test.control.project({ type: 'toggle', key: 'k0', expanded: true }, true, row('k0'));
    expect(await toggled).to.equal(true);
    expect(lookups, 'the focused row, not the active index, was looked up').to.deep.equal(['k0']);
    expect(test.control.projection?.state).to.equal('toggled');
  });

  it('drops the focus recovery of a reset interrupted by a replacement raised from the lookup', async () => {
    const test = setup();
    await readyWithActiveRow(test, provider('initial'));
    await focusByKeyboard(test.inner);
    const obsolete: Source = { revision: 2, project: async () => ({ ...projection('obsolete'), rows: {
      count: 1, keyAt: () => 'k0', itemAt: () => row('k0'),
      indexOfKey: () => {
        test.control.update(provider('replacement'), 'fr');
        return 0;
      },
    } }) };
    test.control.update(obsolete, 'en');
    await waitUntil(() => test.control.projection?.state === 'replacement' && !test.control.loading);
    expect(test.control.error).to.equal(false);
    expect(test.control.activeKey, 'the interrupted recovery did not re-activate the old row').to.equal(undefined);
  });
});

describe('hierarchy inspection capabilities', () => {
  it('answers unavailable without a source and stale once the host has left the document', async () => {
    const test = setup();
    expect((await test.control.search()).status).to.equal('unavailable');
    expect((await test.control.copy(null, 'document', 10)).status).to.equal('unavailable');
    test.control.update(provider('initial'), 'en');
    expect(await test.control.whenReady()).to.equal(true);
    test.host.remove();
    expect((await test.control.search()).status).to.equal('stale');
    expect((await test.control.copy(null, 'document', 10)).status).to.equal('stale');
  });

  it('settles a queued search as stale when its host moves to another document first', async () => {
    const test = setup();
    let searches = 0;
    const source = provider('initial');
    source.search = async () => { searches += 1; return { hits: [], total: 0, exhaustive: true }; };
    test.control.update(source, 'en');
    expect(await test.control.whenReady()).to.equal(true);
    const pending = test.control.search();
    const other = document.implementation.createHTMLDocument('adopted');
    other.body.append(other.adoptNode(test.host));
    expect((await pending).status).to.equal('stale');
    expect(searches).to.equal(0);
  });

  it('reports a search cancelled while its result is being validated as stale', async () => {
    const test = setup();
    const source = provider('initial');
    let cancelled = false;
    const result: LyraSourceSearchResult<{ readonly key: string }> = { hits: [{ key: 'k0' }], total: 1, exhaustive: true };
    source.search = async () => new Proxy(result, {
      getOwnPropertyDescriptor(target, key) {
        if (!cancelled) { cancelled = true; test.control.cancelSearch(); }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    test.control.update(source, 'en');
    expect(await test.control.whenReady()).to.equal(true);
    expect((await test.control.search()).status).to.equal('stale');
    expect(cancelled).to.equal(true);
    source.search = async () => result;
    expect((await test.control.search()).status).to.equal('ready');
  });

  it('delivers a copy longer than one scheduling slice and reports a cancelled one as stale', async () => {
    const test = setup();
    const source = provider('initial');
    const text = 'x'.repeat(70_000);
    source.copy = async () => text;
    test.control.update(source, 'en');
    expect(await test.control.whenReady()).to.equal(true);
    const copied = await test.control.copy('k0', 'node', 100_000);
    expect(copied.status === 'ready' && copied.value.length).to.equal(70_000);

    const pending = test.control.copy('k0', 'node', 100_000);
    test.control.cancelSearch();
    expect((await pending).status, 'cancelled before the provider ran').to.equal('stale');

    // A cancellation that lands while a long copy yields to the browser is stale, never an error.
    const original = Object.getOwnPropertyDescriptor(window, 'scheduler');
    let yields = 0;
    Object.defineProperty(window, 'scheduler', {
      configurable: true,
      value: { yield: async () => { yields += 1; test.control.cancelSearch(); } },
    });
    try {
      expect((await test.control.copy('k0', 'node', 100_000)).status).to.equal('stale');
      expect(yields).to.equal(1);
    } finally {
      if (original) Object.defineProperty(window, 'scheduler', original);
      else Reflect.deleteProperty(window, 'scheduler');
    }
    const afterwards = await test.control.copy('k0', 'node', 100_000);
    expect(afterwards.status === 'ready' && afterwards.value.length, 'the next copy is unaffected').to.equal(70_000);
  });
});

describe('hierarchy keyboard handling and row mounting', () => {
  it('claims the navigation keys, ignores modified keystrokes and stays quiet while loading or failed', async () => {
    const test = setup();
    const target = row('k0');
    const press = (key: string, init: KeyboardEventInit = {}): boolean => {
      const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
      test.control.keydown(event, target, 0, false, () => {});
      return event.defaultPrevented;
    };
    test.control.update(provider('initial'), 'en');
    expect(press('Home'), 'a loading source does not navigate').to.equal(false);
    expect(await test.control.whenReady()).to.equal(true);
    for (const key of ['Home', 'End', 'ArrowDown', 'ArrowUp']) expect(press(key), key).to.equal(true);
    for (const init of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      expect(press('ArrowDown', init), JSON.stringify(init)).to.equal(false);
    }
    expect(press('x')).to.equal(false);
    test.control.update({ revision: 1 } as never, 'en');
    expect(test.control.error).to.equal(true);
    expect(press('Home'), 'a failed source does not navigate').to.equal(false);
  });

  it('keeps the mounted-row state when the virtual list renders no rows', async () => {
    const test = setup();
    let changes = 0;
    test.hooks.onChange = () => { changes += 1; };
    test.control.update(provider('initial'), 'en');
    expect(await test.control.whenReady()).to.equal(true);
    // A list that has rendered no rows yet: nothing is mounted, active or failed.
    const list = test.host.appendChild(document.createElement('lr-virtual-list')) as LyraVirtualList;
    test.control.list = list;
    const before = changes;
    test.control.slot(0);
    await Promise.resolve();
    await Promise.resolve();
    expect([test.control.mountedActive, test.control.firstMountedIndex, test.control.rowError, test.control.rowsObserved])
      .to.deep.equal([false, 0, false, false]);
    expect(changes - before, 'only the first-row activation repaints; the unchanged mounted state does not').to.equal(1);
  });
});
