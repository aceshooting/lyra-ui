import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-drilldown-panel.js';
import type { LyraDrilldownNode, LyraDrilldownPanel } from '../../lr-drilldown-panel.js';

const evidence = [{ evidenceId: 'e1', title: 'report.pdf', excerpt: 'Excerpt' }];
const entities = [{ entityId: 'p1', label: 'Marie', type: 'person' }];
const root: LyraDrilldownNode = { nodeId: 'root', label: 'Root', evidence, entities };
const child: LyraDrilldownNode = { nodeId: 'child', label: 'Child', evidence, entities };

describe('drilldown panel owned tab group events', () => {
  it('lets a nested tab group event reach consumer ancestors while stopping its own', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-drilldown-panel .path=${[root]}></lr-drilldown-panel></div>`);
    const el = wrapper.querySelector('lr-drilldown-panel') as LyraDrilldownPanel;
    await el.updateComplete;
    const seen: string[] = [];
    wrapper.addEventListener('lr-tab-show', (event) => { seen.push((event.target as Element).localName); });
    const owned = el.shadowRoot!.querySelector('lr-tab-group')!;
    owned.dispatchEvent(new CustomEvent('lr-tab-show', { detail: { name: 'evidence' }, bubbles: true, composed: true }));
    expect(seen.length).to.equal(0);
    const nested = document.createElement('lr-tab-group');
    owned.append(nested);
    nested.dispatchEvent(new CustomEvent('lr-tab-show', { detail: { name: 'x' }, bubbles: true, composed: true }));
    expect(seen.length).to.equal(1);
  });
});

describe('drilldown panel breadcrumb focus', () => {
  it('keeps focus inside the panel after the focused crumb becomes current', async () => {
    const el = await fixture<LyraDrilldownPanel>(html`<lr-drilldown-panel .path=${[root, child]}></lr-drilldown-panel>`);
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector('lr-breadcrumb-item')!;
    await focusByKeyboard(first.shadowRoot!.querySelector<HTMLElement>('button, a')!);
    el.path = [root];
    await el.updateComplete;
    await waitUntil(() => el.matches(':focus-within') || el.shadowRoot!.querySelector(':focus-within') !== null, 'focus stays in the panel');
    expect(document.activeElement === document.body).to.equal(false);
  });
});

it('preserves min-content width for projected runs', async () => {
  const el = await fixture<LyraDrilldownPanel>(html`<lr-drilldown-panel .path=${[{ nodeId: 'root', label: 'Root' }]}>
    <div slot="runs"><div id="probe" style="inline-size:min-content">Unbreakable</div></div></lr-drilldown-panel>`);
  expect(el.querySelector('#probe')!.getBoundingClientRect().width).to.be.greaterThan(40);
});

it('uses the configured panel, category and pagination gaps', async () => {
  const node = { ...root, entities: [], evidence: Array.from({ length: 9 }, (_, i) => ({ evidenceId: String(i), title: 'Report' })) };
  const el = await fixture<LyraDrilldownPanel>(html`<lr-drilldown-panel .path=${[node]}
    style="--lr-drilldown-panel-gap:15px;--lr-drilldown-panel-category-gap:9px;--lr-drilldown-panel-pagination-gap:6px"></lr-drilldown-panel>`);
  for (const [part, gap] of [['base', '15px'], ['category', '9px'], ['pagination', '6px']]) {
    expect(getComputedStyle(el.shadowRoot!.querySelector(`[part~="${part}"]`)!).rowGap).to.equal(gap);
  }
});

it('focuses the current breadcrumb when the remaining path has no other control', async () => {
  const parent = { nodeId: 'root', label: 'Root' };
  const el = await fixture<LyraDrilldownPanel>(html`<lr-drilldown-panel .path=${[parent, child]}></lr-drilldown-panel>`);
  const first = el.shadowRoot!.querySelector('lr-breadcrumb-item')!;
  await focusByKeyboard(first.shadowRoot!.querySelector<HTMLElement>('button, a')!);
  el.path = [parent];
  await waitUntil(() => el.shadowRoot!.activeElement?.hasAttribute('current') === true, 'the remaining crumb receives focus');
});

it('focuses the panel surface when the focused breadcrumb path is cleared', async () => {
  const el = await fixture<LyraDrilldownPanel>(html`<lr-drilldown-panel .path=${[root, child]}></lr-drilldown-panel>`);
  const first = el.shadowRoot!.querySelector('lr-breadcrumb-item')!;
  await focusByKeyboard(first.shadowRoot!.querySelector<HTMLElement>('button, a')!);
  el.path = [];
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('part') === 'base');
});

it('leaves focus outside when navigation removes the panel during breadcrumb rendering', async () => {
  const el = await fixture<LyraDrilldownPanel>(html`<lr-drilldown-panel .path=${[root, child]}></lr-drilldown-panel>`);
  const first = el.shadowRoot!.querySelector('lr-breadcrumb-item')!;
  await focusByKeyboard(first.shadowRoot!.querySelector<HTMLElement>('button, a')!);
  el.path = [root];
  queueMicrotask(() => el.remove());
  await el.updateComplete;
  await nextFrame();
  expect(el.isConnected).to.equal(false);
  expect(document.activeElement === document.body).to.equal(true);
});
