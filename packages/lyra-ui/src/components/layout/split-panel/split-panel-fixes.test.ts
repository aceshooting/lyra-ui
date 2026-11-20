import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import '../dock-panel/dock-panel.js';
import '../multi-split/multi-split.js';
import './split-panel.js';
import type { LyraDockPanel } from '../dock-panel/dock-panel.js';
import type { LyraMultiSplit } from '../multi-split/multi-split.class.js';
import type { LyraSplitPanel } from './split-panel.class.js';

const key = (name: string, init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, composed: true, ...init });

describe('multi-split divider keys', () => {
  it('leaves modified and composing keys to the browser', async () => {
    const el = await fixture<LyraMultiSplit>(html`<lr-multi-split style="inline-size:400px;block-size:200px"
      .sizes=${[50, 50]}><div>A</div><div>B</div></lr-multi-split>`);
    const divider = el.shadowRoot!.querySelector<HTMLElement>('[part="divider"]')!;
    const ctrl = key('Home', { ctrlKey: true });
    divider.dispatchEvent(ctrl);
    const ime = key('ArrowRight', { keyCode: 229 });
    divider.dispatchEvent(ime);
    expect(ctrl.defaultPrevented || ime.defaultPrevented).to.equal(false);
  });
});

describe('multi-split resize request', () => {
  it('does not overwrite sizes a request listener wrote itself', async () => {
    const el = await fixture<LyraMultiSplit>(html`<lr-multi-split style="inline-size:400px;block-size:200px"
      .sizes=${[50, 50]}><div>A</div><div>B</div></lr-multi-split>`);
    await el.updateComplete;
    el.addEventListener('lr-resize-request', () => { el.sizes = [30, 70]; });
    let resized = 0;
    el.addEventListener('lr-resize', () => { resized += 1; });
    el.shadowRoot!.querySelector<HTMLElement>('[part="divider"]')!.dispatchEvent(key('ArrowRight'));
    expect(el.sizes).to.deep.equal([30, 70]);
    expect(resized).to.equal(0);
  });
});

describe('dock-panel attributes', () => {
  it('restores the declared extents when their attributes are removed', async () => {
    const el = await fixture<LyraDockPanel>(html`<lr-dock-panel extent="400px" min-extent="100px" max-extent="900px"></lr-dock-panel>`);
    el.removeAttribute('extent');
    el.removeAttribute('min-extent');
    el.removeAttribute('max-extent');
    expect([el.extent, el.minExtent, el.maxExtent]).to.deep.equal(['280px', '160px', '']);
  });

  it('names its resize handle from a host aria-label and ignores blank ones', async () => {
    const el = await fixture<LyraDockPanel>(html`<lr-dock-panel aria-label="Inspector"></lr-dock-panel>`);
    const handle = () => el.shadowRoot!.querySelector('[part="handle"]')!;
    expect(handle().getAttribute('aria-label')).to.equal('Inspector');
    el.setAttribute('aria-label', '  ');
    await el.updateComplete;
    expect(handle().getAttribute('aria-label')).to.equal('Resize panel');
  });
});

describe('split-panel separator name', () => {
  it('falls back to the localized name for a whitespace-only host label', async () => {
    const el = await fixture<LyraSplitPanel>(html`<lr-split-panel aria-label="  " style="inline-size:300px"></lr-split-panel>`);
    expect(el.shadowRoot!.querySelector('[part="divider"]')!.getAttribute('aria-label')).to.equal('Resize divider between panel 1 and panel 2');
  });
});

describe('pane wrapping', () => {
  it('does not collapse a min-content pane child to one glyph', async () => {
    const el = await fixture<LyraSplitPanel>(html`<lr-split-panel style="inline-size:400px;block-size:120px">
      <div slot="start"><div id="probe" style="inline-size:min-content">Unbreakable</div></div>
      <div slot="end">B</div></lr-split-panel>`);
    await el.updateComplete;
    const probe = el.querySelector<HTMLElement>('#probe')!;
    expect(probe.getBoundingClientRect().width).to.be.greaterThan(40);
  });
});

for (const [name, template] of [
  ['dock-panel', html`<lr-dock-panel></lr-dock-panel>`],
  ['split-panel', html`<lr-split-panel style="inline-size:400px;block-size:100px"></lr-split-panel>`],
  ['multi-split', html`<lr-multi-split style="inline-size:400px;block-size:100px"><div>A</div><div>B</div></lr-multi-split>`],
] as const) {
  it(`leaves cancelled navigation and legacy IME keys alone on the ${name} separator`, async () => {
    const el = await fixture<HTMLElement>(template);
    const separator = el.shadowRoot!.querySelector<HTMLElement>('[role="separator"]')!;
    let requests = 0;
    el.addEventListener('lr-resize-request', () => { requests++; });
    const ime = key('ArrowRight', { keyCode: 229 });
    separator.dispatchEvent(ime);
    expect(ime.defaultPrevented).to.equal(false);
    const cancelled = key('ArrowRight');
    cancelled.preventDefault();
    separator.dispatchEvent(cancelled);
    expect(requests).to.equal(0);
    separator.dispatchEvent(key('ArrowRight'));
    expect(requests).to.equal(1);
  });
}

