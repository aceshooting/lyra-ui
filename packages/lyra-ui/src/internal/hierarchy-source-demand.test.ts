import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { LitElement } from 'lit';
import type { LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchySource } from '../data-sources.js';
import { HierarchySourceController } from './hierarchy-source-controller.js';
import { hierarchySourceView } from './hierarchy-source-view.js';
import { expectDevWarning } from '../../test/expected-dev-warnings.js';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import '../components/layout/virtual-list/virtual-list.js';

class DemandHost extends LitElement {
  paints = 0;
  viewport = 12000;
  readonly control = new HierarchySourceController<string>(this, {
    normalize: value => { if (typeof value !== 'string') throw new TypeError('Expected string'); return value; },
    onChange: () => this.requestUpdate(), accepted: () => {},
    payload: { maxUnits: 2_000_000, maxRowUnits: 6010, unitsOf: value => value.length },
  });
  override render() {
    this.paints++;
    return html`<style>lr-virtual-list { --lr-virtual-list-height:${this.viewport}px } [part~="source-row"] { height:40px }</style>${hierarchySourceView(this.control, {
      label: 'Rows', rtl: false, multiple: false, loading: 'Loading rows', error: 'Unable to load rows', empty: 'No rows',
      retry: 'Retry', expand: 'Expand', collapse: 'Collapse', summary: 'Rows', name: value => value.slice(0, 8),
      content: value => value.slice(0, 8), select: () => {},
    })}`;
  }
}
customElements.define('test-hierarchy-demand', DemandHost);
const row = (index: number): LyraHierarchyRow<string> => ({ key: `k${index}`, parentKey: null, value: 'x'.repeat(6000),
  level: 1, position: index + 1, setSize: 1_000_000, childCount: 0, selected: false, expanded: false });
async function settle(host: DemandHost, frames = 8) {
  for (let i = 0; i < frames; i++) { await host.updateComplete; await host.control.list?.updateComplete; await nextFrame(); }
}

it('admits the real unaligned hierarchy viewport before reads and settles weighted page errors without churn', async () => {
  expectDevWarning('virtual-list-scroll-scaling');
  const host = await fixture<DemandHost>(html`<test-hierarchy-demand></test-hierarchy-demand>`);
  const control = host.control;
  let demand: readonly [number, number] | undefined;
  let reads = 0;
  const starts: number[] = [];
  const requestRange = control.requestRange.bind(control);
  control.requestRange = (start, end) => { demand = [start, end]; requestRange(start, end); };
  const source: LyraHierarchySource<string, LyraHierarchyQuery> = { revision: 1, async project() {
    return { state: 'state', total: 1_000_000, rows: { count: 1_000_000,
      indexOfKey: async (key: string) => Number(String(key).slice(1)),
      async read(request) {
        reads++; starts.push(request.offset);
        expect(demand !== undefined).to.equal(true);
        return Array.from({ length: request.limit }, (_, offset) => row(request.offset + offset));
      },
    } };
  } };
  control.update(source, 'en');
  expect(await control.whenReady()).to.equal(true);
  await waitUntil(() => Boolean(control.list));
  await settle(host);
  control.list!.scrollToIndex(155, { align: 'start', behavior: 'auto' });
  await settle(host, 16);
  expect(demand![1] - demand![0]).to.equal(301);
  expect(demand![0] % 100).to.not.equal(0);
  expect(Math.floor((demand![1] - 1) / 100) - Math.floor(demand![0] / 100) + 1).to.equal(4);
  const list = control.list!;
  expect(list.renderedRows.length).to.equal(301);
  expect(list.querySelectorAll('[part~="source-error"]').length).to.be.greaterThan(0);
  const beforeReads = reads;
  const beforePaints = host.paints;
  await settle(host, 16);
  expect(reads).to.equal(beforeReads);
  expect(host.paints - beforePaints).to.be.at.most(1);
  expect(new Set(starts).size).to.be.at.most(6);
});

it('retains the separately budgeted focused row without reading the gap to a distant viewport', async () => {
  expectDevWarning('virtual-list-scroll-scaling');
  const host = await fixture<DemandHost>(html`<test-hierarchy-demand></test-hierarchy-demand>`);
  host.viewport = 160;
  const reads: number[] = [];
  const source: LyraHierarchySource<string, LyraHierarchyQuery> = { revision: 1, async project() {
    return { state: 'state', total: 1_000_000, rows: { count: 1_000_000,
      indexOfKey: async (key: string) => Number(String(key).slice(1)),
      async read(request) {
        reads.push(request.offset);
        return Array.from({ length: request.limit }, (_, offset) => row(request.offset + offset));
      },
    } };
  } };
  host.control.update(source, 'en');
  expect(await host.control.whenReady()).to.equal(true);
  await waitUntil(() => Boolean(host.control.list?.querySelector('[data-source-key="k0"]')));
  const list = host.control.list!;
  await settle(host);
  await focusByKeyboard(list.querySelector<HTMLElement>('[data-source-key="k0"]')!);
  reads.length = 0;
  list.scrollToIndex(999_999, { align: 'end', behavior: 'auto' });
  await settle(host, 16);
  expect(list.querySelector('[data-source-key="k0"]')?.matches(':focus')).to.equal(true);
  expect(list.querySelector('[data-source-key="k999999"]') !== null).to.equal(true);
  expect(reads.length).to.be.greaterThan(0);
  expect(reads.every(offset => offset >= 999_900)).to.equal(true);
  const before = reads.length;
  await settle(host, 12);
  expect(reads.length).to.equal(before);
  expect(list.renderedRows.length).to.be.at.most(301);
});
