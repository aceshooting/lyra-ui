import { fixture, expect, html } from '@open-wc/testing';
import '../flow-canvas/flow-canvas.js';
import './flow-controls.js';
import type { LyraFlowControls } from './flow-controls.js';
import type { LyraFlowCanvas, FlowNode } from '../flow-canvas/flow-canvas.js';

const nodes: FlowNode[] = [{ id: 'a', position: { x: 0, y: 0 } }];

it('defaults to orientation vertical, hideLock false, empty for', async () => {
  const el = (await fixture(html`<lr-flow-controls></lr-flow-controls>`)) as LyraFlowControls;
  expect(el.orientation).to.equal('vertical');
  expect(el.hideLock).to.be.false;
  expect(el.for).to.equal('');
});

it('gives every toolbar button the shared minimum hit area', async () => {
  const el = (await fixture(html`<lr-flow-controls></lr-flow-controls>`)) as LyraFlowControls;
  for (const part of ['zoom-in', 'zoom-out', 'fit', 'lock']) {
    const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
    expect(getComputedStyle(button).minInlineSize).to.equal('40px');
    expect(getComputedStyle(button).minBlockSize).to.equal('40px');
  }
});

it('disables every button when no canvas can be resolved', async () => {
  const el = (await fixture(html`<lr-flow-controls></lr-flow-controls>`)) as LyraFlowControls;
  expect((el.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement).disabled).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="fit"]') as HTMLButtonElement).disabled).to.be.true;
});

it('zoom-in/zoom-out call the resolved canvas methods and fit calls fit()', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas><lr-flow-controls slot="bottom-start"></lr-flow-controls></lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const controls = wrapper.querySelector('lr-flow-controls') as LyraFlowControls;
  await controls.updateComplete;
  const zoomBefore = wrapper.viewport.zoom;
  (controls.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement).click();
  expect(wrapper.viewport.zoom).to.be.greaterThan(zoomBefore);
});

it('the zoom-out button disables once the canvas viewport reaches minZoom', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas min-zoom="1"><lr-flow-controls slot="bottom-start"></lr-flow-controls></lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const controls = wrapper.querySelector('lr-flow-controls') as LyraFlowControls;
  await controls.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  await controls.updateComplete;
  expect((controls.shadowRoot!.querySelector('[part="zoom-out"]') as HTMLButtonElement).disabled).to.be.true;
});

it('the lock button toggles the canvas locked attribute and mirrors aria-pressed both ways', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas><lr-flow-controls slot="bottom-start"></lr-flow-controls></lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const controls = wrapper.querySelector('lr-flow-controls') as LyraFlowControls;
  await controls.updateComplete;
  const lockButton = controls.shadowRoot!.querySelector('[part="lock"]') as HTMLButtonElement;
  expect(lockButton.getAttribute('aria-pressed')).to.equal('false');
  lockButton.click();
  expect(wrapper.locked).to.be.true;
  await new Promise((r) => setTimeout(r, 0));
  await controls.updateComplete;
  expect(lockButton.getAttribute('aria-pressed')).to.equal('true');

  // An externally-set lock (not via this button) stays in sync too.
  wrapper.locked = false;
  await new Promise((r) => setTimeout(r, 0));
  await controls.updateComplete;
  expect(lockButton.getAttribute('aria-pressed')).to.equal('false');
});

it('hide-lock omits the lock button entirely', async () => {
  const el = (await fixture(html`<lr-flow-controls hide-lock></lr-flow-controls>`)) as LyraFlowControls;
  expect(el.shadowRoot!.querySelector('[part="lock"]')).to.not.exist;
});

it('the default slot appends extra host buttons to the cluster', async () => {
  const el = (await fixture(
    html`<lr-flow-controls><button type="button">Export</button></lr-flow-controls>`,
  )) as LyraFlowControls;
  expect(el.querySelector('button')!.textContent).to.equal('Export');
});

it('re-resolves against a new for target when the for attribute changes at runtime', async () => {
  const root = (await fixture(html`
    <div>
      <lr-flow-canvas id="wf1"></lr-flow-canvas>
      <lr-flow-canvas id="wf2" min-zoom="1"></lr-flow-canvas>
      <lr-flow-controls for="wf1"></lr-flow-controls>
    </div>
  `)) as HTMLElement;
  const canvas2 = root.querySelector('#wf2') as LyraFlowCanvas;
  canvas2.nodes = nodes;
  await canvas2.updateComplete;
  const controls = root.querySelector('lr-flow-controls') as LyraFlowControls;
  await controls.updateComplete;
  // Still pointed at wf1 (no nodes) -- clicking zoom-in should not touch wf2.
  const zoomBeforeWf2 = canvas2.viewport.zoom;

  controls.for = 'wf2';
  await controls.updateComplete;
  (controls.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement).click();
  expect(canvas2.viewport.zoom).to.be.greaterThan(zoomBeforeWf2);
});