it('discards a multi-split proposal when the constraints change during dispatch', async () => {
  const el = await fixture<LyraMultiSplit>(html`<lr-multi-split .sizes=${[50, 50]}
    style="inline-size:400px;block-size:100px"><div>A</div><div>B</div></lr-multi-split>`);
  el.addEventListener('lr-resize-request', () => { el.panelConstraints = [{ maxPercent: 50 }, null]; });
  el.shadowRoot!.querySelector<HTMLElement>('[role="separator"]')!.dispatchEvent(key('ArrowRight'));
  expect(el.sizes).to.deep.equal([50, 50]);
});

it('preserves min-content width inside a multi-split panel', async () => {
  const el = await fixture<LyraMultiSplit>(html`<lr-multi-split style="inline-size:400px;block-size:100px">
    <div><div id="probe" style="inline-size:min-content">Unbreakable</div></div><div>B</div></lr-multi-split>`);
  expect(el.querySelector('#probe')!.getBoundingClientRect().width).to.be.greaterThan(40);
});

it('lets the host theme the resting dock line on either axis', async () => {
  const el = await fixture<LyraDockPanel>(html`<lr-dock-panel style="--lr-dock-panel-handle-color:rgb(3, 5, 7);--lr-dock-panel-handle-size:7px"></lr-dock-panel>`);
  const handle = el.shadowRoot!.querySelector('[role="separator"]')!;
  expect(getComputedStyle(handle).backgroundColor).to.equal('rgb(3, 5, 7)');
  expect(getComputedStyle(handle).width).to.equal('7px');
  el.placement = 'top';
  await el.updateComplete;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[role="separator"]')!).height).to.equal('7px');
});

it('suppresses user resizing on a disabled multi-split and restores it when enabled', async () => {
  const el = await fixture<LyraMultiSplit>(html`<lr-multi-split disabled .sizes=${[50, 50]} style="inline-size:400px;block-size:100px">
    <div>A</div><div>B</div></lr-multi-split>`);
  const separator = el.shadowRoot!.querySelector<HTMLElement>('[role="separator"]')!;
  expect(separator.getAttribute('aria-disabled')).to.equal('true');
  separator.dispatchEvent(key('ArrowRight'));
  expect(el.sizes).to.deep.equal([50, 50]);
  el.removeAttribute('disabled');
  await el.updateComplete;
  separator.dispatchEvent(key('ArrowRight'));
  expect(el.sizes[0]).to.be.greaterThan(50);
});

it('hides a disabled dock resize handle without disabling the collapse toggle', async () => {
  const el = await fixture<LyraDockPanel>(html`<lr-dock-panel collapsible disabled></lr-dock-panel>`);
  expect(el.shadowRoot!.querySelectorAll('[part="handle"]').length).to.equal(0);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="collapse-toggle"]')!.click();
  expect(el.collapsed).to.equal(true);
  el.collapsed = false;
  el.setAttribute('without-resize', '');
  el.removeAttribute('disabled');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="handle"]').length).to.equal(0);
  el.removeAttribute('without-resize');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="handle"]').length).to.equal(1);
});

for (const [name, template] of [
  ['split', html`<lr-split-panel style="inline-size:400px;block-size:100px"></lr-split-panel>`],
  ['dock', html`<lr-dock-panel></lr-dock-panel>`],
] as const) {
  it(`abandons a ${name} resize when the request listener removes the host`, async () => {
    const el = await fixture<HTMLElement>(template);
    let requests = 0;
    let commits = 0;
    el.addEventListener('lr-resize-request', () => { requests++; el.remove(); });
    el.addEventListener('lr-resize', () => { commits++; });
    el.shadowRoot!.querySelector<HTMLElement>('[role="separator"]')!.dispatchEvent(key('ArrowRight'));
    expect(requests).to.equal(1);
    expect(commits).to.equal(0);
  });
}

it('measures only resized dividers when one gutter changes', async () => {
  const el = await fixture<LyraMultiSplit>(html`<lr-multi-split style="inline-size:600px;block-size:100px"
    .panelConstraints=${[{ minPx: 20 }]}><div>A</div><div>B</div><div>C</div><div>D</div></lr-multi-split>`);
  const [first, second] = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="divider"]');
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  await twoFrames();
  const total = parseFloat(base.style.getPropertyValue('--_lr-multi-split-gutters'));
  const width = first!.getBoundingClientRect().width;
  const original = window.getComputedStyle;
  let unaffectedReads = 0;
  window.getComputedStyle = (...args) => {
    if (args[0] === second) unaffectedReads++;
    return original.apply(window, args);
  };
  try {
    first!.style.setProperty('--lr-multi-split-divider-target-size', `${width + 11}px`);
    await waitUntil(() => parseFloat(base.style.getPropertyValue('--_lr-multi-split-gutters')) > total + 10);
    expect(unaffectedReads).to.equal(0);
  } finally {
    window.getComputedStyle = original;
  }
});

it('remeasures all constrained gutters when switching to the block axis', async () => {
  const el = await fixture<LyraMultiSplit>(html`<lr-multi-split .panelConstraints=${[{ minPx: 20 }]}
    style="inline-size:400px;block-size:300px"><div>A</div><div>B</div><div>C</div></lr-multi-split>`);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const dividers = [...base.querySelectorAll<HTMLElement>('[part="divider"]')];
  dividers[0]!.style.height = '31px';
  dividers[1]!.style.height = '35px';
  el.orientation = 'vertical';
  await el.updateComplete;
  const heights = dividers.map(divider => divider.getBoundingClientRect().height);
  expect(heights).to.deep.equal([31, 35]);
  expect(base.style.getPropertyValue('--_lr-multi-split-gutters')).to.equal('66px');
});
