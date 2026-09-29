import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { sendMouse } from '../../../../test/wtr-mouse.js';
import { deepActiveElement } from '../../../internal/overlay-manager.js';
import './responsive-panel.js';
import '../app-rail/app-rail.js';
import '../page/page.js';
import '../widget/widget.js';
import '../multi-split/multi-split.js';

async function click(target: HTMLElement): Promise<void> {
  const rect = target.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
}

describe('layout overlays above a native modal', () => {
  for (const tag of ['lr-responsive-panel', 'lr-app-rail', 'lr-page', 'lr-widget', 'lr-multi-split'] as const) {
    it(`${tag} accepts pointer and focus and returns to its native opener on Escape`, async () => {
      const wrapper = await fixture<HTMLElement>(html`<div><dialog><button>Open layout</button></dialog></div>`);
      const native = wrapper.querySelector('dialog')!;
      const opener = native.querySelector('button')!;
      const overlay = document.createElement(tag);
      overlay.style.cssText = 'inline-size:320px;block-size:240px;--lr-transition-base:0ms';
      const action = document.createElement('button');
      action.textContent = 'Apply';
      if (tag === 'lr-responsive-panel') overlay.setAttribute('mode', 'overlay');
      if (tag === 'lr-app-rail') {
        overlay.setAttribute('mobile-breakpoint', '2000px');
        action.slot = 'header';
        action.style.marginBlockStart = '80px';
      }
      if (tag === 'lr-page') action.slot = 'navigation';
      if (tag === 'lr-widget') overlay.setAttribute('expandable', '');
      if (tag === 'lr-multi-split') {
        overlay.setAttribute('collapse', 'start');
        const pane = document.createElement('div');
        pane.setAttribute('aria-label', 'Tools');
        pane.append(action);
        overlay.append(pane, document.createElement('div'));
      } else overlay.append(action);
      wrapper.append(overlay);
      await overlay.updateComplete;
      let clicks = 0;
      action.addEventListener('click', () => clicks++);
      const state = tag === 'lr-widget' ? 'fullscreen' : tag === 'lr-page' ? 'navOpen' : 'open';
      const setOpen = (value: boolean): void => { Reflect.set(overlay, state, value); };
      opener.addEventListener('click', () => {
        if (tag === 'lr-multi-split') Reflect.set(overlay, 'collapseState', 'floating');
        setOpen(true);
      });
      try {
        native.showModal();
        await click(opener);
        await overlay.updateComplete;
        await waitUntil(() => action.getBoundingClientRect().width > 0);
        await click(action);
        expect(clicks, 'native pointer reaches the layout action').to.equal(1);
        expect(deepActiveElement(document) === action, 'layout action receives focus').to.equal(true);
        expect(action.getRootNode() === document, 'authored content stays in light DOM').to.equal(true);
        expect(overlay.parentNode === wrapper, 'declarative host stays in place').to.equal(true);
        const carrier = overlay.shadowRoot!.querySelector('dialog')!;
        expect(carrier.matches(':modal')).to.equal(true);
        expect(overlay.shadowRoot!.querySelectorAll('[role="dialog"]').length).to.equal(1);
        if (tag === 'lr-widget') {
          expect(overlay.shadowRoot!.querySelector('[part="fullscreen-button"]')?.getAttribute('aria-label')).to.equal('Exit fullscreen');
        }
        await expect(overlay).to.be.accessible();
        const vetoEvent = tag === 'lr-widget' ? 'lr-fullscreen-request' : tag === 'lr-page' ? 'lr-nav-toggle-request' : tag === 'lr-responsive-panel' ? 'lr-close-request' : 'lr-toggle-request';
        const veto = (event: Event): void => event.preventDefault();
        overlay.addEventListener(vetoEvent, veto);
        await sendKeys({ press: 'Escape' });
        expect(Reflect.get(overlay, state), 'Escape honors the close veto').to.equal(true);
        expect(carrier.matches(':modal'), 'veto retains native modality').to.equal(true);
        overlay.removeEventListener(vetoEvent, veto);
        await sendKeys({ press: 'Escape' });
        await waitUntil(() => Reflect.get(overlay, state) === false);
        expect(native.open, 'native parent remains open').to.equal(true);
        await waitUntil(() => deepActiveElement(document) === opener);
      } finally {
        overlay.remove();
        native.close();
      }
    });
  }
});


it('keeps split allocation and authored inert state while only the floating pane is interactive', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <dialog><button>Open tools</button></dialog>
    <span id="native-pane-name">Tool options</span>
    <lr-multi-split collapse="start" style="inline-size:400px;block-size:240px;margin-inline-start:40px">
      <div aria-labelledby="native-pane-name"><button>Apply</button></div>
      <div><button>Background action</button></div>
      <div inert><button>Authored inert action</button></div>
    </lr-multi-split>
  </div>`);
  const split = wrapper.querySelector('lr-multi-split')!;
  const native = wrapper.querySelector('dialog')!;
  const panes = Array.from(split.children) as HTMLElement[];
  split.collapseState = 'floating';
  split.open = true;
  await split.updateComplete;
  const baseline = panes.map(pane => pane.getBoundingClientRect().toJSON());
  split.open = false;
  await split.updateComplete;
  let backgroundClicks = 0;
  panes[1]!.addEventListener('click', () => backgroundClicks++);
  try {
    native.showModal();
    split.open = true;
    await split.updateComplete;
    const carrier = split.shadowRoot!.querySelector('dialog')!;
    expect(carrier.getAttribute('aria-label')).to.equal('Tool options');
    expect(carrier.hasAttribute('aria-labelledby')).to.equal(false);
    for (let index = 0; index < panes.length; index++) {
      const actual = panes[index]!.getBoundingClientRect();
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(actual[key], `pane ${index} ${key}`).to.be.closeTo(baseline[index]![key], 1);
      }
    }
    await click(panes[1]!.querySelector('button')!);
    expect(backgroundClicks).to.equal(0);
    if (split.open) {
      await sendKeys({ press: 'Escape' });
      await waitUntil(() => !split.open);
    }
    expect(panes[1]!.inert).to.equal(false);
    expect(panes[2]!.inert, 'authored inert is restored').to.equal(true);
  } finally {
    split.remove();
    native.close();
  }
});
