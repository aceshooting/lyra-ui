import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { answerBlocksCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenNode, LyraGenView } from '../../src/types.js';

const catalog = answerBlocksCatalog();
interface UpdatingElement extends HTMLElement { readonly updateComplete: Promise<boolean> }

const blocks: Readonly<Record<string, LyraGenNode>> = {
  'kpi-row': { id: 'subject', type: 'kpi-row', props: { items: [{ label: 'Reviewed orders', value: 24, caption: 'Two quarters', deltaPercent: 12.5 }, { label: 'Open returns', value: '3', deltaPercent: -1.5, goodDirection: 'down' }] } },
  comparison: { id: 'subject', type: 'comparison', props: { caption: 'Plan comparison', columns: ['Basic', 'Professional'], rows: [{ label: 'Seats', values: [1, 10] }, { label: 'Support channel', values: ['Email', 'Priority phone'] }] } },
  steps: { id: 'subject', type: 'steps', props: { label: 'Rollout progress', items: [{ label: 'Plan' }, { label: 'Build', description: 'Work in progress' }, { label: 'Ship' }], current: 1 } },
};

function documentFor(root: LyraGenNode): LyraGenView {
  return { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'answer-blocks', revision: 0, root };
}
function allText(root: ParentNode): string {
  let text = root.textContent ?? '';
  for (const child of root.querySelectorAll<HTMLElement>('*')) if (child.shadowRoot) text += ` ${allText(child.shadowRoot)}`;
  return text;
}
async function settled(host: LyraGenViewElement): Promise<void> {
  await host.updateComplete;
  await waitUntil(() => host.shadowRoot?.querySelector('[part="loading"]') === null, 'Catalog modules loaded', { timeout: 5000 });
  await host.updateComplete;
  for (let pass = 0; pass < 2; pass += 1) for (const child of host.shadowRoot?.querySelectorAll<UpdatingElement>('*') ?? []) if ('updateComplete' in child) await child.updateComplete;
}
async function mount(root: LyraGenNode, direction: 'ltr' | 'rtl' = 'ltr', inlineSize?: string): Promise<LyraGenViewElement> {
  const scope = await fixture<HTMLElement>(html`<div dir=${direction} style=${inlineSize ? `inline-size:${inlineSize}` : ''}><lr-gen-view .document=${documentFor(root)} .catalog=${catalog}></lr-gen-view></div>`);
  const host = scope.querySelector<LyraGenViewElement>('lr-gen-view')!;
  await settled(host);
  expect(host.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  return host;
}
function expectedTag(kind: string): string {
  return kind === 'kpi-row' ? 'lr-stat' : kind === 'comparison' ? 'lr-table' : 'lr-stepper';
}

describe('composite answer blocks rendered qualification', () => {
  it('renders each block as its expanded Lyra primitives with the supplied values', async () => {
    const kpi = await mount(blocks['kpi-row']!);
    const stats = [...kpi.shadowRoot!.querySelectorAll<HTMLElement>('lr-stat')];
    expect(stats.length).to.equal(2);
    expect(stats.map(stat => stat.getAttribute('data-gen-id'))).to.deep.equal(['subject--0', 'subject--1']);
    expect(allText(kpi.shadowRoot!)).to.contain('Reviewed orders').and.to.contain('24').and.to.contain('Open returns');
    expect(Reflect.get(stats[0]!, 'deltaPercent')).to.equal(12.5);
    expect(Reflect.get(stats[1]!, 'goodDirection')).to.equal('down');

    const comparison = await mount(blocks['comparison']!);
    const table = comparison.shadowRoot!.querySelector<HTMLElement>('lr-table')!;
    expect(table.getAttribute('data-gen-id')).to.equal('subject');
    const text = allText(comparison.shadowRoot!);
    for (const expected of ['Plan comparison', 'Basic', 'Professional', 'Seats', 'Priority phone']) expect(text).to.contain(expected);

    const steps = await mount(blocks['steps']!);
    const stepper = steps.shadowRoot!.querySelector<HTMLElement>('lr-stepper')!;
    expect(Reflect.get(stepper, 'readonly')).to.equal(true);
    expect((Reflect.get(stepper, 'steps') as { state: string }[]).map(step => step.state)).to.deep.equal(['completed', 'current', 'pending']);
    for (const expected of ['Plan', 'Build', 'Ship']) expect(allText(steps.shadowRoot!)).to.contain(expected);
  });

  for (const kind of Object.keys(blocks)) {
    it(`keeps ${kind} accessible, RTL-correct and within 320px`, async () => {
      const host = await mount(blocks[kind]!, 'rtl', '320px');
      const primitive = host.shadowRoot!.querySelector<HTMLElement>(expectedTag(kind))!;
      expect(primitive !== null).to.equal(true);
      expect(getComputedStyle(primitive).direction).to.equal('rtl');
      expect(host.scrollWidth).to.be.at.most(321);
      expect(host.getBoundingClientRect().width).to.be.at.most(321);
      await expect(host).to.be.accessible();
    });
  }

  it('rejects a mismatched comparison row without rendering a partial table', async () => {
    const bad: LyraGenNode = { ...blocks['comparison']!, props: { ...blocks['comparison']!.props!, rows: [{ label: 'Seats', values: [1] }] } };
    const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .document=${documentFor(bad)} .catalog=${catalog}></lr-gen-view>`);
    await host.updateComplete;
    expect(host.shadowRoot!.querySelector('lr-table')).to.equal(null);
  });
});
