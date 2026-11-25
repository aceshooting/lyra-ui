import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { createCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import { LyraGenFunctionRegistry } from '../../src/functions.js';
import type { JsonValue, LyraGenCatalog, LyraGenNode, LyraGenView } from '../../src/types.js';

const nextFrame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()));
function catalog(prepared: (title: unknown) => void = () => {}): LyraGenCatalog {
  return createCatalog({ id: 'performance', version: '1', components: {
    group: { tag: 'div', properties: {}, children: true },
    item: { tag: 'p', properties: { title: { type: 'string' }, label: { type: 'string' } }, text: true, prepareProperties: props => { prepared(props['title']); return props; } },
    field: { tag: 'input', properties: { value: { type: 'string' }, name: { type: 'string' } }, bindings: { value: { property: 'value', event: 'input' } } },
  } });
}
/** `count` items under one group; every tenth item shows `/values/<index>` from live data. */
function view(count: number, extra: readonly LyraGenNode[] = []): LyraGenView {
  const children: LyraGenNode[] = [...extra];
  for (let index = 0; index < count; index++) {
    children.push({ id: `item-${index}`, type: 'item', props: { title: 'initial' }, text: `Item ${index}`, ...(index % 10 === 0 ? { liveReads: { title: `/values/${index}` } } : {}) });
  }
  return { version: '1', surfaceId: 'performance', revision: 0, catalog: { id: 'performance', version: '1' }, root: { id: 'root', type: 'group', children } };
}
const live = (count: number, value: string): JsonValue => ({ values: Object.fromEntries(Array.from({ length: count }, (_, index) => [String(index), value])), show: value.endsWith('odd') });
const node = (element: LyraGenViewElement, id: string): HTMLElement => element.shadowRoot!.querySelector<HTMLElement>(`[data-gen-id="${id}"]`)!;
/** Animation frames elapsed while `work` runs. */
async function framesDuring(work: () => Promise<unknown>): Promise<number> {
  let frames = 0, counting = true;
  const count = (): void => { if (!counting) return; frames++; requestAnimationFrame(count); };
  requestAnimationFrame(count);
  try { await work(); } finally { counting = false; }
  return frames;
}

describe('generated view render performance', () => {
  it('commits small and 500-node documents within a few animation frames', async () => {
    const source = catalog();
    for (const [count, budget] of [[100, 4], [500, 14]] as const) {
      const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${source}></lr-gen-view>`);
      const frames = await framesDuring(async () => {
        const ready = oneEvent(element, 'lr-gen-ready');
        element.document = view(count);
        await ready;
      });
      expect(element.shadowRoot!.querySelectorAll('[data-gen-id]').length).to.equal(count + 1);
      expect(frames, `${count} nodes`).to.be.at.most(budget);
    }
  });

  it('commits a large view while live data ticks every frame and converges to the final values', async function () {
    this.timeout(20000);
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog()}></lr-gen-view>`);
    let readyAtTick = -1, tick = 0, readyEvents = 0;
    element.addEventListener('lr-gen-ready', () => { readyEvents++; if (readyAtTick < 0) readyAtTick = tick; });
    element.document = view(500);
    for (; tick < 50; tick++) {
      element.liveData = live(500, `tick ${tick}`);
      await nextFrame();
    }
    expect(readyAtTick, 'the document committed before the ticks stopped').to.be.within(0, 48);
    await waitUntil(() => element.status === 'ready' && node(element, 'item-490').title === 'tick 49', 'Final live values render', { timeout: 10000 });
    expect(node(element, 'item-0').title).to.equal('tick 49');
    expect(node(element, 'item-1').title).to.equal('initial');
    expect(element.shadowRoot!.querySelectorAll('[data-gen-id]').length).to.equal(501);
    expect(readyEvents).to.equal(1);
  });

  it('re-prepares only nodes that read changed sources and keeps every element across a live tick', async () => {
    const prepared: unknown[] = [];
    // Every item computes a label from a literal, so a host function call marks each node preparation.
    let preparations = 0;
    const functions = new LyraGenFunctionRegistry(new Map([['mark', { arguments: { type: 'string' }, result: { type: 'string' }, run: (value: JsonValue) => { preparations++; return value; } }]]));
    const mark = { label: { fn: 'mark', arg: { value: 'marked' } } };
    const extra: LyraGenNode[] = [
      { id: 'field', type: 'field', props: { name: 'name', value: 'Original' }, bindings: { value: '/name' } },
      { id: 'shown', type: 'item', props: { title: 'shown' }, visible: { source: 'live', pointer: '/show', op: 'truthy' }, computes: mark },
      { id: 'echo', type: 'item', props: { title: 'echo' }, reads: { title: '/name' }, computes: mark },
    ];
    const document = view(100, extra);
    const root = { ...document.root, children: document.root.children!.map(child => child.type === 'item' ? { ...child, computes: mark } : child) };
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog(title => prepared.push(title))} .functions=${functions} .liveData=${live(100, 'even')} .document=${{ ...document, root }}></lr-gen-view>`);
    await waitUntil(() => element.status === 'ready', 'Initial view is ready');
    const before = [...element.shadowRoot!.querySelectorAll<HTMLElement>('[data-gen-id]')];
    expect(node(element, 'shown').hidden).to.equal(true);
    let readyEvents = 0;
    element.addEventListener('lr-gen-ready', () => readyEvents++);

    expect((node(element, 'item-1') as unknown as { label: string }).label).to.equal('marked');
    prepared.length = 0;
    preparations = 0;
    element.liveData = live(100, 'odd');
    await element.updateComplete;
    await waitUntil(() => element.status === 'ready', 'Live tick settles');
    expect(prepared.filter(title => title === 'odd').length, 'every live-reading item re-prepared').to.equal(10);
    expect(prepared.length).to.equal(10);
    expect(preparations, 'only the ten live-reading items and the live visibility node re-prepared').to.equal(11);
    expect(node(element, 'item-10').title).to.equal('odd');
    expect(node(element, 'item-11').title).to.equal('initial');
    expect(node(element, 'shown').hidden).to.equal(false);
    const after = [...element.shadowRoot!.querySelectorAll<HTMLElement>('[data-gen-id]')];
    expect(after.length).to.equal(before.length);
    expect(after.every((entry, index) => entry === before[index])).to.equal(true);
    expect(readyEvents).to.equal(0);

    // A state edit re-prepares its readers but no live-only node.
    prepared.length = 0;
    preparations = 0;
    const field = node(element, 'field') as HTMLInputElement;
    field.value = 'Edited';
    field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await element.updateComplete;
    await waitUntil(() => node(element, 'echo').title === 'Edited', 'State read follows the edit');
    expect(prepared).to.deep.equal(['Edited']);
    expect(preparations, 'only the state reader re-prepared').to.equal(1);
    expect(field.value).to.equal('Edited');
  });
});
