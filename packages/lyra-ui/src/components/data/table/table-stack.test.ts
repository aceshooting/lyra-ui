import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { setViewport } from '@web/test-runner-commands';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
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

  describe('stack-header', () => {
    const plain: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      { key: 'score', label: 'Score', cell: (r) => String(r.score), sortable: true },
    ];
    async function stacked(stackHeader: string | null, cols = plain, dir = 'ltr', width = '640px'): Promise<LyraTable<Row>> {
      const wrap = await fixture<HTMLElement>(html`<div dir=${dir} style="inline-size: ${width}">
        <lr-table aria-label="Accounts" stack="always" stack-header=${stackHeader ?? ''}
          .columns=${cols} .rows=${rows} .rowKey=${(r: Row) => r.id}></lr-table>
      </div>`);
      const el = wrap.querySelector<LyraTable<Row>>('lr-table')!;
      if (stackHeader === null) el.removeAttribute('stack-header');
      await el.updateComplete;
      return el;
    }
    const header = (el: LyraTable<Row>, key: string) =>
      el.shadowRoot!.querySelector<HTMLElement>(`[part="header-cell"][data-col-key="${key}"]`)!;
    const shown = (node: HTMLElement) => getComputedStyle(node).position !== 'absolute' && node.getBoundingClientRect().width > 2;

    it('keeps every header in the strip by default (unset or unknown)', async () => {
      const el = await stacked(null);
      expect(el.stackHeader).to.equal('visible');
      expect(base(el).hasAttribute('data-stack-header')).to.equal(false);
      expect(shown(header(el, 'name'))).to.equal(true);
      expect(shown(header(el, 'score'))).to.equal(true);
      el.setAttribute('stack-header', 'compact');
      await el.updateComplete;
      expect(el.stackHeader).to.equal('visible');
    });

    it("'sortable' keeps only the sortable headers visible, the rest stay named and in the a11y tree", async () => {
      const el = await stacked('sortable');
      expect(el.getAttribute('stack-header')).to.equal('sortable');
      expect(shown(header(el, 'name')), 'non-sortable header hidden').to.equal(false);
      expect(shown(header(el, 'score')), 'sortable header stays').to.equal(true);
      expect(header(el, 'name').getAttribute('role')).to.equal('columnheader');
      expect(getComputedStyle(header(el, 'name')).display).to.not.equal('none');
      await expect(el).to.be.accessible();
      const sorted = oneEvent(el, 'lr-sort');
      header(el, 'score').click();
      expect((await sorted).detail.sortKey).to.equal('score');
    });

    it("'sortable' with no sortable column and 'hidden' remove the strip's visible height", async () => {
      for (const [mode, cols] of [['sortable', plain.map(({ sortable: _s, ...c }) => c as TableColumn<Row>)], ['hidden', plain]] as const) {
        const el = await stacked(mode, cols as TableColumn<Row>[]);
        const head = el.shadowRoot!.querySelector<HTMLElement>('[part="head"]')!;
        const firstRow = el.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
        expect(head.getBoundingClientRect().height, `${mode}: head collapses`).to.be.at.most(2);
        const tableTop = el.shadowRoot!.querySelector<HTMLElement>('[part="table"]')!.getBoundingClientRect().top;
        expect(firstRow.getBoundingClientRect().top - tableTop, `${mode}: first card starts at the top`).to.be.lessThan(4);
        await expect(el).to.be.accessible();
      }
    });

    it('shows a hidden header while it holds keyboard focus', async () => {
      const el = await stacked('hidden');
      const name = header(el, 'name');
      await focusByKeyboard(name);
      expect(el.shadowRoot!.activeElement === name).to.equal(true);
      const head = el.shadowRoot!.querySelector<HTMLElement>('[part="head"]')!;
      expect(getComputedStyle(head).position, 'focused strip is not visually hidden').to.not.equal('absolute');
      expect(name.getBoundingClientRect().height, 'focused header is shown').to.be.greaterThan(10);
      await sendKeys({ press: 'ArrowRight' });
      expect(el.shadowRoot!.activeElement === header(el, 'score')).to.equal(true);
    });

    it('has no effect while the grid is not stacked', async () => {
      const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 900px">
        <lr-table aria-label="Accounts" stack="auto" stack-header="hidden"
          .columns=${plain} .rows=${rows} .rowKey=${(r: Row) => r.id}></lr-table>
      </div>`);
      const el = wrap.querySelector<LyraTable<Row>>('lr-table')!;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      expect(base(el).hasAttribute('data-stacked')).to.equal(false);
      expect(base(el).hasAttribute('data-stack-header')).to.equal(false);
      expect(shown(header(el, 'name'))).to.equal(true);
    });

    it('stays inside a 320px allocation in both directions', async () => {
      for (const dir of ['ltr', 'rtl']) {
        const el = await stacked('sortable', plain, dir, '320px');
        const wrap = el.parentElement!;
        expect(wrap.scrollWidth, `${dir}: no overflow`).to.be.at.most(wrap.clientWidth + 1);
        expect(base(el).scrollWidth, `${dir}: base does not scroll`).to.be.at.most(base(el).clientWidth + 1);
        await expect(el).to.be.accessible();
      }
    });
  });

  it('spans the stacked caption across the cards', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 390px">
      <lr-table caption="Quarterly accounts by region" stack="always"
        .columns=${columns} .rows=${rows} .rowKey=${(r: Row) => r.id}></lr-table>
    </div>`);
    const el = wrap.querySelector<LyraTable<Row>>('lr-table')!;
    await el.updateComplete;
    const caption = el.shadowRoot!.querySelector<HTMLElement>('[part="caption"]')!;
    const row = el.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
    expect(caption.getBoundingClientRect().width).to.be.closeTo(row.getBoundingClientRect().width, 2);
    await expect(el).to.be.accessible();
  });

  it('keeps a preserving cellStyle white-space from opening a gap before the stacked label', async () => {
    const cols: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name, cellStyle: () => ({ whiteSpace: 'pre-wrap' }) },
      { key: 'score', label: 'Score', cell: (r) => String(r.score) },
    ];
    const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 640px">
      <lr-table aria-label="Accounts" stack="always" .columns=${cols} .rows=${rows} .rowKey=${(r: Row) => r.id}></lr-table>
    </div>`);
    const el = wrap.querySelector<LyraTable<Row>>('lr-table')!;
    await el.updateComplete;
    const [styled, plainCell] = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')[0]!.querySelectorAll<HTMLElement>('[part="cell"]'));
    const offset = (cell: HTMLElement) =>
      cell.querySelector('[part="cell-label"]')!.getBoundingClientRect().top - cell.getBoundingClientRect().top;
    expect(offset(styled!)).to.be.closeTo(offset(plainCell!), 1);
    expect(styled!.getBoundingClientRect().height).to.be.closeTo(plainCell!.getBoundingClientRect().height, 1);
  });
});
