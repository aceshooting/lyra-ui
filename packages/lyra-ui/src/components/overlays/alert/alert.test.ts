import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
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

  el.open = false;
  expect(el.open).to.be.false;
});

it('settles hide() safely when invoked before the first connection', async () => {
  const el = document.createElement('lr-alert') as LyraAlert;
  const hidden = el.hide();
  document.body.append(el);
  await hidden;

  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
});

it('serializes the default host role while preserving an authored alternate role across reconnect', async () => {
  const implicit = (await fixture(html`<lr-alert>Message</lr-alert>`)) as LyraAlert;
  expect(implicit.role).to.equal('alert');
  expect(implicit.getAttribute('role')).to.equal('alert');

  const authored = (await fixture(html`<lr-alert role="status">Status update</lr-alert>`)) as LyraAlert;
  expect(authored.role).to.equal('status');
  expect(authored.getAttribute('role')).to.equal('status');
  const parent = authored.parentElement!;
  authored.remove();
  parent.append(authored);
  await authored.updateComplete;
  expect(authored.role).to.equal('status');
  expect(authored.getAttribute('role')).to.equal('status');
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

it('normalizes unsupported closed-set attributes and untyped property writes', async () => {
  const el = (await fixture(html`
    <lr-alert countdown="sideways" variant="brand"></lr-alert>
  `)) as LyraAlert;
  expect(el.countdown).to.equal(undefined);
  expect(el.hasAttribute('countdown')).to.be.false;
  expect(el.variant).to.equal('primary');
  expect(el.getAttribute('variant')).to.equal('primary');

  el.countdown = 'rtl';
  el.variant = 'danger';
  await el.updateComplete;
  const foreign = el as unknown as Record<string, unknown>;
  foreign['countdown'] = 'diagonal';
  foreign['variant'] = 'loud';
  await el.updateComplete;
  expect(el.countdown).to.equal(undefined);
  expect(el.hasAttribute('countdown')).to.be.false;
  expect(el.variant).to.equal('primary');
  expect(el.getAttribute('variant')).to.equal('primary');
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

it('keeps flattened interactive icon content visible but inert beside the close action', async () => {
  const root = await fixture<HTMLElement>(html`<div>
    <button id="before-alert-icon" type="button">Before</button>
    <lr-alert open closable style=${motionless}>
      <a id="nested-alert-icon" slot="icon" href="#nested-alert-icon">!</a>
      Important message
    </lr-alert>
  </div>`);
  const el = root.querySelector('lr-alert') as LyraAlert;
  const before = root.querySelector<HTMLButtonElement>('#before-alert-icon')!;
  const nested = root.querySelector<HTMLAnchorElement>('#nested-alert-icon')!;
  const icon = el.shadowRoot!.querySelector<HTMLElement>('[part="icon"]')!;
  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="close-button"]')!;

  expect(icon.getAttribute('aria-hidden')).to.equal('true');
  expect(icon.hasAttribute('inert')).to.equal(true);
  expect(nested.getBoundingClientRect().width).to.be.greaterThan(0);
  before.focus();
  nested.focus();
  expect(el.ownerDocument.activeElement === before).to.equal(true);
  close.focus();
  expect(el.shadowRoot!.activeElement === close).to.equal(true);
  await expect(el).to.be.accessible();
});

it('localizes the close action and lets per-instance strings reach the rendered button', async () => {
  const el = (await fixture(html`<lr-alert open closable>Message</lr-alert>`)) as LyraAlert;
  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="close-button"]')!;
  expect(close.getAttribute('aria-label')).to.equal('Close');

  el.strings = { close: 'Dismiss notification' };
  await el.updateComplete;
  expect(close.getAttribute('aria-label')).to.equal('Dismiss notification');
});

it('inherits the host font through the close control and its 1em glyph', async () => {
  const el = (await fixture(html`
    <lr-alert open closable style="font-size: 20px">Message</lr-alert>
  `)) as LyraAlert;
  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="close-button"]')!;
  const glyph = close.querySelector<SVGElement>('svg')!;

  expect(getComputedStyle(el).fontSize).to.equal('20px');
  expect(getComputedStyle(close).fontSize).to.equal('20px');
  expect(glyph.getAttribute('width')).to.equal('1em');
  expect(glyph.getAttribute('height')).to.equal('1em');
  expect(getComputedStyle(glyph).fontSize).to.equal('20px');
  expect(getComputedStyle(glyph).width).to.equal('20px');
  expect(getComputedStyle(glyph).height).to.equal('20px');
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

it('gives static and later-open alerts one light-DOM host role without a duplicate live sink', async () => {
  const el = (await fixture(html`
    <lr-alert open closable style=${motionless}>
      <span slot="icon"><span aria-hidden="true">Decorative icon text</span></span>
      Initially visible message
    </lr-alert>
  `)) as LyraAlert;
  const sinkSelector = `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`;

  expect(el.getAttribute('role')).to.equal('alert');
  expect(el.shadowRoot!.querySelector('[role="alert"], [aria-live]') === null).to.be.true;
  expect(
    el.shadowRoot!.querySelector<HTMLElement>('[part="icon"]')?.getAttribute('aria-hidden'),
  ).to.equal('true');
  expect(
    document.querySelector(sinkSelector) === null,
    'the semantic host is the only assertive surface',
  ).to.be.true;

  await el.hide();
  await el.show();

  expect(el.getAttribute('role')).to.equal('alert');
  expect(document.querySelector(sinkSelector) === null).to.be.true;
});

it('restores host alert semantics after reconnect without creating a shadow or shared live region', async () => {
  const el = (await fixture(html`
    <lr-alert style=${motionless}>Reconnect announcement</lr-alert>
  `)) as LyraAlert;
  const sinkSelector = `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`;

  await el.show();
  expect(el.getAttribute('role')).to.equal('alert');
  expect(document.querySelector(sinkSelector) === null).to.be.true;

  el.remove();
  el.removeAttribute('role');

  document.body.append(el);
  expect(el.getAttribute('role')).to.equal('alert');
  expect(el.shadowRoot!.querySelector('[role="alert"], [aria-live]') === null).to.be.true;
  expect(document.querySelector(sinkSelector) === null).to.be.true;
  el.remove();
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

it('repairs focused close actions only after the hide lifecycle is accepted', async () => {
  const host = await fixture<HTMLDivElement>(html`
    <div>
      <lr-alert open closable style=${motionless}>Message</lr-alert>
      <button id="after-alert">After</button>
    </div>
  `);
  const el = host.querySelector('lr-alert') as LyraAlert;
  const after = host.querySelector<HTMLButtonElement>('#after-alert')!;
  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="close-button"]')!;
  const veto = (event: Event): void => event.preventDefault();
  el.addEventListener('lr-hide', veto);
  close.focus();
  close.click();
  expect(el.shadowRoot!.activeElement === close).to.equal(true);
  expect(el.open).to.equal(true);

  el.removeEventListener('lr-hide', veto);
  close.click();
  expect(el.ownerDocument.activeElement === after).to.equal(true);
  await el.updateComplete;
  expect(el.open).to.equal(false);
});

it('repairs direct open=false writes without overriding a newer hide-listener destination', async () => {
  const host = await fixture<HTMLDivElement>(html`
    <div>
      <button id="explicit-alert-focus">Explicit</button>
      <lr-alert open closable style=${motionless}>Message</lr-alert>
      <button id="after-direct-alert">After</button>
    </div>
  `);
  const el = host.querySelector('lr-alert') as LyraAlert;
  const explicit = host.querySelector<HTMLButtonElement>('#explicit-alert-focus')!;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="close-button"]')!.focus();
  el.open = false;
  expect(el.ownerDocument.activeElement?.id).to.equal('after-direct-alert');
  await el.updateComplete;

  el.open = true;
  await el.updateComplete;
  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="close-button"]')!;
  el.addEventListener('lr-hide', () => explicit.focus(), { once: true });
  close.focus();
  el.open = false;
  await el.updateComplete;
  expect(el.ownerDocument.activeElement === explicit).to.equal(true);
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
  expect(
    (el as unknown as { readonly effectiveDirection: 'ltr' | 'rtl' }).effectiveDirection,
  ).to.equal('rtl');
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

it('uses the adopted owner realm for motion preferences and focus containment', async () => {
  const frame = document.createElement('iframe');
  const loaded = oneEvent(frame, 'load');
  frame.srcdoc = '<!doctype html><html><body></body></html>';
  document.body.append(frame);
  await loaded;

  const frameDocument = frame.contentDocument!;
  const frameView = frame.contentWindow!;
  const parentMatchMedia = window.matchMedia;
  const frameMatchMedia = frameView.matchMedia;
  let parentQueries = 0;
  let frameQueries = 0;
  const mediaResult = (query: string, matches: boolean): MediaQueryList => ({
    matches,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });

  window.matchMedia = ((query: string) => {
    parentQueries += 1;
    return mediaResult(query, false);
  }) as typeof window.matchMedia;
  frameView.matchMedia = ((query: string) => {
    frameQueries += 1;
    return mediaResult(query, true);
  }) as typeof frameView.matchMedia;

  let el: LyraAlert | undefined;
  try {
    el = (await fixture(html`
      <lr-alert countdown="ltr" duration="45" style=${motionless}>Adopted alert</lr-alert>
    `)) as LyraAlert;
    el.remove();
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;

    const inside = frameDocument.createElement('button');
    inside.textContent = 'Inside';
    el.append(inside);
    await el.show();

    expect(frameQueries > 0, 'motion queries use the iframe window').to.be.true;
    expect(parentQueries, 'the parent media state is irrelevant after adoption').to.equal(0);

    el.dispatchEvent(new frameView.FocusEvent('focusin', { bubbles: true, composed: true }));
    el.dispatchEvent(new frameView.FocusEvent('focusout', {
      bubbles: true,
      composed: true,
      relatedTarget: inside,
    }));
    await new Promise<void>((resolve) => frameView.setTimeout(resolve, 80));
    expect(el.open, 'an iframe-realm descendant keeps the auto-hide timer paused').to.be.true;

    el.dispatchEvent(new frameView.FocusEvent('focusout', {
      bubbles: true,
      composed: true,
      relatedTarget: frameDocument.body,
    }));
    await waitUntil(() => !el!.open, 'leaving the adopted alert resumes its owner-realm timer', {
      timeout: 300,
    });
  } finally {
    window.matchMedia = parentMatchMedia;
    frameView.matchMedia = frameMatchMedia;
    el?.remove();
    frame.remove();
  }
});

it('fails closed and settles a burst when the adopted owner document has no toast controller', async () => {
  const frame = document.createElement('iframe');
  const loaded = oneEvent(frame, 'load');
  frame.srcdoc = '<!doctype html><html><body></body></html>';
  document.body.append(frame);
  await loaded;

  const frameDocument = frame.contentDocument!;
  try {
    const alerts: LyraAlert[] = [];
    for (let index = 0; index < 24; index += 1) {
      const alert = document.createElement('lr-alert') as LyraAlert;
      alert.duration = Infinity;
      alert.textContent = `Adopted toast ${index + 1}`;
      document.body.append(alert);
      await alert.updateComplete;
      alert.remove();
      frameDocument.body.append(frameDocument.adoptNode(alert));
      alerts.push(alert);
    }
    expect(frame.contentWindow!.customElements.get('lr-toast')).to.equal(undefined);

    const completions = alerts.map((alert) => alert.toast());
    const settled = await Promise.race([
      Promise.all(completions).then(() => true),
      delay(120).then(() => false),
    ]);
    expect(settled, 'an unavailable owner-realm controller cannot strand toast() promises').to.equal(true);
    expect(alerts.every((alert) => !alert.isConnected), 'failed work is removed instead of growing unchecked').to
      .equal(true);
    expect(frameDocument.querySelectorAll('lr-toast').length, 'no unupgraded fallback region remains').to.equal(0);
  } finally {
    frame.remove();
  }
});

it('toast() moves the same alert into the shared Lyra toast stack and removes it after hiding', async () => {
  const el = (await fixture(html`
    <lr-alert closable style=${motionless}>Toast message</lr-alert>
  `)) as LyraAlert;
  const completion = el.toast();
  expect(el.toast() === completion).to.be.true;
  await waitUntil(() => el.parentElement?.localName === 'lr-toast');
  expect(el.open).to.be.true;
  expect(document.querySelectorAll('lr-toast').length).to.equal(1);

  await el.hide();
  await completion;
  expect(el.isConnected).to.be.false;
});

it('hides a queued toast\'s own base surface, not only the host the toast region masks', async () => {
  const alerts: LyraAlert[] = [];
  for (let index = 0; index < 4; index += 1) {
    alerts.push(
      (await fixture(html`<lr-alert style=${motionless}>Queued ${index}</lr-alert>`)) as LyraAlert,
    );
  }
  const completions = alerts.map((alert) => alert.toast());
  const queued = alerts[3]!;
  await waitUntil(() => queued.hasAttribute('data-toast-queued'));
  await queued.updateComplete;
  const base = queued.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect(base.hidden, 'a queued alert marks its own base hidden').to.be.true;
  expect(base.inert, 'and inert -- the platform-enforced half of the pair').to.be.true;

  // <lr-toast> also hides the queued host outright, which masks whether the alert's own sheet
  // honours that hidden attribute. Unmask the host and measure the base itself: [part='base']
  // declares display: grid unconditionally, and an author-origin declaration outranks the UA
  // stylesheet's [hidden] { display: none } whatever their specificities, so without a guard of
  // its own the surface stays laid out. Defence in depth -- the region masking means no shipped
  // consumer sees this today.
  queued.removeAttribute('data-toast-queued');
  // A queued alert is not open either, so :host is display: none as well -- force the host to
  // render so the measurement below is of the base surface, nothing else.
  queued.style.display = 'block';
  await queued.updateComplete;
  expect(getComputedStyle(queued).display).to.equal('block');
  expect(getComputedStyle(base).display).to.equal('none');
  expect(base.getClientRects().length).to.equal(0);

  for (const alert of alerts) alert.remove();
  await Promise.all(completions);
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

it('settles a toast lifecycle when the alert is moved to a different parent instead of removed', async () => {
  const el = (await fixture(html`
    <lr-alert style=${motionless}>Reparented toast</lr-alert>
  `)) as LyraAlert;
  const completion = el.toast();
  await waitUntil(() => el.open && el.parentElement?.localName === 'lr-toast');

  // A direct move (not a remove() + later append()) still fires disconnectedCallback then
  // connectedCallback synchronously -- the toast lifecycle must settle from the reconnect path's
  // own "still not owned by the toast region" check, not only from the lasting-disconnect path.
  document.body.append(el);
  const settled = await Promise.race([
    completion.then(() => true),
    delay(120).then(() => false),
  ]);
  expect(settled, 'moving the alert directly to a different parent must still settle toast()').to.be
    .true;
  expect(el.isConnected, 'the alert stays connected -- it was moved, not removed').to.be.true;
  expect(el.parentElement?.localName).to.equal('body');
});

it('settles an externally removed toast and lets the same alert be toasted again', async () => {
  const el = (await fixture(html`
    <lr-alert style=${motionless}>Externally removed toast</lr-alert>
  `)) as LyraAlert;
  const first = el.toast();
  await waitUntil(() => el.open && el.parentElement?.localName === 'lr-toast');

  el.remove();
  const firstSettled = await Promise.race([
    first.then(() => true),
    delay(120).then(() => false),
  ]);
  expect(firstSettled, 'a lasting external disconnect must settle toast()').to.be.true;

  const second = el.toast();
  expect(second === first, 'a later toast() must create a fresh lifecycle').to.be.false;
  await waitUntil(() => el.parentElement?.localName === 'lr-toast');
  await el.hide();
  await second;
});

it('settles and releases a toast whose initial show is vetoed, so a later toast() can retry', async () => {
  const el = (await fixture(html`
    <lr-alert duration="0" style=${motionless}>Initially vetoed toast</lr-alert>
  `)) as LyraAlert;
  let showRequests = 0;
  el.addEventListener('lr-show', (event) => {
    showRequests += 1;
    if (showRequests === 1) event.preventDefault();
  });

  const first = el.toast();
  const firstSettled = await Promise.race([
    first.then(() => true),
    delay(120).then(() => false),
  ]);
  expect(firstSettled, 'a rejected initial show must settle its toast lifecycle').to.be.true;
  expect(el.isConnected, 'a rejected toast must release the singleton region').to.be.false;
  expect(el.open).to.be.false;

  const second = el.toast();
  expect(second === first, 'the retry must own a fresh lifecycle promise').to.be.false;
  await second;
  expect(showRequests).to.equal(2);
  expect(el.isConnected).to.be.false;
});

it('coalesces reentrant show requests before an outer veto and keeps the retry fresh', async () => {
  const el = (await fixture(html`
    <lr-alert duration="0" style=${motionless}>Reentrant toast</lr-alert>
  `)) as LyraAlert;
  let showRequests = 0;
  let nestedShow: Promise<void> = Promise.resolve();
  el.addEventListener('lr-show', (event) => {
    showRequests += 1;
    if (showRequests !== 1) return;
    el.open = true;
    nestedShow = el.show();
    event.preventDefault();
  });

  const first = el.toast();
  await Promise.all([first, nestedShow]);
  expect(showRequests, 'same-direction requests during the veto point share one event').to.equal(1);
  expect(el.open, 'the outer veto wins before any nested request can commit').to.be.false;
  expect(el.isConnected, 'the rejected toast releases its region').to.be.false;

  const second = el.toast();
  await second;
  expect(showRequests, 'a later toast starts a new request').to.equal(2);
  expect(el.open).to.be.false;
  expect(el.isConnected).to.be.false;
});

it('settles every permanently vetoed toast attempt without retaining stale lifecycle listeners', async () => {
  const el = (await fixture(html`
    <lr-alert style=${motionless}>Always vetoed toast</lr-alert>
  `)) as LyraAlert;
  let showRequests = 0;
  el.addEventListener('lr-show', (event) => {
    showRequests += 1;
    event.preventDefault();
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const completion = el.toast();
    const settled = await Promise.race([
      completion.then(() => true),
      delay(120).then(() => false),
    ]);
    expect(settled, `vetoed attempt ${attempt} must settle`).to.be.true;
    expect(el.isConnected).to.be.false;
  }
  expect(showRequests).to.equal(3);
});

it('queues a fourth alert inertly and promotes it only after an active toast settles', async () => {
  const alerts = Array.from({ length: 4 }, (_, index) => {
    const alert = document.createElement('lr-alert') as LyraAlert;
    alert.textContent = `Queued alert ${index + 1}`;
    alert.style.setProperty('--lr-duration-fast', '0ms');
    return alert;
  });
  const completions = alerts.map((alert) => alert.toast());
  await waitUntil(() => alerts.slice(0, 3).every((alert) => alert.open));

  const queuedBase = alerts[3]!.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect(alerts[3]!.hasAttribute('data-toast-queued')).to.be.true;
  expect(alerts[3]!.open).to.be.false;
  expect(queuedBase.hidden).to.be.true;
  expect(queuedBase.inert).to.be.true;

  await alerts[0]!.hide();
  await completions[0];
  await waitUntil(() => alerts[3]!.open, 'the oldest queued alert should promote');
  expect(alerts[3]!.hasAttribute('data-toast-queued')).to.be.false;
  expect(queuedBase.hidden).to.be.false;
  expect(queuedBase.inert).to.be.false;

  for (const alert of alerts.slice(1)) await alert.hide();
  await Promise.all(completions);
});

it('keeps an already-open alert surface hidden and inert while queued, then releases it on promotion', async () => {
  const alerts = Array.from({ length: 3 }, (_, index) => {
    const alert = document.createElement('lr-alert') as LyraAlert;
    alert.textContent = `Active alert ${index + 1}`;
    alert.style.setProperty('--lr-duration-fast', '0ms');
    return alert;
  });
  const completions = alerts.map((alert) => alert.toast());
  await waitUntil(() => alerts.every((alert) => alert.open));

  const queued = (await fixture(html`
    <lr-alert open closable style=${motionless}>Already open alert</lr-alert>
  `)) as LyraAlert;
  let showRequests = 0;
  queued.addEventListener('lr-show', () => { showRequests += 1; });
  const queuedCompletion = queued.toast();
  await queued.updateComplete;

  const queuedBase = queued.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect(queued.hasAttribute('data-toast-queued')).to.be.true;
  expect(queued.open, 'queueing preserves the accepted open state').to.be.true;
  expect(queuedBase.hidden, 'the inactive internal surface is explicitly hidden').to.be.true;
  expect(queuedBase.inert, 'the inactive internal surface is explicitly inert').to.be.true;

  await alerts[0]!.hide();
  await completions[0];
  await waitUntil(() => !queued.hasAttribute('data-toast-queued'), 'the open alert should promote');
  await queued.updateComplete;
  expect(queuedBase.hidden).to.be.false;
  expect(queuedBase.inert).to.be.false;
  expect(showRequests, 'promotion does not replay a show lifecycle already accepted inline').to.equal(0);

  await queued.hide();
  await queuedCompletion;
  for (const alert of alerts.slice(1)) await alert.hide();
  await Promise.all(completions.slice(1));
});

it('repairs focus when an already-open focused alert enters a full toast region', async () => {
  const active = Array.from({ length: 3 }, (_, index) => {
    const alert = document.createElement('lr-alert') as LyraAlert;
    alert.textContent = `Active focus alert ${index + 1}`;
    alert.style.setProperty('--lr-duration-fast', '0ms');
    return alert;
  });
  const activeCompletions = active.map((alert) => alert.toast());
  await waitUntil(() => active.every((alert) => alert.open));

  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <lr-alert open closable style=${motionless}>Already open focused alert</lr-alert>
      <button id="after-focused-alert">Return target</button>
    </div>
  `);
  const queued = wrapper.querySelector('lr-alert') as LyraAlert;
  const returnTarget = wrapper.querySelector<HTMLButtonElement>('#after-focused-alert')!;
  const close = queued.shadowRoot!.querySelector<HTMLButtonElement>('[part~="close-button"]')!;
  returnTarget.focus();
  close.focus();
  expect(queued.shadowRoot!.activeElement === close).to.equal(true);

  const queuedCompletion = queued.toast();
  await queued.updateComplete;

  expect(queued.hasAttribute('data-toast-queued')).to.equal(true);
  expect(document.activeElement === document.body, 'queue admission must not strand focus on body').to.equal(false);
  expect(document.activeElement === returnTarget, 'focus returns to the adjacent external control').to.equal(true);

  document.querySelector('body > lr-toast')?.remove();
  await Promise.all([...activeCompletions, queuedCompletion]);
});

it('restores focus inside an active alert when its toast lifecycle moves to another active region', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div><lr-alert closable style=${motionless}>Moving active alert</lr-alert><lr-toast></lr-toast></div>
  `);
  const alert = wrapper.querySelector('lr-alert') as LyraAlert;
  const second = wrapper.querySelector('lr-toast')!;
  const completion = alert.toast();
  await waitUntil(() => alert.open);
  const close = alert.shadowRoot!.querySelector<HTMLButtonElement>('[part~="close-button"]')!;
  close.focus();
  expect(alert.shadowRoot!.activeElement === close).to.equal(true);

  second.append(alert);
  await delay(0);

  expect(alert.hasAttribute('data-toast-queued')).to.equal(false);
  expect(
    alert.shadowRoot!.activeElement === close,
    'the focused control remains the logical target when the alert remains active',
  ).to.equal(true);
  await alert.hide();
  await completion;
  expect(alert.isConnected).to.equal(false);
});

it('discards stale managed alerts before a toast region is reconnected after a lasting disconnect', async () => {
  const alert = document.createElement('lr-alert') as LyraAlert;
  alert.textContent = 'stale region alert';
  alert.style.setProperty('--lr-duration-fast', '0ms');
  const completion = alert.toast();
  await waitUntil(() => alert.open && alert.parentElement?.localName === 'lr-toast');
  const region = alert.parentElement!;

  region.remove();
  const settled = await Promise.race([completion.then(() => true), delay(120).then(() => false)]);
  expect(settled).to.equal(true);
  document.body.append(region);
  await delay(0);

  expect(alert.isConnected, 'a settled toast must not resurrect when its old region reconnects').to.equal(false);
  expect(region.children.length).to.equal(0);
});

it('resumes same-task show and hide transitions after reconnect with exactly one terminal event', async () => {
  const el = (await fixture(html`
    <lr-alert closable style="--lr-duration-fast: 30ms;">Transition reconnect</lr-alert>
  `)) as LyraAlert;
  const parent = el.parentElement!;
  let afterShowCount = 0;
  let afterHideCount = 0;
  el.addEventListener('lr-after-show', () => afterShowCount++);
  el.addEventListener('lr-after-hide', () => afterHideCount++);

  const showStarted = oneEvent(el, 'lr-show');
  const shown = el.show();
  await showStarted;
  el.remove();
  parent.append(el);
  const showCompleted = await Promise.race([
    waitUntil(() => afterShowCount === 1).then(() => true),
    delay(250).then(() => false),
  ]);
  expect(showCompleted, 'the accepted show must reach its terminal event after reconnect').to.equal(true);
  await shown;
  expect(afterShowCount).to.equal(1);

  const hideStarted = oneEvent(el, 'lr-hide');
  const hidden = el.hide();
  await hideStarted;
  el.remove();
  parent.append(el);
  const hideCompleted = await Promise.race([
    waitUntil(() => afterHideCount === 1).then(() => true),
    delay(250).then(() => false),
  ]);
  expect(hideCompleted, 'the accepted hide must reach its terminal event after reconnect').to.equal(true);
  await hidden;
  expect(afterHideCount).to.equal(1);
});

it('settles disconnected method promises but resumes their terminal lifecycle after a later reconnect', async () => {
  const el = (await fixture(html`
    <lr-alert style="--lr-duration-fast: 30ms;">Later transition reconnect</lr-alert>
  `)) as LyraAlert;
  const parent = el.parentElement!;
  let afterShowCount = 0;
  let afterHideCount = 0;
  el.addEventListener('lr-after-show', () => afterShowCount++);
  el.addEventListener('lr-after-hide', () => afterHideCount++);

  const showStarted = oneEvent(el, 'lr-show');
  const shown = el.show();
  await showStarted;
  el.remove();
  await shown;
  expect(afterShowCount, 'disconnect settles the method without a detached terminal event').to.equal(0);
  parent.append(el);
  await waitUntil(() => afterShowCount === 1);

  const hideStarted = oneEvent(el, 'lr-hide');
  const hidden = el.hide();
  await hideStarted;
  el.remove();
  await hidden;
  expect(afterHideCount).to.equal(0);
  parent.append(el);
  await waitUntil(() => afterHideCount === 1);

  expect(afterShowCount).to.equal(1);
  expect(afterHideCount).to.equal(1);
});

it('keeps toast() and hide() pending through same-task region reconnects until one terminal event each', async () => {
  const el = document.createElement('lr-alert') as LyraAlert;
  el.textContent = 'Toast transition reconnect';
  el.style.setProperty('--lr-duration-fast', '30ms');
  let afterShowCount = 0;
  let afterHideCount = 0;
  let toastSettled = false;
  el.addEventListener('lr-after-show', () => afterShowCount++);
  el.addEventListener('lr-after-hide', () => afterHideCount++);

  const showStarted = oneEvent(el, 'lr-show');
  const toasted = el.toast().then(() => { toastSettled = true; });
  await showStarted;
  const region = el.parentElement!;
  region.remove();
  document.body.append(region);
  await waitUntil(() => afterShowCount === 1);
  expect(toastSettled, 'the toast lifecycle remains owned until dismissal').to.equal(false);

  const hideStarted = oneEvent(el, 'lr-hide');
  const hidden = el.hide();
  await hideStarted;
  region.remove();
  document.body.append(region);
  await Promise.all([waitUntil(() => afterHideCount === 1), hidden, toasted]);

  expect(afterShowCount).to.equal(1);
  expect(afterHideCount).to.equal(1);
  expect(el.isConnected).to.equal(false);
});

it('settles an alert evicted from the bounded queue without disturbing active alerts', async () => {
  const alerts = Array.from({ length: 24 }, (_, index) => {
    const alert = document.createElement('lr-alert') as LyraAlert;
    alert.textContent = `Burst alert ${index + 1}`;
    alert.style.setProperty('--lr-duration-fast', '0ms');
    return alert;
  });
  const completions = alerts.map((alert) => alert.toast());
  await waitUntil(() => alerts.slice(0, 3).every((alert) => alert.open));

  const oldestQueuedSettled = await Promise.race([
    completions[3]!.then(() => true),
    delay(120).then(() => false),
  ]);
  expect(oldestQueuedSettled, 'overflow eviction must settle alert.toast()').to.be.true;
  expect(alerts[3]!.isConnected).to.be.false;
  expect(alerts.slice(0, 3).every((alert) => alert.isConnected && alert.open)).to.be.true;
  expect(document.querySelector('lr-toast')!.children.length).to.equal(23);

  document.querySelector('lr-toast')!.remove();
  await Promise.all(completions);
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
  expect(open.getAttribute('role')).to.equal('alert');
  expect(open.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal(null);
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
