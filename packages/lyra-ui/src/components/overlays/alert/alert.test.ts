import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraAlert } from './alert.js';
import './alert.js';

const motionless = '--lr-duration-fast: 0ms;';

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

afterEach(() => {
  document.querySelectorAll('lr-alert').forEach((alert) => alert.remove());
});

it('is closed by default with the exact Shoelace-compatible property defaults', async () => {
  const el = (await fixture(html`<lr-alert></lr-alert>`)) as LyraAlert;

  expect(el.open).to.be.false;
  expect(el.closable).to.be.false;
  expect(el.countdown).to.equal(undefined);
  expect(el.duration).to.equal(Infinity);
  expect(el.variant).to.equal('primary');
  expect(el.hasAttribute('open')).to.be.false;
  expect(getComputedStyle(el).display).to.equal('none');
});

it('accepts and reflects the complete public attribute vocabulary', async () => {
  const el = (await fixture(html`
    <lr-alert open closable countdown="rtl" duration="2500" variant="danger">Message</lr-alert>
  `)) as LyraAlert;

  expect(el.open).to.be.true;
  expect(el.closable).to.be.true;
  expect(el.countdown).to.equal('rtl');
  expect(el.duration).to.equal(2500);
  expect(el.variant).to.equal('danger');

  el.countdown = 'ltr';
  el.variant = 'success';
  await el.updateComplete;
  expect(el.getAttribute('countdown')).to.equal('ltr');
  expect(el.getAttribute('variant')).to.equal('success');
});

it('renders exactly the documented slots and part aliases', async () => {
  const el = (await fixture(html`
    <lr-alert open closable>
      <span slot="icon" aria-hidden="true">!</span>
      A message
    </lr-alert>
  `)) as LyraAlert;

  const slotNames = Array.from(el.shadowRoot!.querySelectorAll('slot'))
    .map((slot) => slot.name)
    .sort();
  expect(slotNames).to.deep.equal(['', 'icon']);

  const parts = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part]'))
    .flatMap((node) => (node.getAttribute('part') ?? '').split(/\s+/))
    .filter(Boolean)
    .sort();
  expect(parts).to.deep.equal([
    'base',
    'close-button',
    'close-button__base',
    'icon',
    'message',
  ]);

  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="close-button"]')!;
  expect(close.getAttribute('part')).to.equal('close-button close-button__base');
});

it('seeds an initially assigned icon before first render without a hidden-state flash', async () => {
  const el = document.createElement('lr-alert') as LyraAlert;
  const icon = document.createElement('span');
  icon.slot = 'icon';
  icon.textContent = '!';
  el.append(icon);
  document.body.append(el);
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector<HTMLElement>('[part="icon"]')!.hidden).to.be.false;
});

it('does not reserve icon chrome for an empty slot or slot fallback', async () => {
  const el = (await fixture(html`<lr-alert open>Message</lr-alert>`)) as LyraAlert;
  const icon = el.shadowRoot!.querySelector<HTMLElement>('[part="icon"]')!;
  expect(icon.hidden, 'an unassigned icon slot stays hidden').to.be.true;

  const slot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="icon"]')!;
  slot.append(document.createTextNode('internal fallback'));
  slot.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;
  expect(icon.hidden, 'slot fallback is component chrome, not consumer-provided presence').to.be.true;
});

it('localizes the close action and lets per-instance strings reach the rendered button', async () => {
  const el = (await fixture(html`<lr-alert open closable>Message</lr-alert>`)) as LyraAlert;
  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="close-button"]')!;
  expect(close.getAttribute('aria-label')).to.equal('Close');

  el.strings = { close: 'Dismiss notification' };
  await el.updateComplete;
  expect(close.getAttribute('aria-label')).to.equal('Dismiss notification');
});

it('show() and hide() emit the exact lifecycle in order, vetoable only at lr-show/lr-hide', async () => {
  const el = (await fixture(html`<lr-alert style=${motionless}>Message</lr-alert>`)) as LyraAlert;
  const seen: string[] = [];
  for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide'] as const) {
    el.addEventListener(name, (event) => {
      expect(event.bubbles).to.be.true;
      expect(event.composed).to.be.true;
      // `lr-show`/`lr-hide` are veto points library-wide; the settled after-events are not.
      expect(event.cancelable).to.equal(!name.startsWith('lr-after'));
      seen.push(name);
    });
  }

  await el.show();
  expect(el.open).to.be.true;
  expect(el.hasAttribute('open')).to.be.true;
  expect(seen).to.deep.equal(['lr-show', 'lr-after-show']);

  await el.hide();
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
  expect(seen).to.deep.equal(['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']);
});

