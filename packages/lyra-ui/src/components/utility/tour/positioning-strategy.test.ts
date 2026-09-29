import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './tour.js';
import type { LyraTour } from './tour.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
function popover(tour: LyraTour): HTMLElement {
  return tour.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
}

const steps = [
  { stepId: 'step-0', target: '#tour-target-0', heading: 'Heading 0', content: 'Body 0' },
];

async function openTour(wrapper: HTMLElement): Promise<LyraTour> {
  const tour = wrapper.querySelector('lr-tour') as LyraTour;
  tour.steps = steps;
  tour.open = true;
  await tour.updateComplete;
  await waitUntil(() => popover(tour).style.left !== '', 'the step popover was never positioned');
  return tour;
}

const markup = () => html`
  <div>
    <lr-tour></lr-tour>
    <button id="tour-target-0">target</button>
  </div>
`;

describe('positioning-strategy on lr-tour', () => {
  it('defaults to fixed, which is what the step popover has always rendered', async () => {
    const wrapper = await fixture<HTMLElement>(markup());
    const tour = await openTour(wrapper);
    expect(getComputedStyle(popover(tour)).position).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-tour', () => {
  it('lets an ancestor switch an unset tour to absolute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: absolute">${markup()}</div>
    `);
    const tour = await openTour(wrapper);
    await waitUntil(
      () => getComputedStyle(popover(tour)).position === 'absolute',
      'the ancestor override reaches an unset tour',
    );
  });

  it('ignores an unrecognized ancestor value and keeps the default', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: sticky">${markup()}</div>
    `);
    const tour = await openTour(wrapper);
    expect(getComputedStyle(popover(tour)).position).to.equal('fixed');
  });
});

describe('lr-tour under an ancestor that contains fixed descendants', () => {
  for (const [name, style] of [
    ['a transform', 'transform: translateZ(0)'],
    ['contain: paint', 'contain: paint'],
    ['a filter', 'filter: blur(0px)'],
  ] as const) {
    it(`covers the viewport and rings the target under ${name}`, async () => {
      const wrapper = await fixture<HTMLElement>(html`
        <div style="${style}; margin: 200px 0 0 200px; width: 300px; height: 300px">
          <lr-tour></lr-tour>
          <button id="tour-target-0" style="margin: 40px">target</button>
        </div>
      `);
      const tour = await openTour(wrapper);
      const target = wrapper.querySelector('#tour-target-0') as HTMLElement;
      const spotlight = tour.shadowRoot!.querySelector('[part="spotlight"]') as HTMLElement;
      await waitUntil(() => !spotlight.hidden, 'the spotlight was never painted');
      const host = tour.getBoundingClientRect();
      expect(Math.round(host.left)).to.equal(0);
      expect(Math.round(host.top)).to.equal(0);
      expect(Math.round(host.width)).to.equal(document.documentElement.clientWidth);
      expect(Math.round(host.height)).to.equal(document.documentElement.clientHeight);
      const ring = spotlight.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      const outset = Math.round(box.left - ring.left);
      expect(outset).to.be.at.least(0);
      expect(Math.round(box.top - ring.top)).to.equal(outset);
      expect(Math.round(ring.right - box.right)).to.equal(outset);
      expect(Math.round(ring.bottom - box.bottom)).to.equal(outset);
      const popoverRect = popover(tour).getBoundingClientRect();
      expect(popoverRect.top).to.be.at.least(box.bottom - 1);
      const probe = tour.ownerDocument.elementFromPoint(host.width - 2, host.height - 2);
      expect(probe === tour).to.equal(true);
    });
  }

  it('releases the promotion when the tour closes', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="transform: translateZ(0)">${markup()}</div>
    `);
    const tour = await openTour(wrapper);
    expect(tour.matches(':popover-open')).to.equal(true);
    tour.open = false;
    await tour.updateComplete;
    await waitUntil(() => !tour.matches(':popover-open'), 'the tour stayed in the top layer');
    expect(tour.hasAttribute('popover')).to.equal(false);
    expect(tour.style.inset).to.equal('');
  });
});


describe('lr-tour inset ownership', () => {
  for (const trapped of [false, true]) {
    it(`preserves caller inset after closing ${trapped ? 'with' : 'without'} promotion`, async () => {
      const wrapper = await fixture<HTMLElement>(html`
        <div style=${trapped ? 'transform: translateZ(0)' : ''}>
          <lr-tour style="inset: 12px 18px !important"></lr-tour>
          <button id="tour-target-0">target</button>
        </div>
      `);
      const tour = await openTour(wrapper);
      tour.open = false;
      await tour.updateComplete;
      expect(tour.style.getPropertyValue('top')).to.equal('12px');
      expect(tour.style.getPropertyValue('left')).to.equal('18px');
      expect(tour.style.getPropertyPriority('top')).to.equal('important');
      expect(tour.style.getPropertyPriority('left')).to.equal('important');
    });
  }

  it('retains a caller inset change made while promoted', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="transform: translateZ(0)">${markup()}</div>
    `);
    const tour = await openTour(wrapper);
    tour.style.top = '24px';
    tour.open = false;
    await tour.updateComplete;
    expect(tour.style.top).to.equal('24px');
    expect(tour.style.right).to.equal('');
    expect(tour.style.bottom).to.equal('');
    expect(tour.style.left).to.equal('');
  });
});
