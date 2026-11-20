import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-dataset-viewer.js';
import type { LyraDatasetViewer } from '../../lr-dataset-viewer.js';

const source = `data:text/csv,${encodeURIComponent(['name,value', ...Array.from({ length: 80 }, (_, index) => `Row ${index},${index}`)].join('\n'))}`;

it('keeps a populated page-mode header at the page scrollport while table rows continue below it', async () => {
  const previous = window.scrollY;
  const stage = await fixture<HTMLDivElement>(html`<div style="padding-block-start:120px;padding-block-end:120vh">
    <lr-dataset-viewer scroll-mode="page" max-height="160px" src=${source}></lr-dataset-viewer>
  </div>`);
  const viewer = stage.querySelector<LyraDatasetViewer>('lr-dataset-viewer')!;
  await waitUntil(() => viewer.shadowRoot!.querySelector('[part="header-row"]') !== null);
  const base = viewer.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const header = viewer.shadowRoot!.querySelector<HTMLElement>('[part="header-row"]')!;
  const table = viewer.shadowRoot!.querySelector<HTMLElement>('[part="table"]')!;
  try {
    const target = base.getBoundingClientRect().top + window.scrollY + 100;
    window.scrollTo({ top: target, behavior: 'instant' });
    await waitUntil(() => Math.abs(window.scrollY - target) < 1);
    expect(table.getBoundingClientRect().bottom).to.be.greaterThan(header.getBoundingClientRect().height);
    expect(header.getBoundingClientRect().top).to.be.closeTo(0, 1);
    expect(parseFloat(getComputedStyle(base).borderTopWidth)).to.be.greaterThan(0);
    expect(parseFloat(getComputedStyle(base).borderTopLeftRadius)).to.be.greaterThan(0);
  } finally {
    window.scrollTo({ top: previous, behavior: 'instant' });
  }
});

it('preserves self-contained default scrolling and its sticky header', async () => {
  const viewer = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer max-height="160px" src=${source}></lr-dataset-viewer>`);
  await waitUntil(() => viewer.shadowRoot!.querySelector('[part="header-row"]') !== null);
  const base = viewer.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const body = viewer.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  const header = viewer.shadowRoot!.querySelector<HTMLElement>('[part="header-row"]')!;
  expect(viewer.scrollMode).to.equal('self');
  expect(getComputedStyle(base).overflowX).to.equal('hidden');
  body.scrollTop = 100;
  await waitUntil(() => body.scrollTop > 0);
  expect(header.getBoundingClientRect().top).to.be.closeTo(body.getBoundingClientRect().top, 1);
});

it('keeps page-mode horizontal overflow visible outside a narrow host', async () => {
  const viewer = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer style="inline-size:200px" scroll-mode="page" src=${source}></lr-dataset-viewer>`);
  await waitUntil(() => viewer.shadowRoot!.querySelector('[part="header-row"]') !== null);
  const base = viewer.shadowRoot!.querySelector('[part="base"]')!.getBoundingClientRect();
  const header = viewer.shadowRoot!.querySelector('[part="header-row"]')!.getBoundingClientRect();
  expect(header.right).to.be.greaterThan(base.right + 10);
  expect(document.elementFromPoint(base.right + 10, header.top + header.height / 2) === viewer).to.equal(true);
});

it('gives a capped, overflowing self-scrolling body a named tab stop only while it overflows', async () => {
  const viewer = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer max-height="120px" src=${source}></lr-dataset-viewer>`);
  await waitUntil(() => viewer.shadowRoot!.querySelector('[part="header-row"]') !== null);
  const body = viewer.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  await waitUntil(() => body.getAttribute('tabindex') === '0', 'overflowing body never became focusable');
  expect([body.getAttribute('role'), body.getAttribute('aria-label')]).to.deep.equal(['region', 'Dataset']);
  viewer.name = 'Sales';
  await viewer.updateComplete;
  // The scroll body keeps its purpose name instead of repeating the dataset region's name.
  expect(body.getAttribute('aria-label')).to.equal('Dataset');
  viewer.maxHeight = '400rem';
  await waitUntil(() => !body.hasAttribute('tabindex'), 'short body kept its tab stop');
  viewer.maxHeight = '120px';
  await waitUntil(() => body.getAttribute('tabindex') === '0');
  viewer.scrollMode = 'page';
  await viewer.updateComplete;
  expect(body.hasAttribute('tabindex')).to.equal(false);
});

it('leaves the frame as the only edge below the last row while earlier rows keep their divider', async () => {
  const short = `data:text/csv,${encodeURIComponent('name,status\nAda,Active\nGrace,Active')}`;
  const viewer = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer src=${short}></lr-dataset-viewer>`);
  const rowsOf = () => [...viewer.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll<HTMLElement>('[part~="data-row"]') ?? []];
  await waitUntil(() => rowsOf().length === 2, 'data rows did not render');
  const cellEdge = (row: HTMLElement) => parseFloat(getComputedStyle(row.querySelector<HTMLElement>('[part~="cell"]')!).borderBottomWidth);
  const [first, last] = rowsOf();
  expect(cellEdge(first!)).to.be.greaterThan(0);
  expect(cellEdge(last!)).to.equal(0);
  const base = viewer.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect(parseFloat(getComputedStyle(base).borderBottomWidth)).to.be.greaterThan(0);
  // Rows settle after their first measurement; the frame then hugs the last row.
  const frame = parseFloat(getComputedStyle(base).borderBottomWidth);
  await waitUntil(() => base.getBoundingClientRect().bottom - last!.getBoundingClientRect().bottom <= frame + 0.5, 'the frame did not close on the last row');
});
