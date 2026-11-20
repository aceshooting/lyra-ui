import { expect, html, waitUntil } from '@open-wc/testing';
import { headerFixture, hitBelongsTo, pointOverSibling } from '../../../../test/top-layer-header.js';
import '../../lr-tour.js';
import type { LyraTour, LyraTourStep } from '../../lr-tour.js';

const NO_MOTION = '--lr-transition-fast: 0ms; --lr-duration-base: 0ms';

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(html`<div>
    <button id="tour-header-target">Settings</button>
    <lr-tour data-lr-theme-scope style=${NO_MOTION} ?top-layer=${topLayer}></lr-tour>
  </div>`);
  const tour = wrapper.querySelector('lr-tour') as LyraTour;
  const steps: LyraTourStep[] = [{
    stepId: 'settings',
    target: wrapper.querySelector<HTMLElement>('#tour-header-target')!,
    heading: 'Settings',
    content: 'Adjust the workspace from here.',
    interactiveTarget: true,
  }];
  tour.steps = steps;
  tour.start();
  await tour.updateComplete;
  const popover = tour.shadowRoot!.querySelector<HTMLElement>('[part="popover"]')!;
  await waitUntil(
    () => popover.style.left !== '' && popover.getBoundingClientRect().height > 0,
    'the step popover is placed',
  );
  return { tour, sibling, popover };
}

describe('top-layer on lr-tour', () => {
  it('defaults off: an interactive step stays beneath a higher sibling', async () => {
    const { tour, sibling, popover } = await mount(false);
    expect(tour.topLayer).to.equal(false);
    const [x, y] = pointOverSibling(popover, sibling);
    expect(tour.matches(':popover-open')).to.equal(false);
    expect(hitBelongsTo(tour, x, y)).to.equal(false);
    tour.end();
  });

  it('paints an interactive step above the higher sibling when opted in, and releases when unset', async () => {
    const { tour, sibling, popover } = await mount(true);
    expect(tour.getAttribute('top-layer')).to.equal('');
    await waitUntil(() => tour.matches(':popover-open'), 'the tour is promoted');
    const [x, y] = pointOverSibling(popover, sibling);
    expect(hitBelongsTo(tour, x, y), 'the step popover wins the hit test over the sibling').to.equal(true);
    tour.topLayer = false;
    await waitUntil(() => !tour.matches(':popover-open'), 'turning it off releases the top layer');
    expect(tour.open).to.equal(true);
    tour.topLayer = true;
    await waitUntil(() => tour.matches(':popover-open'), 'turning it on again promotes live');
    tour.end();
    await waitUntil(() => !tour.matches(':popover-open'), 'ending the tour leaves the top layer');
  });
});
