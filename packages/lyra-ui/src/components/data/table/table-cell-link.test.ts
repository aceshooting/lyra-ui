import { fixture, expect, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../../lr-table.js';
import type { LyraTable, TableColumn } from '../../lr-table.js';
import { installTableTestHooks, type Row, rows } from '../../../../test/table.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
installTableTestHooks();

const linkColumns = (extra: Partial<TableColumn<Row>> = {}): TableColumn<Row>[] => [
  { key: 'name', label: 'Name', cell: (r) => r.name, href: (r) => `#/accounts/${r.id}`, ...extra } as TableColumn<Row>,
  { key: 'score', label: 'Score', cell: (r) => String(r.score) },
];

async function table(columns: TableColumn<Row>[]): Promise<LyraTable<Row>> {
  const el = await fixture<LyraTable<Row>>(html`<lr-table
    aria-label="Accounts" .columns=${columns} .rows=${rows} .rowKey=${(r: Row) => r.id}
  ></lr-table>`);
  await el.updateComplete;
  return el;
}
const links = (el: LyraTable<Row>) => Array.from(el.shadowRoot!.querySelectorAll<HTMLAnchorElement>('[part="cell-link"]'));

describe('lr-table column href', () => {
  it('renders a real anchor per row with the content inside and no rel for a same-tab link', async () => {
    const el = await table(linkColumns());
    expect(links(el).map((a) => [a.getAttribute('href'), a.textContent?.trim(), a.hasAttribute('rel'), a.hasAttribute('target')]))
      .to.deep.equal([['#/accounts/a', 'Alpha', false, false], ['#/accounts/b', 'Beta', false, false]]);
    expect(el.shadowRoot!.querySelectorAll('[part="cell"] a').length).to.equal(2);
    await expect(el).to.be.accessible();
  });

  it('guards rel whenever target is set, merging author tokens and dropping opener', async () => {
    const el = await table(linkColumns({ target: '_blank', rel: 'nofollow OPENER' }));
    expect(links(el).map((a) => [a.target, a.rel])).to.deep.equal([
      ['_blank', 'nofollow noopener noreferrer'], ['_blank', 'nofollow noopener noreferrer'],
    ]);
  });

  it('renders plain content for unsafe, empty, non-string and throwing href results', async () => {
    const results: unknown[] = ['javascript:alert(1)', '', 42];
    const el = await table([
      { key: 'name', label: 'Name', cell: (r) => r.name, href: (r) => (r.id === 'a' ? results.shift() : undefined) as string | undefined },
      { key: 'score', label: 'Score', cell: (r) => String(r.score), href: () => { throw new Error('no route'); } },
    ]);
    expect(links(el).length).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="cell"]')?.textContent?.trim()).to.equal('Alpha');
    el.columns = linkColumns({ cellPart: () => 'cell-primary' });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="cell-link"] > [part~="cell-content"]')?.getAttribute('part'))
      .to.equal('cell-content cell-primary');
  });

  it('lets Enter and a click on the link navigate natively without row activation', async () => {
    const el = await table(linkColumns());
    let activations = 0;
    const seen: boolean[] = [];
    el.addEventListener('lr-row-activate', () => { activations += 1; });
    el.addEventListener('keydown', (event) => { seen.push(event.defaultPrevented); });
    el.addEventListener('click', (event) => {
      seen.push(event.defaultPrevented);
      event.preventDefault(); // keep the test page in place
    });
    const [first] = links(el);
    await focusByKeyboard(first!);
    await sendKeys({ press: 'Enter' });
    first!.click();
    expect(seen).to.deep.equal([false, false, false]);
    expect(activations).to.equal(0);
    // A click elsewhere in the same row still activates it.
    (el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')[1]!).click();
    expect(activations).to.equal(1);
  });
});
