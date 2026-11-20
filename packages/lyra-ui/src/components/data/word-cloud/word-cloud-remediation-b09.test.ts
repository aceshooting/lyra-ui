import { setForcedColors } from '../../../../test/wtr-media.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-word-cloud.js';
import type { LyraWordCloud } from '../../lr-word-cloud.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const words = [{ text: 'alpha', weight: 3 }, { text: 'beta', weight: 2 }, { text: 'gamma', weight: 1 }];
const svgOf = (el: LyraWordCloud) => el.shadowRoot!.querySelector<SVGElement>('svg')!;
const ring = (el: LyraWordCloud) => el.shadowRoot!.querySelector('[part="focus-ring"]');

describe('word-cloud remediation', () => {
  it('ignores modified and composing keys', async () => {
    const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .words=${words}></lr-word-cloud>`);
    await focusByKeyboard(svgOf(el) as unknown as HTMLElement);
    let activations = 0;
    el.addEventListener('lr-word-activate', () => { activations += 1; });
    const events = [
      { key: 'ArrowRight', altKey: true }, { key: 'Enter', ctrlKey: true },
      { key: 'ArrowRight', isComposing: true }, { key: 'Enter', repeat: true },
    ]
      .map((init) => {
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, composed: true, ...init });
        svgOf(el).dispatchEvent(event);
        return event.defaultPrevented;
      });
    expect(events.every((prevented) => prevented === false)).to.equal(true);
    expect(activations).to.equal(0);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, composed: true });
    svgOf(el).dispatchEvent(enter);
    expect(enter.defaultPrevented).to.equal(true);
    expect(activations).to.equal(1);
  });

  it('clears the focus ring on blur and restores it on refocus', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-word-cloud .words=${words}></lr-word-cloud><button type="button">Other</button>
    </div>`);
    const cloud = wrapper.querySelector('lr-word-cloud')!;
    await focusByKeyboard(svgOf(cloud) as unknown as HTMLElement);
    await cloud.updateComplete;
    expect(ring(cloud) === null).to.equal(false);
    await focusByKeyboard(wrapper.querySelector('button')!);
    await waitUntil(() => ring(cloud) === null, 'ring still drawn after blur');
    await focusByKeyboard(svgOf(cloud) as unknown as HTMLElement);
    await cloud.updateComplete;
    expect(ring(cloud) === null).to.equal(false);
  });
});

it('honors an author minimum inline size inside a narrow scrollport', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="inline-size:96px;overflow:auto">
    <lr-word-cloud style="min-inline-size:256px" .words=${words}></lr-word-cloud>
  </div>`);
  const cloud = wrapper.querySelector('lr-word-cloud')!;
  expect(wrapper.clientWidth).to.equal(96);
  expect(svgOf(cloud).getBoundingClientRect().width).to.be.at.least(256);
  expect(wrapper.scrollWidth).to.be.at.least(256);
});

it('keeps data paint visible in forced colors', async () => {
  await setForcedColors('active');
  try {
    if (!matchMedia('(forced-colors: active)').matches) return;
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-word-cloud with-legend .words=${[{ text: 'Alpha', weight: 1, group: 'Group' }]}></lr-word-cloud></div>`);
    const el = wrapper.firstElementChild!;
    const swatch = getComputedStyle(el.shadowRoot!.querySelector('[part="legend-swatch"]')!);
    expect(swatch.borderTopStyle).to.equal('solid');
  } finally {
    await setForcedColors('none');
  }
});