it('runs the same lifecycle for direct open assignments without announcing initial open markup', async () => {
  const initial = (await fixture(html`
    <lr-alert open style=${motionless}>Initially visible</lr-alert>
  `)) as LyraAlert;
  let initialEvents = 0;
  initial.addEventListener('lr-show', () => initialEvents++);
  await initial.updateComplete;
  await delay(20);
  expect(initialEvents).to.equal(0);

  const el = (await fixture(html`<lr-alert style=${motionless}>Message</lr-alert>`)) as LyraAlert;
  const shown = oneEvent(el, 'lr-after-show');
  el.open = true;
  await shown;
  expect(el.open).to.be.true;

  const hidden = oneEvent(el, 'lr-after-hide');
  el.open = false;
  await hidden;
  expect(el.open).to.be.false;
});

it('treats show() called immediately after connection as an operation, not silent initial state', async () => {
  const el = document.createElement('lr-alert') as LyraAlert;
  el.style.setProperty('--lr-duration-fast', '0ms');
  document.body.append(el);
  const seen: string[] = [];
  el.addEventListener('lr-show', () => seen.push('lr-show'));
  el.addEventListener('lr-after-show', () => seen.push('lr-after-show'));

  await el.show();
  expect(seen).to.deep.equal(['lr-show', 'lr-after-show']);
});

it('the close button hides the alert through the public lifecycle', async () => {
  const el = (await fixture(html`
    <lr-alert open closable style=${motionless}>Message</lr-alert>
  `)) as LyraAlert;
  const hidden = oneEvent(el, 'lr-after-hide');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="close-button"]')!.click();
  await hidden;
  expect(el.open).to.be.false;
});

it('auto-hides after duration and restarts the full timer after interaction', async () => {
  const el = (await fixture(html`
    <lr-alert duration="80" style=${motionless}>Timed message</lr-alert>
  `)) as LyraAlert;
  await el.show();
  await delay(55);
  el.dispatchEvent(new Event('pointerenter'));
  await delay(60);
  expect(el.open, 'interaction pauses the timer').to.be.true;

  el.dispatchEvent(new Event('pointerleave'));
  await delay(45);
  expect(el.open, 'leaving restarts the entire duration rather than only the remainder').to.be.true;
  await waitUntil(() => !el.open, 'duration should eventually hide the alert', { timeout: 300 });
});

it('normalizes hostile duration values before timer math', async () => {
  const el = (await fixture(html`
    <lr-alert duration="Infinity" style=${motionless}>Persistent</lr-alert>
  `)) as LyraAlert;
  await el.show();
  await delay(30);
  expect(el.open).to.be.true;

  el.duration = Number.NaN;
  await el.updateComplete;
  await waitUntil(() => !el.open, 'NaN normalizes to an immediate safe timeout', { timeout: 200 });
});

it('renders the optional countdown in the requested physical direction', async () => {
  const el = (await fixture(html`
    <lr-alert countdown="ltr" duration="1000" style=${motionless}>Timed</lr-alert>
  `)) as LyraAlert;
  await el.show();
  const countdown = el.shadowRoot!.querySelector<HTMLElement>('.countdown')!;
  expect(countdown.getAttribute('aria-hidden')).to.equal('true');
  expect(countdown.style.transformOrigin.startsWith('left center')).to.be.true;

  el.countdown = 'rtl';
  await el.updateComplete;
  expect(countdown.style.transformOrigin.startsWith('right center')).to.be.true;
  await el.hide();
});

it('keeps countdown direction explicit inside an RTL page', async () => {
  const wrapper = await fixture(html`
    <div dir="rtl">
      <lr-alert countdown="ltr" duration="1000" style=${motionless}>Timed</lr-alert>
    </div>
  `);
  const el = wrapper.querySelector('lr-alert') as LyraAlert;
  await el.show();
  expect(el.effectiveDirection).to.equal('rtl');
  expect(
    el.shadowRoot!.querySelector<HTMLElement>('.countdown')!.style.transformOrigin.startsWith('left center'),
  ).to.be.true;
  await el.hide();
});

it('reduces show/hide and countdown motion when the user requests it', async () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
  try {
    const el = (await fixture(html`
      <lr-alert countdown="rtl" duration="1000">Reduced motion</lr-alert>
    `)) as LyraAlert;
    await el.show();
    expect(el.shadowRoot!.querySelector<HTMLElement>('.countdown')!.getAnimations().length).to.equal(0);
    await el.hide();
  } finally {
    window.matchMedia = original;
  }
});

