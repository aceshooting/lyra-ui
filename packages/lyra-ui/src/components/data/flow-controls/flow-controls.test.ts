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

it('disables viewport controls and preserves the viewport while the canvas is locked', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas style="width:400px;height:300px">
      <lr-flow-controls slot="bottom-start"></lr-flow-controls>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  wrapper.setViewport({ x: 23, y: 17, zoom: 1 });
  wrapper.locked = true;
  await wrapper.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const controls = wrapper.querySelector('lr-flow-controls') as LyraFlowControls;
  await controls.updateComplete;
  const before = { ...wrapper.viewport };
  const zoomIn = controls.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement;
  const fit = controls.shadowRoot!.querySelector('[part="fit"]') as HTMLButtonElement;

  expect(zoomIn.disabled).to.be.true;
  expect(fit.disabled).to.be.true;
  zoomIn.click();
  fit.click();
  expect(wrapper.viewport).to.deep.equal(before);
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

it('uses the canvas effective sorted zoom bounds instead of disabling from raw swapped values', async () => {
  const wrapper = (await fixture(html`
    <lr-flow-canvas min-zoom="4" max-zoom="0.5">
      <lr-flow-controls slot="bottom-start"></lr-flow-controls>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  wrapper.nodes = nodes;
  await wrapper.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const controls = wrapper.querySelector('lr-flow-controls') as LyraFlowControls;
  await controls.updateComplete;
  const zoomIn = controls.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement;
  const zoomOut = controls.shadowRoot!.querySelector('[part="zoom-out"]') as HTMLButtonElement;

  expect(zoomIn.disabled).to.equal(false);
  expect(zoomOut.disabled).to.equal(false);
  const before = wrapper.viewport.zoom;
  zoomIn.click();
  expect(wrapper.viewport.zoom).to.be.greaterThan(before);
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
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  await controls.updateComplete;
  expect(lockButton.getAttribute('aria-pressed')).to.equal('true');

  // An externally-set lock (not via this button) stays in sync too.
  wrapper.locked = false;
  await wrapper.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  await controls.updateComplete;
  expect(lockButton.getAttribute('aria-pressed')).to.equal('false');
});

describe('--lr-flow-controls-lock-active-color', () => {
  const lockedControls = async (style = ''): Promise<LyraFlowControls> => {
    const wrapper = (await fixture(html`
      <div style=${style}>
        <lr-flow-canvas>
          <lr-flow-controls slot="bottom-start"></lr-flow-controls>
        </lr-flow-canvas>
      </div>
    `)) as HTMLElement;
    const canvas = wrapper.querySelector('lr-flow-canvas') as LyraFlowCanvas;
    const controls = wrapper.querySelector('lr-flow-controls') as LyraFlowControls;
    canvas.nodes = nodes;
    canvas.locked = true;
    await canvas.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await controls.updateComplete;
    return controls;
  };

  it('retints only the pressed lock state through an inherited css custom property', async () => {
    const controls = await lockedControls('--lr-flow-controls-lock-active-color: rgb(10, 20, 30)');
    const lock = controls.shadowRoot!.querySelector('[part="lock"]') as HTMLButtonElement;
    const zoomIn = controls.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement;

    expect(lock.getAttribute('aria-pressed')).to.equal('true');
    expect(getComputedStyle(lock).color).to.equal('rgb(10, 20, 30)');
    expect(getComputedStyle(zoomIn).color).to.not.equal('rgb(10, 20, 30)');
  });

  it('renders identically when unset or explicitly pointed at the default brand token', async () => {
    const unset = await lockedControls();
    const unsetLock = unset.shadowRoot!.querySelector('[part="lock"]') as HTMLButtonElement;
    const unsetColor = getComputedStyle(unsetLock).color;

    const explicitDefault = await lockedControls('--lr-flow-controls-lock-active-color: var(--lr-color-brand)');
    const explicitDefaultLock = explicitDefault.shadowRoot!.querySelector('[part="lock"]') as HTMLButtonElement;

    expect(unsetLock.getAttribute('aria-pressed')).to.equal('true');
    expect(explicitDefaultLock.getAttribute('aria-pressed')).to.equal('true');
    expect(getComputedStyle(explicitDefaultLock).color).to.equal(unsetColor);
  });
});

it('hide-lock omits the lock button entirely', async () => {
  const el = (await fixture(html`<lr-flow-controls hide-lock></lr-flow-controls>`)) as LyraFlowControls;
  expect((el.shadowRoot!.querySelector('[part="lock"]')) == null).to.be.true;
});

it('the default slot appends extra host buttons to the cluster', async () => {
  const el = (await fixture(
    html`<lr-flow-controls><button type="button">Export</button></lr-flow-controls>`,
  )) as LyraFlowControls;
  expect(el.querySelector('button')!.textContent).to.equal('Export');
});

it('gives a slotted button the same hit area and chrome as the built-in ones', async () => {
  // Nothing in a shadow stylesheet reaches light-DOM slotted content except ::slotted(), so the
  // documented "styled by the same group" contract needs its own rule -- a plain descendant
  // selector can never match the consumer's own <button>.
  const el = (await fixture(
    html`<lr-flow-controls><button type="button">Export</button></lr-flow-controls>`,
  )) as LyraFlowControls;
  const slotted = el.querySelector('button') as HTMLButtonElement;
  const builtIn = el.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLElement;
  const slottedStyle = getComputedStyle(slotted);
  const builtInStyle = getComputedStyle(builtIn);
  expect(slottedStyle.minInlineSize).to.equal(builtInStyle.minInlineSize);
  expect(slottedStyle.minBlockSize).to.equal(builtInStyle.minBlockSize);
  expect(slottedStyle.cursor).to.equal('pointer');
  expect(slottedStyle.borderTopStyle).to.equal('none');
});

it('dims a disabled slotted button exactly like a disabled built-in one', async () => {
  const el = (await fixture(
    html`<lr-flow-controls><button type="button" disabled>Export</button></lr-flow-controls>`,
  )) as LyraFlowControls;
  const slotted = el.querySelector('button') as HTMLButtonElement;
  // No canvas is bound, so every built-in button is disabled too -- same state, same treatment.
  const builtIn = el.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLElement;
  const slottedStyle = getComputedStyle(slotted);
  expect(Number(slottedStyle.opacity) < 1, 'slotted button must dim').to.equal(true);
  expect(slottedStyle.opacity).to.equal(getComputedStyle(builtIn).opacity);
  expect(slottedStyle.cursor).to.equal('not-allowed');
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

it('recreates its shared target observer in the adopted owner realm', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-flow-canvas id="owner-flow"></lr-flow-canvas>
    <lr-flow-controls for="owner-flow"></lr-flow-controls>
  </div>`);
  const controls = wrapper.querySelector('lr-flow-controls') as LyraFlowControls;
  const canvas = wrapper.querySelector('lr-flow-canvas') as LyraFlowCanvas;
  await controls.updateComplete;
  wrapper.remove();
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const originalMutationObserver = frameWindow.MutationObserver;
  let rootObservations = 0;
  let lockObservations = 0;
  let relevantDisconnects = 0;
  class OwnerMutationObserver implements MutationObserver {
    private relevant = false;
    constructor(_callback: MutationCallback) {}
    observe(target: Node, options?: MutationObserverInit): void {
      if (target === frameDocument && options?.childList && options.subtree) {
        this.relevant = true;
        rootObservations += 1;
      }
      if (target === canvas && options?.attributeFilter?.includes('locked')) {
        this.relevant = true;
        lockObservations += 1;
      }
    }
    takeRecords(): MutationRecord[] { return []; }
    disconnect(): void { if (this.relevant) relevantDisconnects += 1; }
  }
  frameWindow.MutationObserver = OwnerMutationObserver;

  try {
    frameDocument.body.append(frameDocument.adoptNode(wrapper));
    await controls.updateComplete;
    expect(rootObservations, 'the destination window watches for replacement canvases').to.equal(1);
    expect(lockObservations, 'lock state arrives through the immutable companion snapshot').to.equal(0);
    document.adoptNode(wrapper);
    expect(relevantDisconnects, 'adoption disconnects the owner-root observer').to.be.at.least(1);
  } finally {
    frameWindow.MutationObserver = originalMutationObserver;
    if (wrapper.ownerDocument !== document) document.adoptNode(wrapper);
    wrapper.remove();
    iframe.remove();
  }
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
  el.setAttribute('aria-label', 'Transient workflow controls');
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Transient workflow controls');
  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Canvas controls');
  el.strings = { flowControlsLabel: 'Commandes distinctives' };
  await el.updateComplete;
  expect(base.getAttribute('aria-label')).to.equal('Commandes distinctives');
});

it('contains long built-in and slotted controls in a 319px horizontal allocation', async () => {
  const el = (await fixture(html`
    <lr-flow-controls orientation="horizontal" style="display:block;inline-size:319px">
      <button type="button">A deliberately long exported workflow action</button>
    </lr-flow-controls>
  `)) as LyraFlowControls;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.scrollWidth).to.be.at.most(Math.ceil(base.clientWidth) + 1);
  const slotted = el.querySelector('button') as HTMLButtonElement;
  expect(slotted.scrollWidth).to.be.at.most(Math.ceil(slotted.getBoundingClientRect().width) + 1);
});

describe('frame', () => {
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

  it('defaults to frame="card", rendering identically to that value restated', async () => {
    const implicit = (await fixture(html`<lr-flow-controls></lr-flow-controls>`)) as LyraFlowControls;
    const explicit = (await fixture(html`<lr-flow-controls frame="card"></lr-flow-controls>`)) as LyraFlowControls;

    expect(implicit.frame).to.equal('card');
    expect(implicit.getAttribute('frame')).to.equal('card');
    expect(baseChrome(explicit)).to.deep.equal(baseChrome(implicit));

    const chrome = baseChrome(implicit);
    expect(chrome.paddingTop).to.equal('2px'); // --lr-space-2xs
    expect(chrome.borderTopWidth).to.equal('1px');
    expect(chrome.borderTopStyle).to.equal('solid');
    expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
    expect(chrome.boxShadow).to.not.equal('none');
  });

  it('drops border, background, shadow, padding and radius under frame="plain"', async () => {
    const el = (await fixture(html`<lr-flow-controls frame="plain"></lr-flow-controls>`)) as LyraFlowControls;
    expect(el.getAttribute('frame')).to.equal('plain');
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
    const el = (await fixture(html`<lr-flow-controls frame="plain"></lr-flow-controls>`)) as LyraFlowControls;
    for (const part of ['zoom-in', 'zoom-out', 'fit', 'lock']) {
      const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      expect(getComputedStyle(button).minInlineSize).to.equal('40px');
      expect(getComputedStyle(button).minBlockSize).to.equal('40px');
    }
  });

  it('still lays the cluster out per orientation under plain', async () => {
    const vertical = (await fixture(html`<lr-flow-controls frame="plain"></lr-flow-controls>`)) as LyraFlowControls;
    expect(getComputedStyle(baseOf(vertical)).flexDirection).to.equal('column');

    const horizontal = (await fixture(
      html`<lr-flow-controls frame="plain" orientation="horizontal"></lr-flow-controls>`,
    )) as LyraFlowControls;
    expect(getComputedStyle(baseOf(horizontal)).flexDirection).to.equal('row');
  });

  it('keeps each button focus ring visible under plain, with no card surface behind it', async () => {
    const wrapper = (await fixture(html`
      <lr-flow-canvas>
        <lr-flow-controls slot="bottom-start" frame="plain"></lr-flow-controls>
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

  it('is accessible under frame="plain" with a resolved canvas', async () => {
    const wrapper = (await fixture(html`
      <lr-flow-canvas>
        <lr-flow-controls slot="bottom-start" frame="plain"></lr-flow-controls>
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
