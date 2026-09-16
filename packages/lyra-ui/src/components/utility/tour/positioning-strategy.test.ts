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