it('toast() moves the same alert into the shared Lyra toast stack and removes it after hiding', async () => {
  const el = (await fixture(html`
    <lr-alert closable style=${motionless}>Toast message</lr-alert>
  `)) as LyraAlert;
  const completion = el.toast();
  await waitUntil(() => el.parentElement?.localName === 'lr-toast');
  expect(el.open).to.be.true;
  expect(document.querySelectorAll('lr-toast').length).to.equal(1);

  await el.hide();
  await completion;
  expect(el.isConnected).to.be.false;
});

it('toast() can reuse the same identity after its previous dismissal', async () => {
  const el = (await fixture(html`
    <lr-alert style=${motionless}>Reusable toast</lr-alert>
  `)) as LyraAlert;
  const first = el.toast();
  await waitUntil(() => el.open);
  await el.hide();
  await first;

  const second = el.toast();
  await waitUntil(() => el.open);
  expect(el.parentElement?.localName).to.equal('lr-toast');
  await el.hide();
  await second;
});

it('disconnecting an open timed alert clears stale work and reconnect restarts its timer', async () => {
  const el = (await fixture(html`
    <lr-alert duration="70" style=${motionless}>Reconnect me</lr-alert>
  `)) as LyraAlert;
  await el.show();
  el.remove();
  await delay(100);
  expect(el.open).to.be.true;

  document.body.append(el);
  await el.updateComplete;
  await waitUntil(() => !el.open, 'the timer resumes from a fresh duration after reconnect', {
    timeout: 250,
  });
});

it('fits long populated content in a 320px allocation', async () => {
  const wrapper = await fixture(html`
    <div style="width: 320px;">
      <lr-alert open closable>
        <span slot="icon" aria-hidden="true">!</span>
        This_is_a_deliberately_very_long_unbroken_alert_message_that_must_wrap_inside_the_allocation.
      </lr-alert>
    </div>
  `);
  const el = wrapper.querySelector('lr-alert') as LyraAlert;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect(base.getBoundingClientRect().width).to.be.at.most(320);
  expect(base.scrollWidth).to.be.at.most(Math.ceil(base.clientWidth) + 1);
});

it('is accessible while closed and when populated/open/closable', async () => {
  const closed = (await fixture(html`<lr-alert>Hidden message</lr-alert>`)) as LyraAlert;
  await expect(closed).to.be.accessible();

  const open = (await fixture(html`
    <lr-alert open closable variant="warning">
      <span slot="icon" aria-hidden="true">!</span>
      Review the pending changes.
    </lr-alert>
  `)) as LyraAlert;
  expect(open.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('alert');
  await expect(open).to.be.accessible();
});

it('pauses the auto-hide timer while focus is inside and resumes when it leaves', async () => {
  const el = (await fixture(html`
    <lr-alert duration="80" closable style=${motionless}>Focusable message</lr-alert>
  `)) as LyraAlert;
  await el.show();

  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  await delay(120);
  expect(el.open, 'focus inside pauses the timer').to.be.true;

  // A focusout whose next target is still inside the alert must not resume the timer.
  const closeButton = el.shadowRoot!.querySelector('[part~="close-button"]') as HTMLElement;
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: closeButton }));
  await delay(120);
  expect(el.open, 'focus moving within the alert keeps the timer paused').to.be.true;

  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
  await waitUntil(() => !el.open, 'leaving the alert should restart and finish the timer', { timeout: 400 });
});

it('honours preventDefault() on lr-show and lr-hide', async () => {
  const el = (await fixture(html`<lr-alert style=${motionless}>Message</lr-alert>`)) as LyraAlert;
  el.addEventListener('lr-show', (event) => event.preventDefault(), { once: true });
  await el.show();
  expect(el.open, 'a vetoed open never applies').to.be.false;
  expect(el.hasAttribute('open')).to.be.false;

  await el.show();
  expect(el.open, 'the veto was one-shot').to.be.true;

  el.addEventListener('lr-hide', (event) => event.preventDefault(), { once: true });
  await el.hide();
  expect(el.open, 'a vetoed close stays open').to.be.true;
  expect(el.hasAttribute('open')).to.be.true;
});

it('keeps the reflected open attribute in step when a veto arrives through the attribute', async () => {
  const el = (await fixture(html`<lr-alert style=${motionless}>Message</lr-alert>`)) as LyraAlert;
  el.addEventListener('lr-show', (event) => event.preventDefault());
  el.setAttribute('open', '');
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open'), 'the attribute cannot outlive the vetoed property').to.be.false;
});

it('never offers a veto for initially-open markup', async () => {
  let vetoable = 0;
  const el = (await fixture(html`<lr-alert open style=${motionless}>Message</lr-alert>`)) as LyraAlert;
  el.addEventListener('lr-show', (event) => { if (event.cancelable) vetoable += 1; });
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(vetoable, 'declarative state is not a transition').to.equal(0);
});
