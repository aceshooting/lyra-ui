import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { deepActiveElement } from '../../../internal/overlay-manager.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendMouse } from '../../../../test/wtr-mouse.js';
import './responsive-panel.js';
import '../page/page.js';
import '../widget/widget.js';
import '../app-rail/app-rail.js';
import '../multi-split/multi-split.js';

type LayoutTag = 'lr-responsive-panel' | 'lr-page' | 'lr-widget' | 'lr-app-rail' | 'lr-multi-split';

function stateName(tag: LayoutTag): 'open' | 'navOpen' | 'fullscreen' {
  if (tag === 'lr-page') return 'navOpen';
  if (tag === 'lr-widget') return 'fullscreen';
  return 'open';
}

function configure(host: HTMLElement, tag: LayoutTag): void {
  if (tag === 'lr-responsive-panel') host.setAttribute('mode', 'overlay');
  if (tag === 'lr-widget') host.setAttribute('expandable', '');
  if (tag === 'lr-page') host.setAttribute('view', 'mobile');
  if (tag === 'lr-app-rail') host.setAttribute('mobile-breakpoint', '2000px');
  if (tag === 'lr-multi-split') {
    host.setAttribute('collapse', 'start');
    host.append(document.createElement('div'), document.createElement('div'));
  }
}

function setOpen(host: HTMLElement, tag: LayoutTag, value: boolean): void {
  if (tag === 'lr-multi-split') Reflect.set(host, 'collapseState', 'floating');
  Reflect.set(host, stateName(tag), value);
}

function getOpen(host: HTMLElement, tag: LayoutTag): boolean {
  return Reflect.get(host, stateName(tag)) === true;
}

function requestName(tag: LayoutTag): string {
  if (tag === 'lr-page') return 'lr-nav-toggle-request';
  if (tag === 'lr-widget') return 'lr-fullscreen-request';
  if (tag === 'lr-responsive-panel') return 'lr-close-request';
  return 'lr-toggle-request';
}

async function click(target: HTMLElement): Promise<void> {
  const rect = target.getBoundingClientRect();
  await sendMouse({
    type: 'click',
    position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
  });
}

for (const tag of ['lr-responsive-panel', 'lr-page', 'lr-widget', 'lr-app-rail', 'lr-multi-split'] as const) {
  it(`${tag} restores an unexpected carrier close and honors Escape veto and acceptance`, async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><dialog></dialog></div>`);
    const native = wrapper.querySelector('dialog')!;
    const host = document.createElement(tag);
    configure(host, tag);
    host.setAttribute('data-lr-theme-scope', '');
    host.style.cssText = 'inline-size:320px;block-size:240px;--lr-transition-base:0ms';
    wrapper.append(host);

    try {
      native.showModal();
      setOpen(host, tag, true);
      await host.updateComplete;
      const carrier = host.shadowRoot!.querySelector<HTMLDialogElement>('[data-native-modal-carrier]')!;
      await waitUntil(() => carrier.matches(':modal'), 'the layout carrier entered the native modal stack');

      carrier.close();
      await waitUntil(() => carrier.matches(':modal'), 'an unexpected close restores the still-open carrier');
      expect(getOpen(host, tag), 'restoring the carrier preserves the public layout state').to.equal(true);

      const requests: boolean[] = [];
      const vetoFirst = (event: Event): void => {
        requests.push(event.cancelable);
        if (requests.length === 1) event.preventDefault();
      };
      host.addEventListener(requestName(tag), vetoFirst);
      await sendKeys({ press: 'Escape' });
      await waitUntil(() => requests.length === 1, 'Escape dispatched the cancellable layout request');
      expect(requests[0], 'the close request is cancelable').to.equal(true);
      await waitUntil(() => carrier.matches(':modal'), 'the veto retained native modality');
      expect(getOpen(host, tag), 'a canceled request leaves the public layout state open').to.equal(true);

      await sendKeys({ press: 'Escape' });
      await waitUntil(() => requests.length === 2 && !getOpen(host, tag), 'a second Escape was accepted');
      expect(requests).to.deep.equal([true, true]);
      expect(carrier.matches(':modal'), 'an accepted Escape releases the native carrier').to.equal(false);
      expect(native.open, 'the original native modal remains open').to.equal(true);
      host.removeEventListener(requestName(tag), vetoFirst);
    } finally {
      host.remove();
      native.close();
    }
  });
}

it('keeps a closed lower layer open until the upper layers are dismissed', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><dialog><button>Existing modal</button></dialog></div>`);
  const native = wrapper.querySelector<HTMLDialogElement>('dialog')!;
  const layers = Array.from({ length: 3 }, (_, index) => {
    const panel = document.createElement('lr-responsive-panel');
    panel.setAttribute('mode', 'overlay');
    panel.setAttribute('data-lr-theme-scope', '');
    panel.style.cssText = 'inline-size:320px;block-size:240px;--lr-transition-base:0ms';
    const action = document.createElement('button');
    action.textContent = `Layer ${index + 1} action`;
    panel.append(action);
    return { panel, action };
  });
  const [bottom, middle, upper] = layers;

  try {
    native.showModal();
    for (const { panel } of layers) {
      wrapper.append(panel);
      panel.open = true;
      await panel.updateComplete;
      await waitUntil(() => Boolean(panel.shadowRoot!.querySelector<HTMLDialogElement>('[data-native-modal-carrier]')?.matches(':modal')), 'each layer establishes native modality before opening the next');
      let setupClicks = 0;
      panel.querySelector('button')!.addEventListener('click', () => setupClicks += 1, { once: true });
      await click(panel.querySelector<HTMLButtonElement>('button')!);
      expect(setupClicks, `layer ${layers.findIndex(layer => layer.panel === panel) + 1} accepts a pointer before the next opens`).to.equal(1);
    }

    const bottomCarrier = bottom!.panel.shadowRoot!.querySelector<HTMLDialogElement>('[data-native-modal-carrier]')!;
    const bottomClosed = oneEvent(bottomCarrier, 'close');
    bottomCarrier.close();
    await bottomClosed;
    expect(bottom!.panel.open, 'an obscured close keeps the lower public state open').to.equal(true);
    expect(middle!.panel.open).to.equal(true);
    expect(upper!.panel.open).to.equal(true);

    let upperClicks = 0;
    upper!.action.addEventListener('click', () => upperClicks += 1);
    await waitUntil(() => upper!.action.getBoundingClientRect().width > 0, 'the upper action is laid out');
    await click(upper!.action);
    expect(upperClicks, 'the upper overlay remains interactive above the closed lower layer').to.equal(1);
    await focusByKeyboard(upper!.action, upper!.panel);
    expect(deepActiveElement(document) === upper!.action, 'the upper action accepts keyboard focus').to.equal(true);

    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !upper!.panel.open, 'Escape dismisses the top layer');
    expect(middle!.panel.open, 'dismissing the upper layer leaves the middle layer open').to.equal(true);
    expect(bottom!.panel.open, 'dismissing the upper layer leaves the bottom layer open').to.equal(true);
    let middleClicks = 0;
    middle!.action.addEventListener('click', () => middleClicks += 1);
    await waitUntil(() => middle!.action.getBoundingClientRect().width > 0, 'the middle action is laid out');
    await click(middle!.action);
    expect(middleClicks, 'the middle overlay becomes interactive next').to.equal(1);
    await focusByKeyboard(middle!.action, middle!.panel);
    expect(deepActiveElement(document) === middle!.action, 'the middle action accepts keyboard focus').to.equal(true);

    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !middle!.panel.open, 'the middle layer accepts Escape after the upper closes');
    await waitUntil(() => bottomCarrier.matches(':modal'), 'the open lower layer resumes when exposed');
    let bottomClicks = 0;
    bottom!.action.addEventListener('click', () => bottomClicks += 1);
    await waitUntil(() => bottom!.action.getBoundingClientRect().width > 0, 'the lower action is laid out');
    await click(bottom!.action);
    expect(bottomClicks, 'the resumed lower overlay is interactive').to.equal(1);
    await focusByKeyboard(bottom!.action, bottom!.panel);
    expect(deepActiveElement(document) === bottom!.action, 'the lower action accepts keyboard focus after recovery').to.equal(true);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !bottom!.panel.open, 'the exposed lower layer accepts Escape');
    expect(native.open, 'the original native modal remains open').to.equal(true);
  } finally {
    for (const { panel } of layers) panel.remove();
    native.close();
  }
});

