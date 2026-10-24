import { expect, waitUntil } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraHierarchyProjection, LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchySource } from '../data-sources.js';
import { HierarchySourceController } from './hierarchy-source-controller.js';

type Source = LyraHierarchySource<string, LyraHierarchyQuery>;
function projection(key: string): LyraHierarchyProjection<string> {
  const row: LyraHierarchyRow<string> = {
    key, value: `${key} value`, parentKey: null, level: 1, position: 1, setSize: 1,
    childCount: 0, selected: false, expanded: false,
  };
  return { state: key, total: 1, rows: {
    count: 1, keyAt: () => key, indexOfKey: (candidate: string) => candidate === key ? 0 : -1,
    itemAt: () => row,
  } };
}
function provider(key: string): Source {
  return { revision: 1, project: async () => projection(key) };
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
  document.body.append(host);
  cleanups.push(() => { host.remove(); for (const controller of controllers) controller.hostDisconnected?.(); });
  const observed: string[] = [];
  const control: HierarchySourceController<string> = new HierarchySourceController<string>(host, {
    normalize: value => {
      if (typeof value !== 'string') throw new TypeError('Expected a string row');
      return value;
    },
    onChange: () => { if (control.projection) observed.push(control.projection.state); },
    accepted: () => {},
  });
  return { control, observed };
}
async function replacementReady(control: HierarchySourceController<string>): Promise<void> {
  expect(await control.whenReady()).to.equal(true);
  expect(control.error).to.equal(false);
  expect(control.loading).to.equal(false);
  expect(control.projection?.state).to.equal('replacement');
  expect(control.projection?.total).to.equal(1);
  await waitUntil(() => control.slot(0).state === 'ready', 'the replacement row is readable');
  const slot = control.slot(0);
  expect(slot.state).to.equal('ready');
  if (slot.state === 'ready') expect([slot.value.key, slot.value.value]).to.deep.equal(['replacement', 'replacement value']);
}

describe('hierarchy projection reentry ownership', () => {
  it('preserves a replacement installed by a revision getter that subsequently throws', async () => {
    const { control, observed } = setup();
    const replacement = provider('replacement');
    const source = provider('obsolete');
    let obsoleteCalls = 0;
    source.project = async () => { obsoleteCalls++; return projection('obsolete'); };
    Object.defineProperty(source, 'revision', { get() {
      control.update(replacement, 'fr');
      throw new Error('The previous revision is no longer available');
    } });
    control.update(source, 'en');
    await replacementReady(control);
    expect(obsoleteCalls).to.equal(0);
    expect(observed.includes('obsolete')).to.equal(false);
    control.refresh();
    await replacementReady(control);
  });

  it('discards a response whose lazy total metadata replaces the provider during admission', async () => {
    const { control, observed } = setup();
    const replacement = provider('replacement');
    const source = provider('obsolete');
    let metadataReads = 0;
    source.project = async () => ({ ...projection('obsolete'), get total() {
      metadataReads++;
      control.update(replacement, 'fr');
      return 1;
    } });
    control.update(source, 'en');
    const obsolete = control.whenReady();
    expect(await obsolete).to.equal(false);
    await replacementReady(control);
    expect(metadataReads).to.equal(1);
    expect(observed.includes('obsolete')).to.equal(false);
  });

  for (const operation of ['cancelSearch', 'cancelPending'] as const) {
    it(`keeps a replacement started by the active reveal's abort listener during ${operation}`, async () => {
      const { control, observed } = setup();
      const replacement = provider('replacement');
      const source = provider('initial');
      const pending = deferred<LyraHierarchyProjection<string>>();
      let signal: AbortSignal | undefined;
      let aborted = 0;
      source.project = async request => {
        if (request.action.type !== 'reveal') return projection('initial');
        signal = request.signal;
        signal.addEventListener('abort', () => {
          aborted++;
          control.update(replacement, 'fr');
        }, { once: true });
        return pending.promise;
      };
      try {
        control.update(source, 'en');
        expect(await control.whenReady()).to.equal(true);
        expect(control.projection?.state).to.equal('initial');
        const reveal = control.reveal('initial');
        await waitUntil(() => signal !== undefined, 'the provider has received the reveal request');
        control[operation]();
        expect(signal!.aborted).to.equal(true);
        expect(aborted).to.equal(1);
        expect(await reveal).to.equal(false);
        pending.resolve(projection('obsolete'));
        await replacementReady(control);
        expect(observed.includes('obsolete')).to.equal(false);
        control.refresh();
        await replacementReady(control);
      } finally { pending.resolve(projection('obsolete')); }
    });
  }
});
