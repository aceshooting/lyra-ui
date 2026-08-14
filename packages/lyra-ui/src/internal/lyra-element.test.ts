import { fixture, expect, html } from '@open-wc/testing';
import { nothing } from 'lit';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';

class Demo extends LyraElement {
  beginLoadForTest(): AbortSignal | undefined {
    return this.beginAbortableLoad();
  }

  render() {
    return html`<span>hi</span>`;
  }
}
customElements.define(tag('demo-base'), Demo);

class DemoLocale extends LyraElement {
  get exposedLocale() {
    return this.effectiveLocale;
  }
  get exposedMessageLocale() {
    return this.effectiveMessageLocale;
  }
  get exposedIntlLocale() {
    return (this as unknown as { effectiveIntlLocale: string }).effectiveIntlLocale;
  }
  get exposedDirection() {
    return this.effectiveDirection;
  }
  render() {
    return html`<span>${this.localize('cancel')}</span>`;
  }
}
customElements.define(tag('demo-locale'), DemoLocale);

class DemoDirection extends LyraElement {
  render() {
    return html`<span>${this.effectiveDirection}</span>`;
  }
}
customElements.define(tag('demo-direction'), DemoDirection);

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
  expect(caught !== undefined).to.equal(true);
  expect(caught!.bubbles).to.be.true;
  expect(caught!.composed).to.be.true;
  expect((caught!.detail as { ok: boolean }).ok).to.be.true;
});

it('emit() constructs events in the adopted owner document realm', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  el.remove();

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    let caught: Event | undefined;
    el.addEventListener('lr-ping', (event) => {
      caught = event;
    });
    (el as unknown as { emit: (name: string, detail?: unknown) => void }).emit('lr-ping', {
      owner: true,
    });

    expect(caught !== undefined).to.equal(true);
    expect(caught instanceof frameWindow.CustomEvent).to.be.true;
    expect(caught instanceof window.CustomEvent).to.be.false;
    expect(caught!.bubbles).to.be.true;
    expect(caught!.composed).to.be.true;
  } finally {
    el.remove();
    frame.remove();
  }
});

it('emit() preserves an inert owner document creator realm and exact event options', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow!;
  const inertDocument = frame.contentDocument!.implementation.createHTMLDocument('inert owner');
  expect(inertDocument.defaultView === null).to.be.true;
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  el.remove();

  try {
    inertDocument.adoptNode(el);
    let caught: CustomEvent | undefined;
    el.addEventListener('lr-ping', (event) => {
      caught = event as CustomEvent;
      event.preventDefault();
    });
    const emitted = (
      el as unknown as {
        emit: (name: string, detail: unknown, options: { cancelable: boolean }) => CustomEvent;
      }
    ).emit('lr-ping', { inert: true }, { cancelable: true });

    expect(caught === emitted).to.equal(true);
    expect(emitted instanceof frameWindow.CustomEvent).to.be.true;
    expect(emitted instanceof window.CustomEvent).to.be.false;
    expect(emitted.detail).to.deep.equal({ inert: true });
    expect(emitted.bubbles).to.be.true;
    expect(emitted.composed).to.be.true;
    expect(emitted.cancelable).to.be.true;
    expect(emitted.defaultPrevented).to.be.true;
  } finally {
    frame.remove();
  }
});