it('keeps a separately authored native dialog usable above an owned overlay', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><dialog><button>Existing modal</button></dialog></div>`);
  const outer = wrapper.querySelector<HTMLDialogElement>('dialog')!;
  const panel = document.createElement('lr-responsive-panel');
  panel.setAttribute('mode', 'overlay');
  panel.setAttribute('data-lr-theme-scope', '');
  panel.style.cssText = 'inline-size:320px;block-size:240px;--lr-transition-base:0ms';
  const panelAction = document.createElement('button');
  panelAction.textContent = 'Panel action';
  panel.append(panelAction);
  const authored = document.createElement('dialog');
  const foreignAction = document.createElement('button');
  foreignAction.textContent = 'Foreign action';
  authored.append(foreignAction);
  wrapper.append(panel, authored);

  try {
    outer.showModal();
    panel.open = true;
    await panel.updateComplete;
    const carrier = panel.shadowRoot!.querySelector<HTMLDialogElement>('[data-native-modal-carrier]')!;
    await waitUntil(() => carrier.matches(':modal'));

    authored.showModal();
    const carrierClosed = oneEvent(carrier, 'close');
    carrier.close();
    await carrierClosed;
    expect(panel.open, 'externally closing the lower carrier preserves the owned overlay state').to.equal(true);
    expect(carrier.matches(':modal'), 'the authored dialog remains above the closed owned carrier').to.equal(false);
    expect(authored.open, 'the separately authored dialog remains open').to.equal(true);

    let clicks = 0;
    foreignAction.addEventListener('click', () => clicks += 1);
    await waitUntil(() => foreignAction.getBoundingClientRect().width > 0, 'the authored dialog action is laid out');
    await click(foreignAction);
    expect(clicks, 'pointer activation reaches the authored native dialog').to.equal(1);
    await focusByKeyboard(foreignAction, authored);
    expect(deepActiveElement(document) === foreignAction, 'the authored dialog action accepts keyboard focus').to.equal(true);

    const authoredClosed = oneEvent(authored, 'close');
    await sendKeys({ press: 'Escape' });
    await authoredClosed;
    await waitUntil(() => !authored.open, 'Escape closes the authored native dialog');
    expect(panel.open, 'the owned overlay remains open').to.equal(true);
    await waitUntil(() => carrier.matches(':modal'), 'the owned carrier resumes after the authored dialog closes');
    let panelClicks = 0;
    panelAction.addEventListener('click', () => panelClicks += 1);
    await click(panelAction);
    expect(panelClicks, 'the recovered owned overlay remains pointer-interactive').to.equal(1);
    await focusByKeyboard(panelAction, panel);
    expect(deepActiveElement(document) === panelAction, 'the recovered owned action accepts keyboard focus').to.equal(true);

    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !panel.open, 'Escape closes the owned overlay next');
    expect(outer.open, 'the original native modal remains open').to.equal(true);
  } finally {
    authored.close();
    panel.remove();
    outer.close();
  }
});
