import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-timeline.js';
import '../../lr-timeline-item.js';
import type { LyraTimelineItem } from '../../lr-timeline-item.js';

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

  it('uses an inherited tint for only the matching variant unless the shared marker color is set', async () => {
    const timeline = await fixture<HTMLElement>(html`
      <lr-timeline style="--lr-timeline-marker-warning-color: rgb(9, 18, 27)">
        <lr-timeline-item variant="warning">Warning</lr-timeline-item>
        <lr-timeline-item variant="danger">Danger</lr-timeline-item>
      </lr-timeline>
    `);
    const items = [...timeline.querySelectorAll<LyraTimelineItem>('lr-timeline-item')];
    const colors = () => items.map(item =>
      getComputedStyle(item.shadowRoot!.querySelector('[part="marker"]')!).backgroundColor);
    for (const item of items) await item.updateComplete;
    expect(colors()[0]).to.equal('rgb(9, 18, 27)');
    expect(colors()[1]).to.not.equal('rgb(9, 18, 27)');
    timeline.style.setProperty('--lr-timeline-marker-color', 'rgb(27, 18, 9)');
    expect(colors()).to.deep.equal(['rgb(27, 18, 9)', 'rgb(27, 18, 9)']);
  });

  it('allows sizing the ordered marker independently of the plain marker', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-timeline-marker-size: 20px; --lr-timeline-ordered-marker-size: 28px">
        <lr-timeline><lr-timeline-item>Plain</lr-timeline-item></lr-timeline>
        <lr-timeline ordered><lr-timeline-item>Ordered</lr-timeline-item></lr-timeline>
      </div>
    `);
    const items = [...wrapper.querySelectorAll<LyraTimelineItem>('lr-timeline-item')];
    for (const item of items) await item.updateComplete;
    const heights = () => items.map(item =>
      getComputedStyle(item.shadowRoot!.querySelector('[part="marker"]')!).blockSize);
    expect(heights()).to.deep.equal(['20px', '28px']);
    wrapper.style.removeProperty('--lr-timeline-ordered-marker-size');
    expect(heights()).to.deep.equal(['20px', '20px']);
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