it('resolves a for-target canvas that mounts into the document after the controls element itself', async () => {
  const root = (await fixture(html`<div><lr-flow-controls for="late-wf"></lr-flow-controls></div>`)) as HTMLElement;
  const controls = root.querySelector('lr-flow-controls') as LyraFlowControls;
  expect((controls.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement).disabled).to.be.true;

  const canvas = document.createElement('lr-flow-canvas') as LyraFlowCanvas;
  canvas.id = 'late-wf';
  root.appendChild(canvas);
  canvas.nodes = nodes;
  await canvas.updateComplete;
  // The retry itself is DOM-mutation-driven (a MutationObserver), not another render on the
  // controls element, so give the observer's microtask a turn first; the button re-render then
  // rides on the rAF-coalesced companion snapshot delivery (see flow-canvas.test.ts's own
  // "registerCompanion delivers a FlowStructureSnapshot rAF-coalesced" case).
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => requestAnimationFrame(r));
  await controls.updateComplete;

  expect((controls.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement).disabled).to.be.false;
});

it('adopts a same-id replacement canvas and unsubscribes from the removed target', async () => {
  const root = (await fixture(html`
    <div>
      <lr-flow-canvas id="wf"></lr-flow-canvas>
      <lr-flow-controls for="wf"></lr-flow-controls>
    </div>
  `)) as HTMLElement;
  const original = root.querySelector('lr-flow-canvas') as LyraFlowCanvas;
  original.nodes = nodes;
  await original.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const controls = root.querySelector('lr-flow-controls') as LyraFlowControls;

  original.remove();
  const replacement = document.createElement('lr-flow-canvas') as LyraFlowCanvas;
  replacement.id = 'wf';
  replacement.nodes = nodes;
  root.prepend(replacement);
  await replacement.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const oldZoom = original.viewport.zoom;
  const newZoom = replacement.viewport.zoom;
  (controls.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement).click();

  expect(original.viewport.zoom).to.equal(oldZoom);
  expect(replacement.viewport.zoom).to.be.greaterThan(newZoom);
});

it('dims a disabled toolbar button through the shared disabled-opacity token', async () => {
  const wrapper = (await fixture(
    html`<div style="--lr-theme-opacity-disabled: 0.25"><lr-flow-controls></lr-flow-controls></div>`,
  )) as HTMLElement;
  const el = wrapper.querySelector('lr-flow-controls') as LyraFlowControls;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement;
  expect(button.disabled).to.be.true;
  expect(getComputedStyle(button).opacity).to.equal('0.25');
});

it('is accessible with a resolved canvas', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas><lr-flow-controls slot="bottom-start"></lr-flow-controls></lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  const controls = wrapper.querySelector('lr-flow-controls') as LyraFlowControls;
  await controls.updateComplete;
  await expect(controls).to.be.accessible();
});

it('renders per-element .strings overrides in the control button labels', async () => {
  const el = (await fixture(html`<lr-flow-controls></lr-flow-controls>`)) as LyraFlowControls;
  el.strings = { zoomIn: 'Zoomer', zoomToFit: 'Ajuster', flowControlsLabel: 'Commandes du canevas' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="zoom-in"]')!.getAttribute('aria-label')).to.equal('Zoomer');
  expect(el.shadowRoot!.querySelector('[part="fit"]')!.getAttribute('aria-label')).to.equal('Ajuster');
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Commandes du canevas');
});

it('forwards a live host aria-label to the semantic group', async () => {
  const el = (await fixture(
    html`<lr-flow-controls aria-label="Workflow controls"></lr-flow-controls>`,
  )) as LyraFlowControls;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('aria-label')).to.equal('Workflow controls');
  el.setAttribute('aria-label', 'Canvas controls');
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Canvas controls');
  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Canvas controls');
});

