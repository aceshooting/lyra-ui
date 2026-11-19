import { fixture, expect, html } from '@open-wc/testing';
import './timeline.js';
import './timeline-item.js';
import type { LyraTimelineItem } from './timeline-item.js';

function variantName(item: LyraTimelineItem): string | null {
  return item.shadowRoot!.querySelector('[data-variant-name]')?.textContent?.trim() ?? null;
}

describe('lr-timeline-item variant name', () => {
  it('exposes a text cue for every non-neutral variant and none for neutral', async () => {
    const el = await fixture<HTMLElement>(html`
      <lr-timeline aria-label="Events">
        <lr-timeline-item>Neutral</lr-timeline-item>
        <lr-timeline-item variant="brand">Brand</lr-timeline-item>
        <lr-timeline-item variant="success">Success</lr-timeline-item>
        <lr-timeline-item variant="warning">Warning</lr-timeline-item>
        <lr-timeline-item variant="danger">Danger</lr-timeline-item>
      </lr-timeline>
    `);
    const items = [...el.querySelectorAll<LyraTimelineItem>('lr-timeline-item')];
    for (const item of items) await item.updateComplete;
    expect(items.map(variantName)).to.deep.equal([null, 'Highlighted:', 'Success:', 'Warning:', 'Error:']);
  });

  it('updates the cue when the variant changes', async () => {
    const item = await fixture<LyraTimelineItem>(html`<lr-timeline-item variant="danger">Failed</lr-timeline-item>`);
    item.variant = 'neutral';
    await item.updateComplete;
    expect(variantName(item)).to.equal(null);
  });
});

it('uses the supplied variant wording in the item title', async () => {
  const item = await fixture<LyraTimelineItem>(html`<lr-timeline-item variant="warning"
    .strings=${{ timelineItemVariantWarning: 'Attention' }}>Deployment</lr-timeline-item>`);
  expect(variantName(item)).to.equal('Attention:');
});

describe('lr-timeline-item slot presence', () => {
  it('ignores fallback content of a forwarding slot and sees real slotted content', async () => {
    const host = await fixture(html`<div></div>`);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<lr-timeline-item>Title<slot name="description" slot="description">fallback</slot></lr-timeline-item>`;
    const item = root.querySelector('lr-timeline-item') as LyraTimelineItem;
    await item.updateComplete;
    const description = () => item.shadowRoot!.querySelector<HTMLElement>('[part="description"]')!;
    await Promise.resolve();
    await item.updateComplete;
    expect(description().hidden).to.equal(true);
    const real = document.createElement('span');
    real.slot = 'description';
    real.textContent = 'Real';
    host.append(real);
    await new Promise((r) => setTimeout(r, 50));
    await item.updateComplete;
    expect(description().hidden).to.equal(false);
  });
});
