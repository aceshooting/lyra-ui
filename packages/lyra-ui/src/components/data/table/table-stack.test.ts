import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { setViewport } from '@web/test-runner-commands';
import '../../lr-table.js';
import type { LyraTable, TableColumn } from '../../lr-table.js';
import { installTableTestHooks, type Row, rows } from '../../../../test/table.js';
installTableTestHooks();

const columns: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', cell: (r) => r.name, sortable: true, sticky: 'start' },
  { key: 'score', label: 'Score', cell: (r) => String(r.score), sortable: true, align: 'end' },
];

async function table(width: string, stack: string, style = ''): Promise<LyraTable<Row>> {
  const wrap = await fixture<HTMLElement>(html`<div style="inline-size: ${width}">
    <lr-table aria-label="Accounts" stack=${stack} style=${style} selection-mode="single"
      .columns=${columns} .rows=${rows} .rowKey=${(r: Row) => r.id}></lr-table>
  </div>`);
  const el = wrap.querySelector<LyraTable<Row>>('lr-table')!;
  await el.updateComplete;
  return el;
}
const base = (el: LyraTable<Row>) => el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
const labels = (el: LyraTable<Row>) => Array.from(el.shadowRoot!.querySelectorAll('[part="cell-label"]'), (n) => n.textContent);

describe('lr-table stack', () => {
  it('sizes the stacked caption from --lr-table-stack-label-inline-size', async () => {
    const el = await table('640px', 'always', '--lr-table-stack-label-inline-size: 90px');
    const label = el.shadowRoot!.querySelector<HTMLElement>('[part="cell-label"]')!;
    expect(getComputedStyle(label).inlineSize).to.equal('90px');
  });

  it('always stacks rows as blocks with visible column captions and unchanged roles', async () => {
    const el = await table('640px', 'always');
    expect(base(el).hasAttribute('data-stacked')).to.equal(true);
    expect(labels(el)).to.deep.equal(['Name', 'Score', 'Name', 'Score']);
    const row = el.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
    expect(getComputedStyle(row).display).to.equal('block');
    expect(row.getAttribute('role')).to.equal('row');
    const [first, second] = Array.from(row.querySelectorAll<HTMLElement>('[part="cell"]'));
    expect(first!.getAttribute('role')).to.equal('gridcell');
    expect(second!.getBoundingClientRect().top).to.be.at.least(first!.getBoundingClientRect().bottom - 1);
    expect(el.shadowRoot!.querySelector('[part="cell-label"]')!.getAttribute('aria-hidden')).to.equal('true');
    await expect(el).to.be.accessible();
    const sorted = oneEvent(el, 'lr-sort');
    el.shadowRoot!.querySelectorAll<HTMLElement>('[part="header-cell"]')[1]!.click();
    expect((await sorted).detail.sortKey).to.equal('score');
    const selected = oneEvent(el, 'lr-selection-change');
    first!.click();
    expect([...(await selected).detail.selectedRowKeys]).to.deep.equal(['a']);
  });

  it('auto stacks only below the live-resolved breakpoint token', async () => {
    const narrow = await table('320px', 'auto');
    await waitUntil(() => base(narrow).hasAttribute('data-stacked'), 'a 320px allocation stacks');
    expect(labels(narrow).length).to.equal(4);
    const wide = await table('900px', 'auto');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(base(wide).hasAttribute('data-stacked')).to.equal(false);
    expect(labels(wide)).to.deep.equal([]);
    const tuned = await table('320px', 'auto', '--lr-table-stack-breakpoint: 12em');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(base(tuned).hasAttribute('data-stacked')).to.equal(false);
    narrow.parentElement!.style.inlineSize = '900px';
    await waitUntil(() => !base(narrow).hasAttribute('data-stacked'), 'growing past the breakpoint unstacks');
  });

  it('measures its breakpoint without widening a 320px page, in both directions', async () => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    try {
      await setViewport({ width: 320, height: 640 });
      for (const dir of ['ltr', 'rtl'] as const) {
        document.documentElement.dir = dir;
        const wrap = await fixture<HTMLElement>(html`<div dir=${dir}>
          <lr-table aria-label="Accounts" stack="auto" .columns=${columns} .rows=${rows} .rowKey=${(r: Row) => r.id}></lr-table>
        </div>`);
        const el = wrap.querySelector<LyraTable<Row>>('lr-table')!;
        await waitUntil(() => base(el).hasAttribute('data-stacked'), `${dir}: a 320px viewport stacks`);
        expect(document.documentElement.scrollWidth, `${dir}: no horizontal page scroll`).to.be.at.most(window.innerWidth);
      }
    } finally {
      document.documentElement.removeAttribute('dir');
      await setViewport(viewport);
    }
  });

  it('keeps its breakpoint probe out of a positioned scrolling ancestor at 320px', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="position: relative; overflow: auto; inline-size: 320px">
      <lr-table aria-label="Accounts" stack="auto" .columns=${columns} .rows=${rows} .rowKey=${(r: Row) => r.id}></lr-table>
    </div>`);
    const el = wrap.querySelector<LyraTable<Row>>('lr-table')!;
    await waitUntil(() => base(el).hasAttribute('data-stacked'), 'a 320px allocation stacks');
    expect(wrap.scrollWidth, 'no horizontal overflow from the probe').to.be.at.most(wrap.clientWidth);
  });

  it('keeps the grid by default and normalizes unknown values', async () => {
    const el = await table('320px', 'never');
    expect(el.shadowRoot!.querySelector('.stack-probe') === null).to.equal(true);
    el.setAttribute('stack', 'cards');
    await el.updateComplete;
    expect(el.stack).to.equal('never');
    expect(base(el).hasAttribute('data-stacked')).to.equal(false);
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="row"]')!).display).to.equal('table-row');
  });
});
