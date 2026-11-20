import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import type { LyraSankey, LyraSankeyLink, LyraSankeyNode } from './sankey.class.js';
import '../../lr-sankey.js';

const NODES: readonly LyraSankeyNode[] = [
  { id: 'direct', label: 'Direct visits' },
  { id: 'referral', label: 'Referrals' },
  { id: 'trial', label: 'Trial' },
  { id: 'paid', label: 'Paid' },
];
const LINKS: readonly LyraSankeyLink[] = [
  { id: 'direct-trial', source: 'direct', target: 'trial', value: 60, label: 'Direct trials' },
  { id: 'referral-trial', source: 'referral', target: 'trial', value: 40, label: 'Referred trials' },
  { id: 'trial-paid', source: 'trial', target: 'paid', value: 100, label: 'Converted trials' },
];

const formatValue = (value: number) => `${value} people`;

function marks(el: LyraSankey, part: 'node' | 'link'): SVGGElement[] {
  return [...el.shadowRoot!.querySelectorAll<SVGGElement>(`[part~="${part}"][role="button"]`)];
}

function mark(el: LyraSankey, part: 'node' | 'link', name: string): SVGGElement {
  const match = marks(el, part).find((item) => item.getAttribute('aria-label')?.includes(name));
  if (!match) throw new Error(`Expected a ${part} for ${name}`);
  return match;
}

function focusName(el: LyraSankey): string | null | undefined {
  return el.shadowRoot!.activeElement?.getAttribute('aria-label');
}

function partText(el: LyraSankey, part: string): string {
  return el.shadowRoot!.querySelector(`[part~="${part}"]`)?.textContent?.trim() ?? '';
}

