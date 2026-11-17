import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { nothing } from 'lit';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import type { PlaceStrategy } from '../../../internal/positioner.js';
import type { LyraTooltip } from './tooltip.class.js';
import './tooltip.js';

const CONTENT = 'Explain how this action updates the current document and which options apply to this selection.';
const NO_MOTION = '--lr-transition-fast: 0ms; --lr-duration-fast: 0ms; --max-width: 320px';

interface Options {
  dir?: 'ltr' | 'rtl';
  strategy?: PlaceStrategy;
  clipped?: boolean;
  width?: number;
  manual?: boolean;
  writingMode?: 'horizontal-tb' | 'vertical-rl' | 'vertical-lr';
  content?: string;
}

interface Geometry {
  left: number;
  top: number;
  width: number;
  height: number;
}

async function mount(options: Options = {}) {
  const host = await fixture<HTMLDivElement>(html`
    <div data-lr-theme-scope dir=${options.dir ?? 'ltr'}
      style=${`position: fixed; right: 12px; top: 120px; width: ${options.width ?? 352}px; max-width: calc(100vw - 24px)`}>
      <div id="region" style=${`position: relative; width: 100%; height: 220px; overflow: ${options.clipped ? 'hidden' : 'visible'}`}>
        <button id="width-anchor" type="button"
          style="position: absolute; right: 0; top: 100px; width: 24px; height: 24px; padding: 0; margin: 0; border: 0">?</button>
        <lr-tooltip for="width-anchor" trigger="hover" show-delay="0" hide-delay="0"
          ?manual=${options.manual ?? true}
          positioning-strategy=${options.strategy ?? nothing}
          placement=${options.writingMode && options.writingMode !== 'horizontal-tb' ? 'left' : 'top'}
          style=${`${NO_MOTION}; writing-mode: ${options.writingMode ?? 'horizontal-tb'}`}
          content=${options.content ?? CONTENT}></lr-tooltip>
      </div>
    </div>
  `);
  const tooltip = host.querySelector('lr-tooltip') as LyraTooltip;
  await tooltip.updateComplete;
  const trigger = host.querySelector<HTMLButtonElement>('#width-anchor')!;
  const region = host.querySelector<HTMLDivElement>('#region')!;
  const popup = tooltip.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  return { host, tooltip, trigger, region, popup };
}

function geometry(popup: HTMLElement): Geometry {
  const { left, top, width, height } = popup.getBoundingClientRect();
  return { left, top, width, height };
}

async function samples(popup: HTMLElement, frames = 6): Promise<[Geometry, ...Geometry[]]> {
  const values: [Geometry, ...Geometry[]] = [geometry(popup)];
  for (let frame = 0; frame < frames; frame++) {
    await nextFrame();
    values.push(geometry(popup));
  }
  return values;
}

function expectStable(values: Geometry[]): void {
  for (const key of ['left', 'top', 'width', 'height'] as const) {
    const axis = values.map(value => value[key]);
    expect(Math.max(...axis) - Math.min(...axis), `${key} changes after the first visible placement`).to.be.at.most(1.5);
  }
}

async function open(tooltip: LyraTooltip, popup: HTMLElement): Promise<void> {
  await tooltip.show();
  await waitUntil(() => popup.style.left !== '' && !popup.hasAttribute('data-hidden'), 'tooltip is visibly positioned');
}

for (const dir of ['ltr', 'rtl'] as const) {
  it(`keeps first-opening geometry stable near a narrower positioned container's edge (${dir})`, async () => {
    const { tooltip, region, popup } = await mount({ dir });
    await open(tooltip, popup);
    expect(tooltip.positioningStrategy).to.equal('absolute');
    expect(getComputedStyle(popup).position).to.equal('absolute');
    expect(region.getBoundingClientRect().right).to.be.closeTo(document.documentElement.clientWidth - 12, 1);
    const values = await samples(popup, 20);
    expectStable(values);
    expect(values[0].width).to.be.greaterThan(250);
    expect(values[0].width).to.be.at.most(321);
    expect(popup.getBoundingClientRect().right).to.be.closeTo(document.documentElement.clientWidth - 8, 1.5);
    expect(tooltip.open).to.equal(true);
  });
}

it('does not cycle hover state while the pointer rests on the trigger during first placement', async () => {
  const { tooltip, trigger, popup } = await mount({ manual: false });
  let shows = 0;
  let hides = 0;
  tooltip.addEventListener('lr-show', () => { shows++; });
  tooltip.addEventListener('lr-hide', () => { hides++; });
  try {
    await hoverUntilMatched(trigger, 'pointer rests at the trigger center');
    await waitUntil(() => tooltip.open && !popup.hasAttribute('data-hidden'), 'hover opens the positioned tooltip');
    const values = await samples(popup, 60);
    expectStable(values);
    expect(trigger.matches(':hover')).to.equal(true);
    expect(tooltip.open).to.equal(true);
    expect(shows).to.equal(1);
    expect(hides).to.equal(0);
    await resetMouse();
    await waitUntil(() => !tooltip.open, 'a genuine pointer exit still closes the tooltip');
    expect(hides).to.equal(1);
  } finally {
    await resetMouse();
  }
});

it('retains fixed positioning and viewport shifting independently of the containing block', async () => {
  const { tooltip, popup } = await mount({ strategy: 'fixed' });
  await open(tooltip, popup);
  expect(getComputedStyle(popup).position).to.equal('fixed');
  expectStable(await samples(popup));
  expect(popup.getBoundingClientRect().right).to.be.closeTo(document.documentElement.clientWidth - 8, 1.5);
});

it('still clamps and shifts within a real narrow clipping ancestor', async () => {
  const { tooltip, region, popup } = await mount({ clipped: true, width: 180 });
  await open(tooltip, popup);
  expectStable(await samples(popup));
  const boundary = region.getBoundingClientRect();
  const rect = popup.getBoundingClientRect();
  expect(rect.width).to.be.greaterThan(80);
  expect(rect.width).to.be.at.most(boundary.width - 16 + 1.5);
  expect(rect.left).to.be.at.least(boundary.left + 8 - 1.5);
  expect(rect.right).to.be.at.most(boundary.right - 8 + 1.5);
});

it('keeps a short label intrinsically sized rather than filling the maximum width', async () => {
  const { tooltip, popup } = await mount({ content: 'Help' });
  await open(tooltip, popup);
  expectStable(await samples(popup));
  expect(popup.getBoundingClientRect().width).to.be.greaterThan(20);
  expect(popup.getBoundingClientRect().width).to.be.lessThan(100);
});

for (const writingMode of ['vertical-rl', 'vertical-lr'] as const) {
  it(`keeps logical inline-size stable and capped in ${writingMode}`, async () => {
    const { tooltip, popup } = await mount({ writingMode });
    tooltip.style.setProperty('--max-width', '120px');
    await open(tooltip, popup);
    expect(getComputedStyle(popup).writingMode).to.equal(writingMode);
    expectStable(await samples(popup));
    const rect = popup.getBoundingClientRect();
    expect(rect.height).to.be.greaterThan(80);
    expect(rect.height).to.be.at.most(121);
    expect(rect.top).to.be.at.least(0);
    expect(rect.bottom).to.be.at.most(document.documentElement.clientHeight + 1.5);
  });
}
