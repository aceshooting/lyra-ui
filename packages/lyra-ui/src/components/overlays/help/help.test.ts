import { expect, fixture, html, nextFrame, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { LyraHelp } from './help.class.js';
import type { LyraPopover } from '../../lr-popover.js';
import { registerLyraLocale, setLyraLocale } from '../../../internal/localization.js';
import { focusAfterPointer, focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-help.js';
import '../../lr-stat.js';

function parts(el: LyraHelp) {
  const popover = el.shadowRoot!.querySelector<LyraPopover>('[part~="popover"]')!;
  const trigger = el.shadowRoot!.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('[part~="trigger"]')!;
  const control = (): HTMLButtonElement => trigger.shadowRoot!.querySelector('button')!;
  return { popover, trigger, control };
}

async function mount(markup = html`<lr-help>Distinct accounts in the last 30 days.</lr-help>`): Promise<LyraHelp> {
  const el = await fixture<LyraHelp>(markup);
  const { popover, trigger } = parts(el);
  await Promise.all([popover.updateComplete, trigger.updateComplete]);
  return el;
}

it('names the trigger with the localized default, a registered catalog, or label', async () => {
  const el = await mount();
  const { control } = parts(el);
  expect(control().getAttribute('aria-label')).to.equal('Details');

  registerLyraLocale('x-test-help', { details: 'Détails', popover: 'Fenêtre' });
  el.locale = 'x-test-help';
  await el.updateComplete;
  await parts(el).trigger.updateComplete;
  expect(control().getAttribute('aria-label')).to.equal('Détails');
  setLyraLocale('en');

  el.label = 'About monthly users';
  await el.updateComplete;
  await parts(el).trigger.updateComplete;
  expect(control().getAttribute('aria-label')).to.equal('About monthly users');
});

it('names the popup with the same resolved name as the trigger', async () => {
  const el = await mount();
  const popupName = async (): Promise<string | null> => {
    const { popover } = parts(el);
    await el.updateComplete;
    await popover.updateComplete;
    return popover.shadowRoot!.querySelector('[part~="popup"]')!.getAttribute('aria-label');
  };
  expect(await popupName()).to.equal('Details');
  el.label = 'About monthly users';
  expect(await popupName()).to.equal('About monthly users');
});

it('opens on click, pins until a second click, and is accessible while open', async () => {
  const el = await mount();
  const { popover, control } = parts(el);
  const shown = oneEvent(popover, 'lr-after-show');
  control().click();
  await shown;
  expect(popover.open).to.equal(true);
  expect(control().getAttribute('aria-expanded')).to.equal('true');
  await expect(el).to.be.accessible();
  const hidden = oneEvent(popover, 'lr-after-hide');
  control().click();
  await hidden;
  expect(popover.open).to.equal(false);
});

it('reveals on keyboard focus only and Escape closes it with focus kept on the trigger', async () => {
  const el = await mount();
  const { popover, control } = parts(el);
  let shows = 0;
  popover.addEventListener('lr-show', () => shows++);
  await focusAfterPointer(control());
  // lr-help keeps the default zero show delay, so a reveal would be requested within the focus
  // task; two frames are ample for a deferred one to surface.
  await nextFrame();
  await nextFrame();
  expect(shows, 'pointer focus requests no reveal').to.equal(0);
  expect(popover.open, 'pointer focus does not open').to.equal(false);
  control().blur();

  await focusByKeyboard(control());
  await waitUntil(() => popover.open, 'keyboard focus reveals the explanation');
  await sendKeys({ press: 'Escape' });
  await waitUntil(() => !popover.open, 'Escape closes it');
  expect(el.shadowRoot!.activeElement === parts(el).trigger).to.equal(true);
});

it('forwards placement and sits in the lr-stat actions slot without entering a stat link', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-stat label="Uptime" value="99.9" href="#uptime"><lr-help slot="actions" placement="bottom">Probe share.</lr-help></lr-stat>
    <lr-stat label="Errors" value="3"></lr-stat>
  </div>`);
  const [linked, plain] = [...wrapper.querySelectorAll('lr-stat')];
  const help = wrapper.querySelector<LyraHelp>('lr-help')!;
  await Promise.all([linked!.updateComplete, plain!.updateComplete, help.updateComplete]);
  expect(parts(help).popover.placement).to.equal('bottom');
  const actions = linked!.shadowRoot!.querySelector<HTMLElement>('[part="actions"]')!;
  expect(actions.hidden).to.equal(false);
  expect(actions.closest('a') === null).to.equal(true);
  expect(plain!.shadowRoot!.querySelector<HTMLElement>('[part="actions"]')!.hidden, 'empty slot collapses').to.equal(true);
  const label = linked!.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
  expect(Math.abs(actions.getBoundingClientRect().top - label.getBoundingClientRect().top)).to.be.lessThan(8);
  help.remove();
  await waitUntil(() => actions.hidden, 'removing the action collapses the slot');
});