it('creates abort controllers in the current owner realm and fails closed without one', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  const ParentAbortController = window.AbortController;
  const OwnerAbortController = frameWindow.AbortController;
  let parentCreations = 0;
  let ownerCreations = 0;
  let latestOwnerSignal: AbortSignal | undefined;

  class ParentTrackedAbortController extends ParentAbortController {
    constructor() {
      super();
      parentCreations++;
    }
  }
  class OwnerTrackedAbortController extends OwnerAbortController {
    constructor() {
      super();
      ownerCreations++;
      latestOwnerSignal = this.signal;
    }
  }

  try {
    window.AbortController = ParentTrackedAbortController;
    frameWindow.AbortController = OwnerTrackedAbortController;
    el.remove();
    frameDocument.body.append(frameDocument.adoptNode(el));

    const first = el.beginLoadForTest();
    expect(first !== undefined).to.be.true;
    expect(first === latestOwnerSignal).to.equal(true);
    expect(parentCreations).to.equal(0);
    expect(ownerCreations).to.equal(1);

    const second = el.beginLoadForTest();
    expect(first!.aborted, 'a replacement load must abort the previous owner signal').to.be.true;
    expect(second?.aborted).to.be.false;
    expect(ownerCreations).to.equal(2);

    el.remove();
    expect(second!.aborted, 'disconnect must abort the retained owner controller').to.be.true;

    const inertDocument = frameDocument.implementation.createHTMLDocument('inert owner');
    expect(inertDocument.defaultView === null).to.be.true;
    inertDocument.adoptNode(el);
    expect(el.beginLoadForTest() === undefined).to.be.true;
    expect(parentCreations, 'an ownerless document must not fall back to the ambient realm').to.equal(0);
    expect(ownerCreations).to.equal(2);
  } finally {
    el.remove();
    window.AbortController = ParentAbortController;
    frameWindow.AbortController = OwnerAbortController;
    frame.remove();
  }
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
  expect(el.exposedMessageLocale).to.equal('x-memo');
  expect(ancestorReads).to.equal(0);

  // Scheduling a new update drops the memo; the next read re-walks once and
  // subsequent reads within the same cycle reuse it.
  el.requestUpdate();
  expect(el.exposedMessageLocale).to.equal('x-memo');
  expect(ancestorReads).to.be.greaterThan(0);
  const walksAfterFirstRead = ancestorReads;
  expect(el.exposedMessageLocale).to.equal('x-memo');
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
  expect(el.exposedMessageLocale).to.equal('x-one');
  expect(el.exposedDirection).to.equal('ltr');

  // Moving the element disconnects and reconnects it without scheduling an
  // update, so the resolution must not reuse the previous tree's values.
  sections[1]!.append(el);
  expect(el.exposedMessageLocale).to.equal('x-two');
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

it('reads computed direction live after ancestor style and class changes', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="direction: ltr">
      <style>
        .rtl-context { direction: rtl; }
      </style>
      <section><lr-demo-locale></lr-demo-locale></section>
    </div>
  `);
  const section = wrapper.querySelector('section')!;
  const el = wrapper.querySelector('lr-demo-locale') as DemoLocale;
  await el.updateComplete;
  expect(el.exposedDirection).to.equal('ltr');

  section.style.direction = 'rtl';
  await Promise.resolve();
  await el.updateComplete;
  expect(el.exposedDirection).to.equal('rtl');

  section.style.direction = '';
  section.className = 'rtl-context';
  await Promise.resolve();
  await el.updateComplete;
  expect(el.exposedDirection).to.equal('rtl');
});

it('shares inherited-context observation and resolves direction only for consumers', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
  const NativeMutationObserver = window.MutationObserver;
  const getComputedStyleDescriptor = Object.getOwnPropertyDescriptor(window, 'getComputedStyle');
  const nativeGetComputedStyle = window.getComputedStyle.bind(window);
  let observerConstructions = 0;
  let contextDirectionReads = 0;

  class TrackingMutationObserver extends NativeMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      observerConstructions++;
    }
  }

  Object.defineProperty(window, 'MutationObserver', {
    configurable: true,
    value: TrackingMutationObserver,
  });
  Object.defineProperty(window, 'getComputedStyle', {
    configurable: true,
    value(target: Element, pseudo?: string | null) {
      if (target.localName === tag('demo-direction') || target.localName === tag('demo-base')) {
        contextDirectionReads++;
      }
      return nativeGetComputedStyle(target, pseudo);
    },
  });

  const style = document.createElement('style');
  style.textContent = '.shared-rtl-context { direction: rtl; }';
  document.head.append(style);
  const wrapper = document.createElement('div');
  wrapper.dir = 'ltr';
  for (let index = 0; index < 100; index++) {
    wrapper.append(document.createElement(tag('demo-base')));
  }
  const directionConsumer = document.createElement(tag('demo-direction')) as DemoDirection;
  wrapper.append(directionConsumer);

  try {
    document.body.append(wrapper);
    await directionConsumer.updateComplete;
    expect(
      observerConstructions,
      'one document/root observer must serve every connected descendant',
    ).to.equal(1);

    contextDirectionReads = 0;
    wrapper.removeAttribute('dir');
    wrapper.className = 'shared-rtl-context';
    await new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
    await directionConsumer.updateComplete;

    expect(
      contextDirectionReads,
      'one comparison plus the resulting render must be independent of passive descendants',
    ).to.equal(2);
    expect(directionConsumer.shadowRoot?.textContent?.trim()).to.equal('rtl');
  } finally {
    wrapper.remove();
    style.remove();
    if (descriptor) Object.defineProperty(window, 'MutationObserver', descriptor);
    else Object.defineProperty(window, 'MutationObserver', { configurable: true, value: NativeMutationObserver });
    if (getComputedStyleDescriptor) Object.defineProperty(window, 'getComputedStyle', getComputedStyleDescriptor);
  }
});

it('reads computed direction live after a host style change', async () => {
  const el = await fixture<DemoLocale>(html`<lr-demo-locale style="direction: ltr"></lr-demo-locale>`);
  expect(el.exposedDirection).to.equal('ltr');

  el.style.direction = 'rtl';
  expect(el.exposedDirection).to.equal('rtl');
});

it('disconnects the inherited class/style observer when the component is removed', async () => {
  const wrapper = await fixture<HTMLDivElement>(
    html`<div style="direction: ltr"><lr-demo-locale></lr-demo-locale></div>`,
  );
  const el = wrapper.querySelector('lr-demo-locale') as DemoLocale;
  await el.updateComplete;

  let updateRequests = 0;
  const requestUpdate = el.requestUpdate.bind(el);
  el.requestUpdate = (...args: Parameters<DemoLocale['requestUpdate']>) => {
    updateRequests += 1;
    requestUpdate(...args);
  };

  el.remove();
  updateRequests = 0;
  wrapper.style.direction = 'rtl';
  wrapper.className = 'changed-after-disconnect';
  await Promise.resolve();

  expect(updateRequests).to.equal(0);
});

it('does not request an update for an ancestor class/style mutation that leaves the computed direction/locale unchanged', async () => {
  // Regression test: any unrelated inline `style`/`class` write on
  // ANY ancestor (e.g. lr-dialog's own overlay stack-index custom property, set via
  // style.setProperty() when it opens) used to call requestUpdate() unconditionally, purely
  // because `style`/`class` sit in INHERITED_CONTEXT_ATTRIBUTES's MutationObserver filter. That
  // MutationObserver callback is asynchronous (its own microtask, independent of Lit's own update
  // scheduling), so it can land inside another in-flight update's updated()/hostUpdated() window
  // and trigger Lit's dev-mode "scheduled an update after an update completed" warning -- with no
  // actual direction/locale change to justify a re-render at all. The observer must only request
  // an update when the ancestor mutation actually changes the resolved direction or locale.
  const wrapper = await fixture<HTMLDivElement>(
    html`<div style="direction: ltr"><lr-demo-locale></lr-demo-locale></div>`,
  );
  const el = wrapper.querySelector('lr-demo-locale') as DemoLocale;
  await el.updateComplete;
  expect(el.exposedDirection).to.equal('ltr');

  let updateRequests = 0;
  const requestUpdate = el.requestUpdate.bind(el);
  el.requestUpdate = (...args: Parameters<DemoLocale['requestUpdate']>) => {
    updateRequests += 1;
    requestUpdate(...args);
  };

  // An unrelated custom property -- direction-irrelevant, exactly like lr-dialog's
  // `--lr-overlay-stack-index` -- must not trigger a request.
  wrapper.style.setProperty('--some-unrelated-token', '1000');
  await Promise.resolve();
  await Promise.resolve();
  expect(updateRequests, 'unrelated style mutation must not request an update').to.equal(0);
  expect(el.exposedDirection).to.equal('ltr');

  // An unrelated class toggle -- no direction-affecting rule attached -- must not trigger one either.
  wrapper.className = 'unrelated-marker-class';
  await Promise.resolve();
  await Promise.resolve();
  expect(updateRequests, 'unrelated class mutation must not request an update').to.equal(0);
  expect(el.exposedDirection).to.equal('ltr');

  // A mutation that DOES change the computed direction must still request one -- the feature this
  // observer exists for keeps working.
  wrapper.style.direction = 'rtl';
  await Promise.resolve();
  await Promise.resolve();
  expect(updateRequests, 'a real direction change must still request an update').to.equal(1);
  await el.updateComplete;
  expect(el.exposedDirection).to.equal('rtl');
});

it('does not force a getComputedStyle() read for an ancestor style mutation unrelated to direction', async () => {
  // Regression test: `resolveLyraDirection()` (unlike `resolveLyraLocale()`) resolves via
  // `getComputedStyle()`, which forces the browser to flush pending style work for the WHOLE
  // document -- not just the queried element. Calling it from the ancestor-mutation observer on
  // every `class`/`style` write (even ones with nothing to do with direction, like a sibling
  // custom element's own unrelated cssprop) was observed to permanently break a completely
  // unrelated host's own shadow-DOM custom-property resolution in Chromium (see
  // `chip-group.test.ts`'s "--lr-chip-group-overflow-expanded-color cssprop" regression test,
  // which reproduced 100% of the time before this fix). The observer must skip the
  // `getComputedStyle()` call entirely unless the mutation could plausibly affect direction (an
  // explicit `dir`/`class` change, or a `style` change that actually mentions `direction`).
  const wrapper = await fixture<HTMLDivElement>(
    html`<div style="direction: ltr"><lr-demo-locale></lr-demo-locale></div>`,
  );
  const el = wrapper.querySelector('lr-demo-locale') as DemoLocale;
  await el.updateComplete;

  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const foreignWindow = iframe.contentWindow!;
  const ownerDescriptor = Object.getOwnPropertyDescriptor(foreignWindow, 'getComputedStyle');
  const ownerGetComputedStyle = foreignWindow.getComputedStyle.bind(foreignWindow);
  let calls = 0;
  Object.defineProperty(foreignWindow, 'getComputedStyle', {
    configurable: true,
    value(target: Element, pseudo?: string | null) {
      calls += 1;
      return ownerGetComputedStyle(target, pseudo);
    },
  });

  try {
    // Moving `wrapper` (carrying `el`) into the iframe's document re-triggers `el`'s
    // connectedCallback -- and so `observeInheritedContext()` -- against `foreignWindow`, the
    // window whose `getComputedStyle` is now instrumented.
    iframe.contentDocument!.body.append(wrapper);
    await el.updateComplete;
    // Opt this host into direction-sensitive observation. Components that never consume
    // effectiveDirection deliberately remain dormant under ancestor class/style churn.
    expect(el.exposedDirection).to.equal('ltr');

    calls = 0;
    wrapper.style.setProperty('--some-unrelated-token', '1000');
    await new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
    expect(calls, 'an unrelated style mutation must not force a computed-style read').to.equal(0);

    wrapper.style.direction = 'rtl';
    await new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
    expect(calls, 'a mutation that actually mentions direction must still be checked').to.be.greaterThan(0);
  } finally {
    if (ownerDescriptor) Object.defineProperty(foreignWindow, 'getComputedStyle', ownerDescriptor);
    if (wrapper.ownerDocument !== document) document.adoptNode(wrapper);
    wrapper.remove();
    iframe.remove();
  }
});

it('canonicalizes a synthetic message locale while exposing a safe effective locale', async () => {
  const locale = `x_synthetic_${Date.now().toString(36)}`;
  const el = await fixture<DemoLocale>(html`<lr-demo-locale locale=${locale}></lr-demo-locale>`);

  expect(el.exposedMessageLocale).to.equal(locale.replaceAll('_', '-'));
  expect(el.exposedLocale).to.equal('en');
  expect(el.exposedIntlLocale).to.equal('en');
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

it('rebinds locale, direction and ancestor observation after adoption into an iframe realm', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  // Upgrade and render in the defining realm first. This is the real adoption path for a custom
  // element; constructing a main-realm class for the first time in another document would ask Lit
  // to share a constructed stylesheet across documents, which the platform intentionally rejects.
  const el = await fixture<DemoLocale>(html`<lr-demo-locale></lr-demo-locale>`);
  const foreignDocument = frame.contentDocument!;
  foreignDocument.documentElement.lang = 'lt';
  const context = foreignDocument.createElement('section');
  context.lang = 'tr';
  context.dir = 'rtl';
  const shadow = context.attachShadow({ mode: 'open' });
  el.remove();
  foreignDocument.adoptNode(el);
  shadow.append(el);
  foreignDocument.body.append(context);

  try {
    await el.updateComplete;
    expect(el.ownerDocument === foreignDocument).to.be.true;
    expect(el.exposedMessageLocale).to.equal('tr');
    expect(el.exposedDirection).to.equal('rtl');

    context.lang = 'et';
    context.dir = 'ltr';
    await Promise.resolve();
    await el.updateComplete;
    expect(el.exposedMessageLocale).to.equal('et');
    expect(el.exposedDirection).to.equal('ltr');

    context.removeAttribute('lang');
    await Promise.resolve();
    await el.updateComplete;
    expect(el.exposedMessageLocale).to.equal('lt');
  } finally {
    frame.remove();
  }
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

class DemoAfterUpdate extends LyraElement {
  ran: string[] = [];
  scheduleTwoDistinct(): void {
    this.scheduleAfterUpdate(() => this.ran.push('load'));
    this.scheduleAfterUpdate(() => this.ran.push('search'), 'search');
  }
  scheduleTwoSameKey(): void {
    this.scheduleAfterUpdate(() => this.ran.push('first'));
    this.scheduleAfterUpdate(() => this.ran.push('second'));
  }
  render() {
    return html`<span>after-update</span>`;
  }
}
customElements.define(tag('demo-after-update'), DemoAfterUpdate);

it('runs every distinctly-keyed scheduleAfterUpdate callback in one cycle', async () => {
  // The pending flag was a single boolean, so the SECOND caller in an update cycle early-returned
  // and its callback was silently dropped forever. Several viewers schedule a `load()` and a
  // locale-driven search recompute from the same `updated()` -- when both fired, the search
  // recompute never ran and results stayed in the previous locale's collation.
  const el = (await fixture(html`<lr-demo-after-update></lr-demo-after-update>`)) as DemoAfterUpdate;
  await el.updateComplete;
  el.ran = [];

  el.scheduleTwoDistinct();
  await new Promise<void>((r) => queueMicrotask(() => queueMicrotask(() => r())));

  expect(el.ran.slice().sort()).to.deep.equal(['load', 'search']);
});

it('still coalesces same-key scheduleAfterUpdate callbacks to one run', async () => {
  // Coalescing is the whole point for the `load` path: several property writes in one cycle must
  // produce ONE fetch, not one per write. Keying must not turn that into a double load.
  const el = (await fixture(html`<lr-demo-after-update></lr-demo-after-update>`)) as DemoAfterUpdate;
  await el.updateComplete;
  el.ran = [];

  el.scheduleTwoSameKey();
  await new Promise<void>((r) => queueMicrotask(() => queueMicrotask(() => r())));

  expect(el.ran).to.deep.equal(['first']);
});
