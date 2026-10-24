import { expect, fixture, html } from '@open-wc/testing';
import type { LyraFunnel, LyraFunnelStage } from './funnel.class.js';
import './funnel.js';

function parts(el: LyraFunnel, name: string): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>(`[part~="${name}"]`)];
}

function text(node: Element | null | undefined): string {
  return (node?.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ').trim();
}

describe('<lr-funnel> untrusted stage input', () => {
  it('keeps only records with a text label and reads a non-numeric value as zero', async () => {
    const stages = [
      'not a record',
      [{ label: 'Nested', value: 1 }],
      { label: 5, value: 10 },
      { label: 'Visited', value: 100 },
      { label: 'Signed up', value: 'many' },
      { label: 'Paid', value: 20, color: 'tomato' },
      { label: 'Refunded', value: 5, color: 42 },
    ] as unknown as LyraFunnelStage[];
    const el = await fixture<LyraFunnel>(html`<lr-funnel label="Checkout" .stages=${stages}></lr-funnel>`);
    expect(parts(el, 'stage-label').map(text)).to.deep.equal(['Visited', 'Signed up', 'Paid', 'Refunded']);
    expect(parts(el, 'stage-value').map(text)).to.deep.equal(['100', '0', '20', '5']);
    const bars = parts(el, 'bar');
    expect(getComputedStyle(bars[2]!).backgroundColor).to.equal('rgb(255, 99, 71)');
    // A stage without a usable color keeps the funnel's own bar color.
    expect(getComputedStyle(bars[3]!).backgroundColor).to.equal(getComputedStyle(bars[0]!).backgroundColor);
  });

  it('skips a record whose members throw without hiding the stages after it', async () => {
    const hostile = {
      get label(): string {
        throw new Error('unreadable label');
      },
      value: 5,
    };
    const stages = [{ label: 'Visited', value: 10 }, hostile, { label: 'Converted', value: 4 }] as unknown as LyraFunnelStage[];
    const el = await fixture<LyraFunnel>(html`<lr-funnel label="Checkout" .stages=${stages}></lr-funnel>`);
    expect(parts(el, 'stage-label').map(text)).to.deep.equal(['Visited', 'Converted']);
  });

  it('treats a stages or comparison value that is not an array as empty', async () => {
    const el = await fixture<LyraFunnel>(html`<lr-funnel label="Checkout"
      .stages=${[{ label: 'Visited', value: 10 }, { label: 'Converted', value: 4 }]}
      .comparison=${[{ label: 'Visited', value: 8 }, { label: 'Converted', value: 6 }]}></lr-funnel>`);
    expect(parts(el, 'comparison-value').length).to.equal(2);
    el.comparison = undefined as unknown as readonly LyraFunnelStage[];
    await el.updateComplete;
    expect(parts(el, 'comparison-value').length).to.equal(0);
    expect(parts(el, 'stage').length).to.equal(2);
    el.stages = null as unknown as readonly LyraFunnelStage[];
    await el.updateComplete;
    expect(parts(el, 'stage').length).to.equal(0);
    expect(parts(el, 'empty').length).to.equal(1);
  });
});

describe('<lr-funnel> unchanged stage volume', () => {
  it('reads an equal volume as unchanged rather than as a rise or a fall', async () => {
    const el = await fixture<LyraFunnel>(html`<lr-funnel label="Checkout"
      .strings=${{ trendUnchanged: 'No movement' }}
      .stages=${[{ label: 'Visited', value: 40 }, { label: 'Carted', value: 40 }, { label: 'Paid', value: 10 }]}></lr-funnel>`);
    expect(parts(el, 'dropoff').map(text)).to.deep.equal(['No movement', 'decreased 75%']);
  });
});
