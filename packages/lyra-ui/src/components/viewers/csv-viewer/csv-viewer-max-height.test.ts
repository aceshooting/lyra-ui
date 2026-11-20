import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-csv-viewer.js';
import type { LyraCsvViewer } from '../../lr-csv-viewer.js';

function csv(rowCount: number): string {
  return ['Name,Role', ...Array.from({ length: rowCount }, (_v, i) => `n${i},r${i}`)].join('\n');
}

async function mount(rowCount: number, maxHeight: string): Promise<LyraCsvViewer> {
  const original = window.fetch;
  window.fetch = (() => Promise.resolve(new Response(csv(rowCount)))) as typeof window.fetch;
  try {
    const el = await fixture<LyraCsvViewer>(html`<lr-csv-viewer max-height=${maxHeight} src="/a.csv"></lr-csv-viewer>`);
    await waitUntil(() => (el.shadowRoot!.querySelector('[part="rows"]')?.shadowRoot?.querySelectorAll('[part~="data-row"]').length ?? 0) > 0, 'rows did not render');
    return el;
  } finally {
    window.fetch = original;
  }
}

describe('lr-csv-viewer max-height', () => {
  it('shrinks to a short table instead of reserving the full list height', async () => {
    const el = await mount(2, '40rem');
    const rows = el.shadowRoot!.querySelector<HTMLElement>('[part="rows"]')!;
    expect(rows.getBoundingClientRect().height).to.be.lessThan(160);
  });

  it('caps a long table at the max-height with a single scroll container', async () => {
    const el = await mount(300, '10rem');
    const rows = el.shadowRoot!.querySelector<HTMLElement>('[part="rows"]')!;
    const cap = parseFloat(getComputedStyle(el).fontSize) * 10;
    expect(rows.getBoundingClientRect().height).to.be.at.most(cap + 1);
    const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]');
    if (body) expect(body.scrollHeight).to.be.at.most(body.clientHeight + 1);
  });
});

it('isolates cell and heading text in RTL tables', async () => {
  const el = await mount(2, '20rem');
  el.dir = 'rtl';
  const list = el.shadowRoot!.querySelector('[part="rows"]')!;
  const header = el.shadowRoot!.querySelector('[role="columnheader"] bdi');
  const cell = list.shadowRoot!.querySelector('[role="cell"] bdi');
  expect(header?.getAttribute('dir')).to.equal('auto');
  expect(cell?.getAttribute('dir')).to.equal('auto');
});