describe('<lr-sankey>', () => {
  it('renders a named flow with interactive nodes and links and an accessible data table', async () => {
    const el = await fixture<LyraSankey>(html`
      <lr-sankey
        label="Trial conversions"
        description="Direct and referred visitors flow through trial to paid accounts"
        .nodes=${NODES}
        .links=${LINKS}
        .valueFormatter=${formatValue}
      ></lr-sankey>
    `);
    const svg = el.shadowRoot!.querySelector('svg[role="group"]')!;
    expect(svg.getAttribute('aria-label')).to.equal('Trial conversions');
    expect(el.shadowRoot!.getElementById(svg.getAttribute('aria-describedby') ?? '')?.textContent?.trim())
      .to.equal('Direct and referred visitors flow through trial to paid accounts');
    expect(marks(el, 'node').length).to.equal(4);
    expect(marks(el, 'link').length).to.equal(3);
    expect(svg.querySelectorAll('[tabindex="0"]').length).to.equal(1);
    expect(partText(el, 'legend')).to.include('Direct visits').and.include('Referrals');
    expect(partText(el, 'legend')).not.to.include('Paid');
    expect(mark(el, 'node', 'Trial').getAttribute('aria-label')).to.include('100 people');
    expect(mark(el, 'link', 'Direct trials').getAttribute('aria-label')).to.include('60 people');
    expect(el.shadowRoot!.querySelector('[part~="data-table-toggle"]') === null).to.equal(true);
    const rows = [...el.shadowRoot!.querySelectorAll('tbody tr')];
    expect(rows.length).to.equal(3);
    expect(rows.map((row) => row.textContent?.replace(/\s+/g, ' ').trim()).join(' '))
      .to.include('Direct visits').and.include('Trial').and.include('60 people');
    await expect(el).to.be.accessible();

    el.setAttribute('aria-label', 'Quarterly conversions');
    await el.updateComplete;
    expect(svg.getAttribute('aria-label')).to.equal('Quarterly conversions');
  });

  it('discloses the formatted link table on keyboard activation', async () => {
    const el = await fixture<LyraSankey>(html`
      <lr-sankey data-table-toggle .nodes=${NODES} .links=${LINKS} .valueFormatter=${formatValue}></lr-sankey>
    `);
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="data-table-toggle"]')!;
    const table = el.shadowRoot!.querySelector('table')!;
    expect(button.getAttribute('aria-controls')).to.equal(table.id);
    expect(button.getAttribute('aria-expanded')).to.equal('false');

    await focusByKeyboard(button);
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(button.getAttribute('aria-expanded')).to.equal('true');
    expect(table.getBoundingClientRect().height).to.be.greaterThan(1);
    expect(table.tBodies[0]?.textContent).to.include('100 people');
    await expect(el).to.be.accessible();

    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(button.getAttribute('aria-expanded')).to.equal('false');
  });

  it('emits distinct node and link activation details', async () => {
    const el = await fixture<LyraSankey>(html`<lr-sankey .nodes=${NODES} .links=${LINKS}></lr-sankey>`);
    const activated: { detail: unknown; bubbles: boolean; composed: boolean }[] = [];
    el.addEventListener('lr-datum-activate', (event) => {
      const { detail, bubbles, composed } = event as CustomEvent<unknown>;
      activated.push({ detail, bubbles, composed });
    });
    await focusByKeyboard(mark(el, 'node', 'Trial'));
    await sendKeys({ press: 'Enter' });
    await focusByKeyboard(mark(el, 'link', 'Direct trials'));
    await sendKeys({ press: 'Enter' });

    expect(activated).to.deep.equal([
      { detail: { kind: 'node', id: 'trial', label: 'Trial', value: 100 }, bubbles: true, composed: true },
      {
        detail: { kind: 'link', id: 'direct-trial', label: 'Direct trials', value: 60, source: 'direct', target: 'trial' },
        bubbles: true,
        composed: true,
      },
    ]);
  });

  it('moves through stage nodes and into the link sequence with the arrow keys', async () => {
    const el = await fixture<LyraSankey>(html`<lr-sankey .nodes=${NODES} .links=${LINKS}></lr-sankey>`);
    await focusByKeyboard(mark(el, 'node', 'Paid'));
    await sendKeys({ press: 'ArrowRight' });
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('link');

    await sendKeys({ press: 'ArrowLeft' });
    expect(focusName(el)).to.include('Paid');
    await sendKeys({ press: 'End' });
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('link');
    await sendKeys({ press: 'Home' });
    expect(el.shadowRoot!.activeElement === marks(el, 'node')[0]).to.equal(true);
  });

  it('opens formatted link details on keyboard focus and dismisses them with Escape', async () => {
    const el = await fixture<LyraSankey>(html`
      <lr-sankey .nodes=${NODES} .links=${LINKS} .valueFormatter=${formatValue}></lr-sankey>
    `);
    await focusByKeyboard(mark(el, 'link', 'Direct trials'));
    await waitUntil(() => partText(el, 'tooltip').includes('60 people'));
    expect(partText(el, 'tooltip')).to.include('Direct trials');
    await expect(el).to.be.accessible();

    await sendKeys({ press: 'Escape' });
    await waitUntil(() => partText(el, 'tooltip') === '');
    expect(focusName(el)).to.include('Direct trials');
  });

  it('reveals a node tooltip on hover and dismisses it on pointer exit', async () => {
    const el = await fixture<LyraSankey>(html`
      <lr-sankey .nodes=${NODES} .links=${LINKS} .valueFormatter=${formatValue}></lr-sankey>
    `);
    try {
      const bar = mark(el, 'node', 'Direct visits').querySelector('rect')!;
      await hoverUntilMatched(bar, 'The direct visits node did not receive hover');
      await waitUntil(() => partText(el, 'tooltip').includes('60 people'));
      expect(partText(el, 'tooltip')).to.include('Direct visits');
    } finally {
      await resetMouse();
    }
    await waitUntil(() => partText(el, 'tooltip') === '');
  });

  it('fits a 320px RTL panel and reverses the logical stage positions', async () => {
    const el = await fixture<LyraSankey>(html`
      <lr-sankey dir="rtl" style="inline-size: 320px"
        .nodes=${[{ ...NODES[0]!, label: 'Direct campaign visits from regional landing pages' }, ...NODES.slice(1)]}
        .links=${LINKS}
      ></lr-sankey>
    `);
    expect(el.clientWidth).to.equal(320);
    expect(el.scrollWidth).to.be.at.most(321);
    const direct = mark(el, 'node', 'Direct campaign visits');
    const paid = mark(el, 'node', 'Paid');
    const stagePosition = (node: SVGGElement) => node.querySelector('rect')!.getBoundingClientRect().left;
    expect(stagePosition(direct)).to.be.greaterThan(stagePosition(paid));
    const nodes = marks(el, 'node');
    await focusByKeyboard(nodes[0]!);
    await sendKeys({ press: 'ArrowLeft' });
    expect(el.shadowRoot!.activeElement === nodes[1]).to.equal(true);
  });

  it('ignores invalid links and replaces a cyclic graph with a localized status', async () => {
    const el = await fixture<LyraSankey>(html`
      <lr-sankey
        .nodes=${NODES}
        .links=${[
          ...LINKS,
          { source: 'direct', target: 'missing', value: 30 },
          { source: 'direct', target: 'paid', value: Infinity },
          { source: 'referral', target: 'trial', value: 0 },
        ]}
        .strings=${{ circularReference: 'Cycle found in this flow' }}
      ></lr-sankey>
    `);

    expect(marks(el, 'link').length).to.equal(3);
    el.links = [...LINKS, { source: 'paid', target: 'direct', value: 1 }];
    await el.updateComplete;
    expect(marks(el, 'link').length).to.equal(0);
    expect(partText(el, 'error')).to.equal('Cycle found in this flow');

    el.links = LINKS;
    await el.updateComplete;
    expect(partText(el, 'error')).to.equal('');
    expect(marks(el, 'link').length).to.equal(3);
  });

  it('takes a detached snapshot of caller records and restores a tab stop when a link disappears', async () => {
    const source = { id: 'source', label: 'Intake' };
    const nodes = [source, { id: 'target', label: 'Review' }];
    const link = { source: 'source', target: 'target', value: 15 };
    const el = await fixture<LyraSankey>(html`
      <lr-sankey .nodes=${nodes} .links=${[link]} .valueFormatter=${formatValue}></lr-sankey>
    `);
    await focusByKeyboard(marks(el, 'link')[0]!);
    source.label = 'Changed source';
    link.value = 85;
    el.description = 'An intake moves into review';
    await el.updateComplete;
    expect(mark(el, 'node', 'Intake').getAttribute('aria-label')).to.include('15 people');
    expect(focusName(el)).to.include('15 people');

    el.links = [{ source: 'source', target: 'target', value: 12, id: 'replacement' }];
    await el.updateComplete;
    expect(marks(el, 'link').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('g[tabindex="0"]').length).to.equal(1);
    expect(marks(el, 'link')[0]?.getAttribute('aria-label')).to.include('12 people');
    expect(partText(el, 'tooltip')).not.to.include('15 people');
  });

  it('shows a localized notice when the input node count exceeds its limit', async () => {
    const nodes = [...NODES, ...Array<LyraSankeyNode>(1000).fill(NODES[0]!)];
    const el = await fixture<LyraSankey>(html`
      <lr-sankey .nodes=${nodes} .links=${LINKS}
        .strings=${{ chartInputLimit: 'Only part of this graph is shown' }}
      ></lr-sankey>
    `);
    expect(marks(el, 'node').length).to.equal(4);
    expect(marks(el, 'link').length).to.equal(3);
    expect(partText(el, 'limit')).to.equal('Only part of this graph is shown');
  });

  it('uses localized loading and empty states as the graph updates', async () => {
    const el = await fixture<LyraSankey>(html`
      <lr-sankey loading .nodes=${NODES} .links=${LINKS}></lr-sankey>
    `);
    expect(partText(el, 'loading')).to.equal('Loading…');
    expect(marks(el, 'node').length).to.equal(0);
    el.loading = false;
    await el.updateComplete;
    expect(marks(el, 'node').length).to.equal(4);
    el.nodes = [];
    el.links = [];
    el.strings = { noData: 'No flows yet' };
    await el.updateComplete;
    expect(partText(el, 'empty')).to.equal('No flows yet');
    expect(marks(el, 'node').length).to.equal(0);
  });
});
