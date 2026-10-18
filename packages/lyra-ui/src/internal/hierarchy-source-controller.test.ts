import { hierarchyKey } from './hierarchy-source-controller.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import { deepActiveElementIn } from './active-element.js';
import type { LyraHierarchySource, LyraHierarchyQuery, LyraHierarchyRow } from '../data-sources.js';
import type { LyraTree, LyraTreeNodeData } from '../components/data/tree/tree.class.js';
import '../components/data/tree/tree.js';

type Source = LyraHierarchySource<LyraTreeNodeData, LyraHierarchyQuery>;
const row = (index: number): LyraHierarchyRow<LyraTreeNodeData> => ({ key: `n${index}`, value: { id: `n${index}`, label: `Node ${index}` },
  parentKey: null, level: 1, position: index + 1, setSize: 10, childCount: 0, selected: false, expanded: false });
function provider(): Source {
  return { revision: 1, async project(request) { return { state: 'initial', total: 10,
    rows: { count: 10, keyAt: index => `n${index}`, indexOfKey: (key: string | number) => Number(String(key).slice(1)), itemAt: row },
    ...(request.action.type === 'reveal' ? { focusIndex: Number(request.action.key.slice(1)) } : {}),
  }; } };
}
const ready = (el: LyraTree) => waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-source-key="n0"]')));

it('revokes stale projections synchronously on replacement, disconnect, and adoption', async () => {
  let release!: () => void;
  let signal: AbortSignal | undefined;
  const old = provider();
  const project = old.project;
  old.project = async request => { signal = request.signal; await new Promise<void>(resolve => { release = resolve; }); return project(request); };
  const el = await fixture<LyraTree>(html`<lr-tree label="Authority" .treeSource=${old}></lr-tree>`);
  await waitUntil(() => Boolean(signal));
  el.treeSource = provider();
  expect(signal!.aborted).to.equal(true);
  release();
  await ready(el);
  const parent = el.parentNode!;
  el.remove();
  parent.appendChild(el);
  await ready(el);
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const target = frame.contentDocument!;
  target.body.appendChild(target.adoptNode(el));
  await el.updateComplete;
  await ready(el);
  expect(el.ownerDocument === target).to.equal(true);
  expect(await el.revealSourceKey('n9')).to.equal(true);
  expect(deepActiveElementIn(target)?.getAttribute('data-source-key')).to.equal('n9');
  el.remove();
});

it('does not steal externally transferred focus after a deferred reveal', async () => {
  const source = provider();
  const project = source.project;
  let release!: () => void;
  source.project = async request => {
    if (request.action.type === 'reveal') await new Promise<void>(resolve => { release = resolve; });
    return project(request);
  };
  const container = await fixture<HTMLDivElement>(html`<div><lr-tree label="Focus" .treeSource=${source}></lr-tree><button>Outside</button></div>`);
  const el = container.querySelector<LyraTree>('lr-tree')!;
  await ready(el);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[role="tree"]')!);
  const pending = el.revealSourceKey('n9');
  await waitUntil(() => Boolean(release));
  const outside = container.querySelector('button')!;
  await focusByKeyboard(outside);
  release();
  expect(await pending).to.equal(false);
  expect(deepActiveElementIn(document) === outside).to.equal(true);
});

it('rejects invalid row descriptors and missing key lookup without traversing a fallback model', async () => {
  let getters = 0;
  const source = provider();
  const project = source.project;
  source.project = async request => {
    const projection = await project(request);
    return { ...projection, rows: { count: 10, keyAt: index => `n${index}`, indexOfKey: (key: string | number) => Number(String(key).slice(1)),
      itemAt(index) { const value = row(index); Object.defineProperty(value, 'level', { get() { getters++; return 1; } }); return value; },
    } };
  };
  const el = await fixture<LyraTree>(html`<lr-tree label="Validation" .treeSource=${source}></lr-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  expect(getters).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part~="source-row"]').length).to.equal(0);
  const missing = provider();
  const normal = missing.project;
  missing.project = async request => { const result = await normal(request); delete (result.rows as { indexOfKey?: unknown }).indexOfKey; return result; };
  el.treeSource = missing;
  await waitUntil(() => el.shadowRoot!.querySelector('[part~="source-error"]')?.textContent?.includes('Unable to load tree data.') === true);
});

it('preserves a reentrant replacement started by a provider callback', async () => {
  let el!: LyraTree;
  const next = provider();
  const old = provider();
  const project = old.project;
  old.project = async request => { el.treeSource = next; return project(request); };
  el = await fixture<LyraTree>(html`<lr-tree label="Reentrant"></lr-tree>`);
  el.treeSource = old;
  await ready(el);
  expect(el.treeSource === next).to.equal(true);
  expect(await el.revealSourceKey('n9')).to.equal(true);
});

it('rejects oversized opaque state instead of retaining unbounded projection metadata', async () => {
  const source = provider();
  const project = source.project;
  source.project = async request => ({ ...await project(request), state: 'x'.repeat(65_537) });
  const el = await fixture<LyraTree>(html`<lr-tree label="Bounded state" .treeSource=${source}></lr-tree>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part~="source-error"]')));
  expect(el.shadowRoot!.querySelectorAll('[part~="source-row"]').length).to.equal(0);
});

it('repairs an owned focused key removed by a source replacement without a global scan', async () => {
  const el = await fixture<LyraTree>(html`<lr-tree label="Shrinking source" .treeSource=${provider()}></lr-tree>`);
  await ready(el);
  expect(await el.revealSourceKey('n9')).to.equal(true);
  const next = provider();
  const project = next.project;
  next.project = async request => { const result = await project(request); return { ...result, total: 2, rows: { ...result.rows, count: 2 } }; };
  el.treeSource = next;
  await waitUntil(() => deepActiveElementIn(document)?.getAttribute('data-source-key') === 'n0');
  expect(el.shadowRoot!.querySelector('[data-source-key="n9"]')).to.equal(null);
});


it('rejects an oversized identity before trimming its contents', () => {
  const trim = String.prototype.trim;
  let oversizedTrims = 0;
  String.prototype.trim = function (this: string): string {
    if (this.length > 65_536) oversizedTrims++;
    return trim.call(this);
  };
  try { expect(() => hierarchyKey(' '.repeat(1_000_000))).to.throw(); }
  finally { String.prototype.trim = trim; }
  expect(oversizedTrims).to.equal(0);
});