describe('appearance', () => {
  const baseOf = (el: LyraFlowControls): HTMLElement => el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const baseChrome = (el: LyraFlowControls) => {
    const s = getComputedStyle(baseOf(el));
    return {
      paddingTop: s.paddingTop,
      paddingLeft: s.paddingLeft,
      borderTopWidth: s.borderTopWidth,
      borderTopStyle: s.borderTopStyle,
      borderTopLeftRadius: s.borderTopLeftRadius,
      backgroundColor: s.backgroundColor,
      boxShadow: s.boxShadow,
      flexDirection: s.flexDirection,
      rowGap: s.rowGap,
    };
  };

  it('defaults to appearance="card", rendering identically to that value restated', async () => {
    const implicit = (await fixture(html`<lr-flow-controls></lr-flow-controls>`)) as LyraFlowControls;
    const explicit = (await fixture(html`<lr-flow-controls appearance="card"></lr-flow-controls>`)) as LyraFlowControls;

    expect(implicit.appearance).to.equal('card');
    expect(implicit.getAttribute('appearance')).to.equal('card');
    expect(baseChrome(explicit)).to.deep.equal(baseChrome(implicit));

    const chrome = baseChrome(implicit);
    expect(chrome.paddingTop).to.equal('2px'); // --lr-space-2xs
    expect(chrome.borderTopWidth).to.equal('1px');
    expect(chrome.borderTopStyle).to.equal('solid');
    expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
    expect(chrome.boxShadow).to.not.equal('none');
  });

  it('drops border, background, shadow, padding and radius under appearance="plain"', async () => {
    const el = (await fixture(html`<lr-flow-controls appearance="plain"></lr-flow-controls>`)) as LyraFlowControls;
    expect(el.getAttribute('appearance')).to.equal('plain');
    const chrome = baseChrome(el);
    expect(chrome.borderTopWidth).to.equal('0px');
    expect(chrome.borderTopLeftRadius).to.equal('0px');
    expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(chrome.boxShadow).to.equal('none');
    expect(chrome.paddingTop).to.equal('0px');
    expect(chrome.paddingLeft).to.equal('0px');
    // The cluster layout survives the chrome reset -- only the box decoration goes.
    expect(chrome.rowGap).to.equal('2px'); // --lr-space-2xs
  });

  it('keeps every button at the shared minimum hit area under plain', async () => {
    const el = (await fixture(html`<lr-flow-controls appearance="plain"></lr-flow-controls>`)) as LyraFlowControls;
    for (const part of ['zoom-in', 'zoom-out', 'fit', 'lock']) {
      const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      expect(getComputedStyle(button).minInlineSize).to.equal('40px');
      expect(getComputedStyle(button).minBlockSize).to.equal('40px');
    }
  });

  it('still lays the cluster out per orientation under plain', async () => {
    const vertical = (await fixture(html`<lr-flow-controls appearance="plain"></lr-flow-controls>`)) as LyraFlowControls;
    expect(getComputedStyle(baseOf(vertical)).flexDirection).to.equal('column');

    const horizontal = (await fixture(
      html`<lr-flow-controls appearance="plain" orientation="horizontal"></lr-flow-controls>`,
    )) as LyraFlowControls;
    expect(getComputedStyle(baseOf(horizontal)).flexDirection).to.equal('row');
  });

  it('keeps each button focus ring visible under plain, with no card surface behind it', async () => {
    const wrapper = (await fixture(html`
      <lr-flow-canvas>
        <lr-flow-controls slot="bottom-start" appearance="plain"></lr-flow-controls>
      </lr-flow-canvas>
    `)) as LyraFlowCanvas;
    wrapper.nodes = nodes;
    await wrapper.updateComplete;
    const controls = wrapper.querySelector('lr-flow-controls') as LyraFlowControls;
    await controls.updateComplete;

    const button = controls.shadowRoot!.querySelector('[part="fit"]') as HTMLButtonElement;
    expect(button.disabled).to.be.false;
    expect(getComputedStyle(button).outlineStyle).to.equal('none');
    button.focus();
    expect(controls.shadowRoot!.activeElement === button).to.be.true;
    const focused = getComputedStyle(button);
    expect(focused.outlineStyle).to.equal('solid');
    expect(focused.outlineWidth).to.equal('2px'); // --lr-focus-ring-width
    expect(focused.outlineOffset).to.equal('2px'); // --lr-focus-ring-offset
  });

  it('is accessible under appearance="plain" with a resolved canvas', async () => {
    const wrapper = (await fixture(html`
      <lr-flow-canvas>
        <lr-flow-controls slot="bottom-start" appearance="plain"></lr-flow-controls>
      </lr-flow-canvas>
    `)) as LyraFlowCanvas;
    wrapper.nodes = nodes;
    await wrapper.updateComplete;
    const controls = wrapper.querySelector('lr-flow-controls') as LyraFlowControls;
    await controls.updateComplete;
    expect((controls.shadowRoot!.querySelector('[part="lock"]') as HTMLButtonElement).disabled).to.be.false;
    await expect(controls).to.be.accessible();
  });
});

describe('toolbar button hover specificity', () => {
  it('wraps the internal hover rule in :where() so a ::part(zoom-in):hover override does not need !important', async () => {
    const el = (await fixture(html`<lr-flow-controls></lr-flow-controls>`)) as LyraFlowControls;
    // jsdom/browser test runners don't synthesize a real :hover pseudo-class from a dispatched
    // event, so assert via the stylesheet source directly, mirroring lr-attachment-trigger's
    // identical hover-specificity regression test.
    const internalRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      .find((text) => text.includes(':hover') && text.includes('button'));
    expect(internalRule).to.contain(':where(');
  });
});
