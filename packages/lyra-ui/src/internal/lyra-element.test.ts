import { fixture, expect, html } from '@open-wc/testing';
import { nothing } from 'lit';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';

class Demo extends LyraElement {
  render() {
    return html`<span>hi</span>`;
  }
}
customElements.define(tag('demo-base'), Demo);

class DemoLocale extends LyraElement {
  get exposedLocale() {
    return this.effectiveLocale;
  }
  get exposedDirection() {
    return this.effectiveDirection;
  }
  render() {
    return html`<span>${this.localize('cancel')}</span>`;
  }
}
customElements.define(tag('demo-locale'), DemoLocale);

class DemoHostAria extends LyraElement {
  render() {
    return html`<div
      role="group"
      aria-label=${this.getAttribute('aria-label') ?? nothing}
      aria-describedby=${this.getAttribute('aria-describedby') ?? nothing}
    ></div>`;
  }
}
customElements.define(tag('demo-host-aria'), DemoHostAria);

it('applies the token font-family from the base', async () => {
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  expect(getComputedStyle(el).fontFamily).to.not.be.empty;
});

it('emit() dispatches a composed, bubbling lyra event', async () => {
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  let caught: CustomEvent | undefined;
  el.addEventListener('lr-ping', (e) => (caught = e as CustomEvent));
  (el as unknown as { emit: (n: string, d?: unknown) => void }).emit('lr-ping', { ok: true });
  expect(caught).to.exist;
  expect(caught!.bubbles).to.be.true;
  expect(caught!.composed).to.be.true;
  expect((caught!.detail as { ok: boolean }).ok).to.be.true;
});

it('resolves the inherited locale at most once per update cycle', async () => {
  const wrapper = await fixture<HTMLDivElement>(
    html`<div lang="x-memo"><lr-demo-locale></lr-demo-locale></div>`,
  );
  const el = wrapper.querySelector('lr-demo-locale') as DemoLocale;
  await el.updateComplete;

  let ancestorReads = 0;
  const original = wrapper.getAttribute.bind(wrapper);
  wrapper.getAttribute = (name: string) => {
    ancestorReads++;
    return original(name);
  };

  // The initial render already resolved the locale, so reads reuse the memo
  // without touching the ancestor chain again.
  expect(el.exposedLocale).to.equal('x-memo');
  expect(ancestorReads).to.equal(0);

  // Scheduling a new update drops the memo; the next read re-walks once and
  // subsequent reads within the same cycle reuse it.
  el.requestUpdate();
  expect(el.exposedLocale).to.equal('x-memo');
  expect(ancestorReads).to.be.greaterThan(0);
  const walksAfterFirstRead = ancestorReads;
  expect(el.exposedLocale).to.equal('x-memo');
  expect(ancestorReads).to.equal(walksAfterFirstRead);
  await el.updateComplete;
});

it('re-resolves locale and direction when reconnected under a different ancestor', async () => {
  const host = await fixture<HTMLDivElement>(
    html`<div>
      <section lang="x-one"></section>
      <section lang="x-two" dir="rtl"></section>
    </div>`,
  );
  const sections = host.querySelectorAll('section');
  const el = document.createElement('lr-demo-locale') as DemoLocale;
  sections[0]!.append(el);
  await el.updateComplete;
  expect(el.exposedLocale).to.equal('x-one');
  expect(el.exposedDirection).to.equal('ltr');

  // Moving the element disconnects and reconnects it without scheduling an
  // update, so the resolution must not reuse the previous tree's values.
  sections[1]!.append(el);
  expect(el.exposedLocale).to.equal('x-two');
  expect(el.exposedDirection).to.equal('rtl');
});

it('re-renders when host lang and dir attributes change the effective locale context', async () => {
  const el = await fixture<DemoLocale>(html`<lr-demo-locale lang="en" dir="ltr"></lr-demo-locale>`);
  expect(el.exposedLocale).to.equal('en');
  expect(el.exposedDirection).to.equal('ltr');

  el.setAttribute('lang', 'tr');
  el.setAttribute('dir', 'rtl');
  await el.updateComplete;

  expect(el.exposedLocale).to.equal('tr');
  expect(el.exposedDirection).to.equal('rtl');
});

it('re-renders when ancestor lang and dir attributes change the inherited locale context', async () => {
  const wrapper = await fixture<HTMLDivElement>(
    html`<div lang="en" dir="ltr"><lr-demo-locale></lr-demo-locale></div>`,
  );
  const el = wrapper.querySelector('lr-demo-locale') as DemoLocale;
  await el.updateComplete;
  expect(el.exposedLocale).to.equal('en');
  expect(el.exposedDirection).to.equal('ltr');

  wrapper.setAttribute('lang', 'tr');
  wrapper.setAttribute('dir', 'rtl');
  await Promise.resolve();
  await el.updateComplete;

  expect(el.exposedLocale).to.equal('tr');
  expect(el.exposedDirection).to.equal('rtl');
});

it('inherits and reacts to locale context across a shadow-root host boundary', async () => {
  const host = await fixture<HTMLDivElement>(html`<div lang="tr"></div>`);
  const shadow = host.attachShadow({ mode: 'open' });
  const el = document.createElement('lr-demo-locale') as DemoLocale;
  shadow.append(el);
  await el.updateComplete;
  expect(el.exposedLocale).to.equal('tr');

  host.setAttribute('lang', 'lt');
  await Promise.resolve();
  await el.updateComplete;

  expect(el.exposedLocale).to.equal('lt');
});

it('makes notifications non-cancelable unless a caller opts into veto semantics', async () => {
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  const events: CustomEvent[] = [];
  el.addEventListener('lr-notification', (e) => events.push(e as CustomEvent));
  (el as unknown as { emit: (n: string, d?: unknown, o?: { cancelable?: boolean }) => void }).emit(
    'lr-notification',
  );
  (el as unknown as { emit: (n: string, d?: unknown, o?: { cancelable?: boolean }) => void }).emit(
    'lr-notification',
    undefined,
    { cancelable: true },
  );
  expect(events.map((event) => event.cancelable)).to.deep.equal([false, true]);
});

it('updates descendants that forward host aria-label and aria-describedby attributes', async () => {
  const el = await fixture<DemoHostAria>(`<lr-demo-host-aria></lr-demo-host-aria>`);
  const target = el.shadowRoot!.querySelector('[role="group"]') as HTMLElement;

  el.setAttribute('aria-label', 'Current results');
  el.setAttribute('aria-describedby', 'results-help');
  await el.updateComplete;
  expect(target.getAttribute('aria-label')).to.equal('Current results');
  expect(target.getAttribute('aria-describedby')).to.equal('results-help');

  el.removeAttribute('aria-label');
  el.removeAttribute('aria-describedby');
  await el.updateComplete;
  expect(target.hasAttribute('aria-label')).to.be.false;
  expect(target.hasAttribute('aria-describedby')).to.be.false;
});
