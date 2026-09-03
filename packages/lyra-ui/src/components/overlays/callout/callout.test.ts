import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './callout.js';
import type { LyraCallout } from './callout.js';

class CalloutLiveTextForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const callout = document.createElement('lr-callout');

    const headingWrapper = document.createElement('span');
    headingWrapper.slot = 'heading';
    const headingSlot = document.createElement('slot');
    headingSlot.name = 'heading';
    headingSlot.textContent = 'Fallback heading';
    headingWrapper.append(headingSlot);

    const messageWrapper = document.createElement('span');
    const messageSlot = document.createElement('slot');
    messageSlot.name = 'message';
    messageSlot.textContent = 'Fallback message';
    messageWrapper.append(messageSlot);

    callout.append(headingWrapper, messageWrapper);
    root.append(callout);
  }
}
if (!customElements.get('callout-live-text-forward-wrapper')) {
  customElements.define('callout-live-text-forward-wrapper', CalloutLiveTextForwardWrapper);
}

afterEach(() => {
  document.querySelectorAll('lr-callout').forEach((callout) => callout.remove());
});

it('honors inherited and direct public callout hooks without host defaults shadowing them', async () => {
  const wrapper = await fixture(html`
    <div style="--lr-callout-background: rgb(1, 2, 3); --lr-callout-padding: 7px">
      <lr-callout>Inherited</lr-callout>
      <lr-callout style="--lr-callout-background: rgb(4, 5, 6); --lr-callout-padding: 9px">Direct</lr-callout>
    </div>
  `);
  const [inherited, direct] = Array.from(wrapper.querySelectorAll('lr-callout')) as LyraCallout[];
  expect(getComputedStyle(inherited!).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(inherited!).paddingTop).to.equal('7px');
  expect(getComputedStyle(direct!).backgroundColor).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(direct!).paddingTop).to.equal('9px');
});

async function settleLiveRegion(el: LyraCallout): Promise<void> {
  const view = el.ownerDocument.defaultView;
  if (view) {
    await new Promise<void>((resolve) =>
      view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve())),
    );
  } else {
    await Promise.resolve();
  }
  await el.updateComplete;
}

async function flushMutations(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

it('renders status content and a localized close action', async () => {
  const el = (await fixture(html`<lr-callout closable>Something happened</lr-callout>`)) as LyraCallout;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  expect(el.variant).to.equal('brand');
  expect(el.hasAttribute('variant')).to.equal(false);
  expect(el.getAttribute('open')).to.equal('');
  expect(button.getAttribute('aria-label')).to.equal('Close');
  expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('role')).to.equal(null);
  await expect(el).to.be.accessible();
});

it('normalizes every unsupported closed-set attribute and untyped property write', async () => {
  const el = (await fixture(html`
    <lr-callout variant="primary" appearance="quiet" size="huge" heading-level="7">
      Message
    </lr-callout>
  `)) as LyraCallout;
  expect(el.variant).to.equal('brand');
  expect(el.getAttribute('variant')).to.equal('brand');
  expect(el.appearance).to.equal(undefined);
  expect(el.hasAttribute('appearance')).to.be.false;
  expect(el.size).to.equal('m');
  expect(el.getAttribute('size')).to.equal('m');
  expect(el.headingLevel).to.equal('3');
  expect(el.getAttribute('heading-level')).to.equal('3');

  el.variant = 'success';
  el.appearance = 'outlined';
  el.size = 'small';
  el.headingLevel = '2';
  await el.updateComplete;
  const foreign = el as unknown as Record<string, unknown>;
  foreign['variant'] = 'primary';
  foreign['appearance'] = 'quiet';
  foreign['size'] = 'huge';
  foreign['headingLevel'] = '7';
  await el.updateComplete;
  expect(el.variant).to.equal('brand');
  expect(el.getAttribute('variant')).to.equal('brand');
  expect(el.appearance).to.equal(undefined);
  expect(el.hasAttribute('appearance')).to.be.false;
  expect(el.size).to.equal('m');
  expect(el.getAttribute('size')).to.equal('m');
  expect(el.headingLevel).to.equal('3');
  expect(el.getAttribute('heading-level')).to.equal('3');
});

it('lets per-instance close strings reach the rendered action', async () => {
  const el = (await fixture(html`<lr-callout closable>Message</lr-callout>`)) as LyraCallout;
  el.strings = { close: 'Dismiss callout' };
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="close-button"]')?.getAttribute('aria-label'),
  ).to.equal('Dismiss callout');
});

it('inherits the panel font through the close control and text glyph', async () => {
  const el = (await fixture(html`
    <lr-callout closable style="--lr-callout-font-size: 20px">Message</lr-callout>
  `)) as LyraCallout;
  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="close-button"]')!;
  const glyph = el.shadowRoot!.querySelector<HTMLElement>('[part="close-icon"]')!;

  expect(getComputedStyle(el).fontSize).to.equal('20px');
  expect(getComputedStyle(close).fontSize).to.equal('20px');
  expect(getComputedStyle(glyph).fontSize).to.equal('20px');
});

it('exposes the reflected appearance vocabulary without changing the unset treatment', async () => {
  const el = (await fixture(html`
    <lr-callout
      style="
        --lr-color-brand-fill-quiet: rgb(10, 20, 30);
        --lr-color-brand-fill-loud: rgb(40, 50, 60);
        --lr-color-brand-on-loud: rgb(240, 241, 242);
      "
    >Message</lr-callout>
  `)) as LyraCallout;
  const rendered = () => getComputedStyle(el);

  expect(el.appearance).to.equal(undefined);
  expect(el.hasAttribute('appearance')).to.equal(false);
  expect(rendered().backgroundColor).to.equal('rgb(10, 20, 30)');
  expect(rendered().borderColor).to.equal('rgb(40, 50, 60)');

  const expectations = [
    ['filled', 'rgb(10, 20, 30)', 'rgba(0, 0, 0, 0)', 'rgb(40, 50, 60)'],
    ['outlined', 'rgba(0, 0, 0, 0)', 'rgb(40, 50, 60)', 'rgb(40, 50, 60)'],
    ['accent', 'rgb(40, 50, 60)', 'rgb(40, 50, 60)', 'rgb(240, 241, 242)'],
    ['plain', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgb(40, 50, 60)'],
    ['filled-outlined', 'rgb(10, 20, 30)', 'rgb(40, 50, 60)', 'rgb(40, 50, 60)'],
  ] as const;

  for (const [appearance, background, border, color] of expectations) {
    el.appearance = appearance;
    await el.updateComplete;
    expect(el.getAttribute('appearance')).to.equal(appearance);
    expect(rendered().backgroundColor, `${appearance} background`).to.equal(background);
    expect(rendered().borderColor, `${appearance} border`).to.equal(border);
    expect(rendered().color, `${appearance} text`).to.equal(color);
  }
});

it('keeps initial content silent, then announces later mutations through light DOM', async () => {
  const el = document.createElement('lr-callout') as LyraCallout;
  el.textContent = 'Historical status';
  document.body.append(el);
  const firstUpdate = el.updateComplete;
  await firstUpdate;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const polite = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;
  expect(base.hasAttribute('role')).to.be.false;
  expect(base.hasAttribute('aria-live')).to.be.false;
  expect(polite.childElementCount).to.equal(0);
  await settleLiveRegion(el);
  expect(polite.childElementCount).to.equal(0);

  el.firstChild!.textContent = 'Fresh status';
  await Promise.resolve();
  expect(Array.from(polite.children, (child) => child.textContent)).to.deep.equal(['Fresh status']);
  el.remove();
});

it('announces direct child additions, removals, text changes, and heading property changes', async () => {
  const el = document.createElement('lr-callout') as LyraCallout;
  el.heading = 'Initial heading';
  const initialMessage = document.createElement('span');
  initialMessage.textContent = 'Initial message';
  el.append(initialMessage);
  document.body.append(el);
  await settleLiveRegion(el);
  const polite = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;
  expect(Array.from(polite.children, (child) => child.textContent)).to.deep.equal([]);

  const added = document.createTextNode('  Added   detail  ');
  el.append(added);
  await flushMutations();
  initialMessage.remove();
  await flushMutations();
  added.textContent = 'Updated detail';
  await flushMutations();
  el.heading = 'New heading';
  await el.updateComplete;

  expect(Array.from(polite.children, (child) => child.textContent)).to.deep.equal([
    'Initial heading Initial message Added detail',
    'Initial heading Added detail',
    'Initial heading Updated detail',
    'New heading Updated detail',
  ]);
  el.remove();
});

it('extracts and observes assigned text behind nested forwarding slots without mount noise', async () => {
  const wrapper = (await fixture(html`
    <callout-live-text-forward-wrapper>
      <strong id="forwarded-heading" slot="heading">Forwarded heading</strong>
      <span id="forwarded-message" slot="message">Initial forwarded message</span>
    </callout-live-text-forward-wrapper>
  `)) as CalloutLiveTextForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-callout') as LyraCallout;
  await settleLiveRegion(el);
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;
  expect(sink.childElementCount, 'initial forwarded content stays silent').to.equal(0);

  const message = wrapper.querySelector('#forwarded-message')!;
  message.textContent = 'Updated forwarded message';
  await flushMutations();
  expect(sink.lastElementChild?.textContent).to.equal(
    'Forwarded heading Updated forwarded message',
  );
  expect(sink.textContent).to.not.include('Fallback');

  (message as HTMLElement).hidden = true;
  await flushMutations();
  expect(sink.lastElementChild?.textContent).to.equal('Forwarded heading');
  (message as HTMLElement).hidden = false;
  await flushMutations();
  expect(sink.lastElementChild?.textContent).to.equal(
    'Forwarded heading Updated forwarded message',
  );

  const forwardingSlot = el.querySelector<HTMLSlotElement>('slot[name="message"]')!;
  const slotChanged = oneEvent(forwardingSlot, 'slotchange');
  const detail = document.createElement('span');
  detail.slot = 'message';
  detail.textContent = 'Added forwarded detail';
  wrapper.append(detail);
  await slotChanged;
  await flushMutations();
  expect(sink.lastElementChild?.textContent).to.equal(
    'Forwarded heading Updated forwarded message Added forwarded detail',
  );
  expect(sink.textContent).to.not.include('Fallback');
});

it('announces only the rendered shadow branch and closed details summary', async () => {
  const el = document.createElement('lr-callout') as LyraCallout;
  el.heading = 'Initial heading';
  const shadowHost = document.createElement('div');
  const shadow = shadowHost.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<span>Rendered callout shadow</span><slot></slot>';
  const assigned = document.createElement('span');
  assigned.textContent = 'Rendered callout assignment';
  const unassigned = document.createElement('span');
  unassigned.slot = 'missing';
  unassigned.textContent = 'Unassigned callout leak';
  shadowHost.append(assigned, unassigned);
  const details = document.createElement('details');
  details.innerHTML = '<summary>Collapsed callout summary</summary><span>Collapsed callout body leak</span>';
  el.append(shadowHost, details);
  document.body.append(el);
  await settleLiveRegion(el);
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;

  el.heading = 'Updated heading';
  await el.updateComplete;

  expect(sink.lastElementChild?.textContent).to.equal(
    'Updated heading Rendered callout shadow Rendered callout assignment Collapsed callout summary',
  );

  details.open = true;
  await flushMutations();
  expect(sink.lastElementChild?.textContent).to.equal(
    'Updated heading Rendered callout shadow Rendered callout assignment Collapsed callout summary Collapsed callout body leak',
  );
  el.remove();
});

it('recomputes live text when a direct child moves into and out of the icon slot', async () => {
  const el = document.createElement('lr-callout') as LyraCallout;
  const message = document.createElement('span');
  message.textContent = 'Visible status';
  el.append(message);
  document.body.append(el);
  await settleLiveRegion(el);
  const polite = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;
  const before = polite.childElementCount;

  message.slot = 'icon';
  await flushMutations();
  expect(polite.childElementCount).to.equal(before);

  message.removeAttribute('slot');
  await flushMutations();
  expect(polite.lastElementChild?.textContent).to.equal('Visible status');
  expect(polite.childElementCount).to.equal(before + 1);
  el.remove();
});

it('announces a changed accessible context even when there is no visible message', async () => {
  const el = document.createElement('lr-callout') as LyraCallout;
  el.setAttribute('aria-label', 'Initial context');
  document.body.append(el);
  await settleLiveRegion(el);
  const polite = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;

  el.setAttribute('aria-label', 'Updated context');
  await flushMutations();
  expect(polite.lastElementChild?.textContent).to.equal('Updated context');
  el.remove();
});

it('keeps live-content tracking silent without animation frames in an ownerless document', async () => {
  const ownerless = document.implementation.createHTMLDocument('ownerless');
  const el = (await fixture(html`<lr-callout>Ownerless status</lr-callout>`)) as LyraCallout;
  el.remove();
  ownerless.body.append(ownerless.adoptNode(el));

  await el.updateComplete;
  await Promise.resolve();
  await Promise.resolve();
  expect((el as unknown as { liveActive: boolean }).liveActive).to.equal(false);
  el.remove();
});

it('extracts only rendered accessible message text and dedupes irrelevant mutations', async () => {
  const el = document.createElement('lr-callout') as LyraCallout;
  el.closable = true;
  el.innerHTML = `
    <span slot="icon">ICON CHROME</span>
    <span id="message">
      Visible message
      <span id="aria-hidden" aria-hidden="true"><span aria-label="Hidden label">Hidden text</span></span>
      <span hidden>Hidden attribute text</span>
      <span inert>Inert text</span>
      <span style="display: none">CSS-hidden text</span>
      <span style="visibility: hidden">Hidden visibility text <span style="visibility: visible">Visible override</span></span>
      <span style="visibility: collapse">Collapsed visibility text <span style="visibility: visible">Collapsed override</span></span>
      <span id="named" aria-label="Named control"><b>Leaked descendant</b></span>
      <span aria-label="   ">Fallback child</span>
      <span id="hidden-parent" hidden><span aria-label="Revealed label">Hidden descendant</span></span>
      <span id="inert-parent" inert><span>Nested inert text</span></span>
    </span>
  `;
  document.body.append(el);
  await settleLiveRegion(el);
  const polite = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;
  const message = el.querySelector('#message')!;
  const firstText = message.firstChild!;
  firstText.textContent = '  Updated    message  ';
  await flushMutations();

  expect(polite.lastElementChild?.textContent).to.equal(
    'Updated message Visible override Collapsed override Named control Fallback child',
  );
  expect(polite.childElementCount).to.equal(1);
  expect(polite.textContent).to.not.include('ICON CHROME');
  expect(polite.textContent).to.not.include('×');
  expect(polite.textContent).to.not.include('Hidden');
  expect(polite.textContent).to.not.include('Inert');
  expect(polite.textContent).to.not.include('CSS-hidden');
  expect(polite.textContent).to.not.include('Hidden visibility text');
  expect(polite.textContent).to.not.include('Collapsed visibility text');
  expect(polite.textContent).to.not.include('Leaked descendant');

  el.querySelector('#aria-hidden')!.textContent = 'Changed hidden text';
  el.querySelector('#named b')!.textContent = 'Changed leaked descendant';
  firstText.textContent = 'Updated message';
  el.querySelector('#inert-parent span')!.textContent = 'Changed nested inert text';
  await flushMutations();
  expect(
    polite.childElementCount,
    'mutations that preserve normalized accessible output stay silent',
  ).to.equal(1);

  el.querySelector('#named')!.setAttribute('aria-label', 'Renamed control');
  await flushMutations();
  expect(polite.lastElementChild?.textContent).to.equal(
    'Updated message Visible override Collapsed override Renamed control Fallback child',
  );
  expect(polite.childElementCount).to.equal(2);

  el.querySelector('#hidden-parent')!.removeAttribute('hidden');
  await flushMutations();
  expect(polite.lastElementChild?.textContent).to.equal(
    'Updated message Visible override Collapsed override Renamed control Fallback child Revealed label',
  );
  expect(polite.childElementCount).to.equal(3);
  el.remove();
});

it('renders an interactive icon assignment as inert decorative presentation', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <button id="outside" type="button">Outside</button>
      <lr-callout><button id="icon-action" slot="icon" type="button">Icon action</button>Message</lr-callout>
    </div>
  `);
  const el = wrapper.querySelector('lr-callout')!;
  const presentation = el.shadowRoot!.querySelector<HTMLElement>('[part~="icon"]')!;
  const outside = wrapper.querySelector<HTMLButtonElement>('#outside')!;
  const iconAction = wrapper.querySelector<HTMLButtonElement>('#icon-action')!;
  expect(presentation.getAttribute('aria-hidden')).to.equal('true');
  expect(presentation.inert).to.equal(true);

  outside.focus();
  iconAction.focus();
  expect(wrapper.ownerDocument.activeElement?.id).to.equal('outside');
});

it('does not announce updates while the host or a composed ancestor is hidden', async () => {
  const wrapper = (await fixture(html`
    <section><lr-callout>Initial callout</lr-callout></section>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-callout') as LyraCallout;
  await settleLiveRegion(el);
  const polite = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;

  el.hidden = true;
  el.firstChild!.textContent = 'Hidden host update';
  await flushMutations();
  expect(polite.childElementCount, 'a hidden host is not a live update').to.equal(0);

  el.hidden = false;
  await flushMutations();
  const afterHostReveal = polite.childElementCount;
  wrapper.style.display = 'none';
  el.firstChild!.textContent = 'CSS-hidden ancestor update';
  await flushMutations();
  expect(polite.childElementCount).to.equal(afterHostReveal);

  wrapper.style.display = '';
  wrapper.setAttribute('inert', '');
  el.firstChild!.textContent = 'Inert ancestor update';
  await flushMutations();
  expect(polite.childElementCount).to.equal(afterHostReveal);

  wrapper.removeAttribute('inert');
  el.firstChild!.textContent = 'Visible callout update';
  await flushMutations();
  expect(polite.lastElementChild?.textContent).to.equal('Visible callout update');
});

it('routes danger mutations assertively and ordinary mutations politely', async () => {
  const el = (await fixture(html`<lr-callout variant="danger">Historical status</lr-callout>`)) as LyraCallout;
  await settleLiveRegion(el);
  const assertive = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
  )!;
  const polite = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;
  el.firstChild!.textContent = 'Danger update';
  await Promise.resolve();
  expect(assertive.textContent).to.equal('Danger update');
  expect(polite.childElementCount).to.equal(0);

  el.variant = 'success';
  await el.updateComplete;
  el.firstChild!.textContent = 'Ordinary update';
  await Promise.resolve();
  expect(polite.textContent).to.equal('Ordinary update');
});

it('routes an unset callout through its live composed contextual variant', async () => {
  const wrapper = await fixture(html`
    <div variant="danger"><lr-callout>Historical status</lr-callout></div>
  `);
  const el = wrapper.querySelector('lr-callout') as LyraCallout;
  expect(el.hasAttribute('variant')).to.be.false;
  await settleLiveRegion(el);
  const assertive = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
  )!;
  const polite = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;
  const assertiveBefore = assertive.childElementCount;
  const politeBefore = polite.childElementCount;

  el.firstChild!.textContent = 'Inherited danger update';
  await flushMutations();
  expect(assertive.lastElementChild?.textContent).to.equal('Inherited danger update');
  expect(assertive.childElementCount).to.equal(assertiveBefore + 1);
  expect(polite.childElementCount).to.equal(politeBefore);

  const assertiveAfterInherited = assertive.childElementCount;
  el.setAttribute('variant', 'success');
  el.firstChild!.textContent = 'Explicit ordinary update';
  await flushMutations();
  expect(polite.lastElementChild?.textContent).to.equal('Explicit ordinary update');
  expect(assertive.childElementCount).to.equal(assertiveAfterInherited);

  el.removeAttribute('variant');
  el.firstChild!.textContent = 'Inherited danger again';
  await flushMutations();
  expect(assertive.lastElementChild?.textContent).to.equal('Inherited danger again');

  wrapper.setAttribute('variant', 'success');
  el.firstChild!.textContent = 'Moved to ordinary context';
  await flushMutations();
  expect(polite.lastElementChild?.textContent).to.equal('Moved to ordinary context');

  const dangerContext = wrapper.ownerDocument.createElement('div');
  dangerContext.setAttribute('variant', 'danger');
  wrapper.append(dangerContext);
  dangerContext.append(el);
  await settleLiveRegion(el);
  const reconnectedAssertive = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
  )!;
  const assertiveBeforeReconnectMutation = reconnectedAssertive.childElementCount;
  el.firstChild!.textContent = 'Reconnected danger context';
  await flushMutations();
  expect(reconnectedAssertive.lastElementChild?.textContent).to.equal('Reconnected danger context');
  expect(reconnectedAssertive.childElementCount).to.equal(assertiveBeforeReconnectMutation + 1);
});

it('keeps queued and detached changes silent across reconnect staging', async () => {
  const el = (await fixture(html`<lr-callout>Historical status</lr-callout>`)) as LyraCallout;
  await settleLiveRegion(el);
  const selector = `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`;
  expect(document.querySelector<HTMLElement>(selector)?.childElementCount).to.equal(0);

  el.firstChild!.textContent = 'Queued before detach';
  el.remove();
  expect(document.querySelector(selector) === null).to.be.true;
  el.firstChild!.textContent = 'Detached status';
  el.heading = 'Detached heading';
  const detachedAddition = document.createElement('span');
  detachedAddition.textContent = 'Detached addition';
  el.append(detachedAddition);
  document.body.append(el);
  detachedAddition.textContent = 'Reattached during staging';
  const reconnectedInitialUpdate = el.updateComplete;
  await reconnectedInitialUpdate;
  expect(document.querySelector<HTMLElement>(selector)?.childElementCount).to.equal(0);
  await settleLiveRegion(el);
  expect(document.querySelector<HTMLElement>(selector)?.childElementCount).to.equal(0);
  detachedAddition.textContent = 'After reconnect';
  await flushMutations();
  expect(document.querySelector<HTMLElement>(selector)?.textContent).to.equal(
    'Detached heading Detached status After reconnect',
  );
  el.remove();
});

it('rebinds mutation observation and announcement sinks after iframe adoption', async () => {
  const frame = document.createElement('iframe');
  const loaded = new Promise<void>((resolve) =>
    frame.addEventListener('load', () => resolve(), { once: true }),
  );
  document.body.append(frame);
  await loaded;

  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const OriginalFrameObserver = frameWindow.MutationObserver;
  let frameObserverConstructions = 0;
  frameWindow.MutationObserver = function (
    callback: MutationCallback,
  ): MutationObserver {
    frameObserverConstructions += 1;
    return new OriginalFrameObserver(callback);
  } as unknown as typeof MutationObserver;
  let el: LyraCallout | undefined;

  try {
    el = document.createElement('lr-callout') as LyraCallout;
    el.textContent = 'Main document state';
    document.body.append(el);
    await settleLiveRegion(el);

    frameDocument.body.setAttribute('variant', 'danger');
    frameDocument.body.append(el);
    const frameMessage = frameDocument.createElement('span');
    frameMessage.textContent = 'Iframe initial state';
    el.replaceChildren(frameMessage);
    await settleLiveRegion(el);

    expect(
      frameObserverConstructions,
      'both Lyra context and callout content observers use the adopted realm',
    ).to.be.at.least(2);
    expect(
      frameDocument.querySelector(
        `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
      ) !== null,
      'the adopted document owns the live sink',
    ).to.be.true;
    const frameSink = frameDocument.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
    )!;
    expect(frameSink.childElementCount, 'adoption and staged content stay silent').to.equal(0);

    const addition = frameDocument.createElement('span');
    addition.textContent = 'Iframe update';
    el.append(addition);
    await flushMutations();
    expect(frameSink.lastElementChild?.textContent).to.equal(
      'Iframe initial state Iframe update',
    );
  } finally {
    el?.remove();
    frameWindow.MutationObserver = OriginalFrameObserver;
    frame.remove();
  }
});

it('distributes an initial slotted heading while announcements are still off', async () => {
  const el = document.createElement('lr-callout') as LyraCallout;
  el.innerHTML = '<span slot="heading">Initial heading</span>Initial message';
  document.body.append(el);
  await el.updateComplete;
  await Promise.resolve();
  await el.updateComplete;

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  expect(heading.hidden).to.equal(false);
  expect(base.hasAttribute('role')).to.be.false;
  expect(base.hasAttribute('aria-live')).to.be.false;

  await settleLiveRegion(el);
  expect(document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )?.childElementCount).to.equal(0);
  el.remove();
});

it('gives property and rich-slot headings the configured semantic level with a none opt-out', async () => {
  const propertyHeading = (await fixture(
    html`<lr-callout heading="Update available">Message</lr-callout>`,
  )) as LyraCallout;
  const propertyWrapper = propertyHeading.shadowRoot!.querySelector<HTMLElement>('[part="heading"]')!;
  expect(propertyWrapper.getAttribute('role')).to.equal('heading');
  expect(propertyWrapper.getAttribute('aria-level')).to.equal('3');

  const richHeading = (await fixture(html`
    <lr-callout heading-level="2">
      <span slot="heading">Rich <em>warning</em></span>
      Message
    </lr-callout>
  `)) as LyraCallout;
  const richWrapper = richHeading.shadowRoot!.querySelector<HTMLElement>('[part="heading"]')!;
  expect(richWrapper.getAttribute('role')).to.equal('heading');
  expect(richWrapper.getAttribute('aria-level')).to.equal('2');
  await expect(richHeading).to.be.accessible();

  const unheaded = (await fixture(
    html`<lr-callout heading="Visual label" heading-level="none">Message</lr-callout>`,
  )) as LyraCallout;
  const unheadedWrapper = unheaded.shadowRoot!.querySelector<HTMLElement>('[part="heading"]')!;
  expect(unheadedWrapper.hasAttribute('role')).to.equal(false);
  expect(unheadedWrapper.hasAttribute('aria-level')).to.equal(false);
});

it('renders closed when open="false" is set as a plain HTML attribute', async () => {
  // Regression test: `open` defaults `true`, and Lit's default presence-based `type: Boolean`
  // converter cannot distinguish an absent attribute from the literal string "false" -- only a
  // `true`-aware converter parses the literal attribute form correctly.
  const el = (await fixture(html`<lr-callout open="false">Message</lr-callout>`)) as LyraCallout;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.equal(false);
  expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(0);
  expect(getComputedStyle(el).display).to.equal('none');
});

it('allows close to be vetoed and otherwise hides', async () => {
  const el = (await fixture(html`<lr-callout closable>Message</lr-callout>`)) as LyraCallout;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  const veto = (event: Event) => event.preventDefault();
  el.addEventListener('lr-close', veto);
  button.click();
  expect(el.open).to.be.true;
  el.removeEventListener('lr-close', veto);
  const next = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  next.click();
  expect(el.open).to.be.false;
  await el.updateComplete;
  expect(el.hasAttribute('open')).to.equal(false);
  expect(getComputedStyle(el).display).to.equal('none');
  el.open = true;
  await el.updateComplete;
  expect(el.getAttribute('open')).to.equal('');
  expect(getComputedStyle(el).display).to.equal('block');
});

it('repairs focused close actions only after dismissal is accepted', async () => {
  const host = await fixture<HTMLDivElement>(html`
    <div>
      <lr-callout closable>Message</lr-callout>
      <button id="after-callout">After</button>
    </div>
  `);
  const el = host.querySelector('lr-callout') as LyraCallout;
  const after = host.querySelector<HTMLButtonElement>('#after-callout')!;
  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="close-button"]')!;
  const veto = (event: Event): void => event.preventDefault();
  el.addEventListener('lr-close', veto);
  close.focus();
  close.click();
  expect(el.shadowRoot!.activeElement === close).to.equal(true);

  el.removeEventListener('lr-close', veto);
  close.click();
  expect(el.ownerDocument.activeElement === after).to.equal(true);
  await el.updateComplete;
  expect(el.open).to.equal(false);
});

it('repairs direct close state writes but preserves newer listener focus', async () => {
  const host = await fixture<HTMLDivElement>(html`
    <div>
      <button id="explicit-callout-focus">Explicit</button>
      <lr-callout closable>Message</lr-callout>
      <button id="after-direct-callout">After</button>
    </div>
  `);
  const el = host.querySelector('lr-callout') as LyraCallout;
  const explicit = host.querySelector<HTMLButtonElement>('#explicit-callout-focus')!;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="close-button"]')!.focus();
  el.open = false;
  await el.updateComplete;
  expect(el.ownerDocument.activeElement?.id).to.equal('after-direct-callout');

  el.open = true;
  await el.updateComplete;
  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="close-button"]')!;
  el.addEventListener('lr-close', () => explicit.focus(), { once: true });
  close.focus();
  close.click();
  await el.updateComplete;
  expect(el.ownerDocument.activeElement === explicit).to.equal(true);
});

it('forwards a host-level aria-label to the base region when accessible-label is unset', async () => {
  const el = (await fixture(html`<lr-callout aria-label="Storage warning">Disk is nearly full</lr-callout>`)) as LyraCallout;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('aria-label')).to.equal('Storage warning');
  expect(base.getAttribute('role')).to.equal('group');
  expect(base.hasAttribute('aria-live')).to.be.false;
});

it('lets a host-level aria-label take precedence over accessible-label on the status owner', async () => {
  const el = (await fixture(
    html`<lr-callout accessible-label="Explicit label" aria-label="Host label">Message</lr-callout>`
  )) as LyraCallout;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('aria-label')).to.equal('Host label');
  expect(base.getAttribute('role')).to.equal('group');
  expect(base.hasAttribute('aria-live')).to.be.false;
});

it('lets an explicitly empty host aria-label suppress accessible-label semantics but preserves visible announcements', async () => {
  const el = (await fixture(html`
    <lr-callout aria-label="" accessible-label="Fallback label">Message</lr-callout>
  `)) as LyraCallout;
  await settleLiveRegion(el);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;
  expect(base.getAttribute('role')).to.equal(null);
  expect(base.getAttribute('aria-label')).to.equal(null);

  el.firstChild!.textContent = 'Updated message';
  await flushMutations();
  expect(sink.lastElementChild?.textContent).to.equal('Updated message');
});

it('uses a nonempty host label as announcement context without replacing visible status text', async () => {
  const el = (await fixture(html`
    <lr-callout aria-label="Storage warning" accessible-label="Fallback label">
      Initial message
    </lr-callout>
  `)) as LyraCallout;
  await settleLiveRegion(el);
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;

  el.firstChild!.textContent = 'Disk is nearly full';
  await flushMutations();
  expect(sink.lastElementChild?.textContent).to.equal(
    'Storage warning: Disk is nearly full',
  );

  el.setAttribute('aria-label', 'Disk is nearly full');
  await flushMutations();
  expect(sink.lastElementChild?.textContent).to.equal('Disk is nearly full');
});

it('localizes the complete context-and-content announcement order and punctuation', async () => {
  const el = (await fixture(html`
    <lr-callout
      aria-label="Storage warning"
      .strings=${{ calloutAnnouncementWithContext: '{content} ← {context}' }}
    >Initial message</lr-callout>
  `)) as LyraCallout;
  await settleLiveRegion(el);
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;

  el.firstChild!.textContent = 'Disk is nearly full';
  await flushMutations();

  expect(sink.lastElementChild?.textContent).to.equal('Disk is nearly full ← Storage warning');
});

it('gives the close button the shared minimum hit area in both the default and inline variants, shrinking only the visible glyph', async () => {
  const el = (await fixture(html`<lr-callout closable>Message</lr-callout>`)) as LyraCallout;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  expect(getComputedStyle(button).minInlineSize).to.equal('40px');
  expect(getComputedStyle(button).minBlockSize).to.equal('40px');

  const inlineEl = (await fixture(
    html`<lr-callout inline closable>Message</lr-callout>`,
  )) as LyraCallout;
  const inlineButton = inlineEl.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  const inlineIcon = inlineEl.shadowRoot!.querySelector('[part="close-icon"]') as HTMLElement;
  expect(getComputedStyle(inlineButton).minInlineSize).to.equal('40px');
  expect(getComputedStyle(inlineButton).minBlockSize).to.equal('40px');
  // The visible "×" glyph shrinks to the compact inline size, not the button's own hit target.
  expect(getComputedStyle(inlineIcon).inlineSize).to.equal('24px');
  expect(getComputedStyle(inlineIcon).blockSize).to.equal('24px');
});

it('puts ordinary panel chrome on the host while the semantic base remains a transparent layout wrapper', async () => {
  const el = (await fixture(html`
    <lr-callout style="
      background: rgb(10, 20, 30);
      border: 3px solid rgb(40, 50, 60);
      border-radius: 11px;
      color: rgb(70, 80, 90);
      padding: 13px;
      margin: 7px;
    ">Message</lr-callout>
  `)) as LyraCallout;
  const host = getComputedStyle(el);
  const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  expect(host.backgroundColor).to.equal('rgb(10, 20, 30)');
  expect(host.borderTopWidth).to.equal('3px');
  expect(host.borderTopColor).to.equal('rgb(40, 50, 60)');
  expect(host.borderRadius).to.equal('11px');
  expect(host.color).to.equal('rgb(70, 80, 90)');
  expect(host.paddingBlockStart).to.equal('13px');
  expect(host.marginBlockStart).to.equal('7px');
  expect(base.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  expect(base.borderTopWidth).to.equal('0px');
  expect(base.paddingBlockStart).to.equal('0px');
  expect(base.color).to.equal(host.color);
});

it('supports a lightweight inline status/error treatment', async () => {
  const el = (await fixture(html`<lr-callout inline variant="danger"><span slot="icon">!</span>Try again</lr-callout>`)) as LyraCallout;
  expect(el.inline).to.be.true;
  expect(el.hasAttribute('inline')).to.be.true;
  const rendered = getComputedStyle(el);
  expect(rendered.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  expect(rendered.borderTopWidth).to.equal('0px');
  expect(rendered.paddingBlockStart).to.equal('0px');
  await expect(el).to.be.accessible();
});

it('actually renders the inline variant with a transparent panel background', async () => {
  // Companion to the cssText-source check above -- proves the rule reaches a real rendered
  // element rather than only existing as unapplied stylesheet text (e.g. a future higher-
  // specificity rule elsewhere, or the selector losing to [part='base']'s own background
  // declaration, would break this while the cssText check above kept passing).
  const nonInline = (await fixture(html`<lr-callout variant="danger">Try again</lr-callout>`)) as LyraCallout;
  expect(getComputedStyle(nonInline).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');

  const inlineEl = (await fixture(html`<lr-callout inline variant="danger">Try again</lr-callout>`)) as LyraCallout;
  expect(getComputedStyle(inlineEl).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
});

// -- size --------------------------------------------------------------------

describe('size', () => {
  const panel = (el: LyraCallout): CSSStyleDeclaration =>
    getComputedStyle(el);

  const render = async (size?: string): Promise<LyraCallout> =>
    (await fixture(
      size === undefined
        ? html`<lr-callout>Message</lr-callout>`
        : html`<lr-callout size=${size}>Message</lr-callout>`,
    )) as LyraCallout;

  it('defaults to "m", and the unset default renders identically to the explicit tier', async () => {
    const unset = await render();
    const explicit = await render('m');
    expect(unset.size).to.equal('m');
    expect(unset.hasAttribute('size')).to.equal(false);
    expect(panel(unset).paddingBlockStart).to.equal(panel(explicit).paddingBlockStart);
    expect(panel(unset).fontSize).to.equal(panel(explicit).fontSize);
  });

  it('grows the rendered panel padding and font size monotonically across the ladder', async () => {
    const measured: { padding: number; font: number }[] = [];
    for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const) {
      const style = panel(await render(size));
      measured.push({
        padding: Number.parseFloat(style.paddingBlockStart),
        font: Number.parseFloat(style.fontSize),
      });
    }
    for (let i = 1; i < measured.length; i++) {
      expect(measured[i]!.padding, `padding tier ${i} >= ${i - 1}`).to.be.at.least(measured[i - 1]!.padding);
      expect(measured[i]!.font, `font tier ${i} >= ${i - 1}`).to.be.at.least(measured[i - 1]!.font);
    }
    expect(measured.at(-1)!.padding, 'xl padding beats 2xs').to.be.greaterThan(measured[0]!.padding);
    expect(measured.at(-1)!.font, 'xl font beats 2xs').to.be.greaterThan(measured[0]!.font);
  });

  it('accepts the Web Awesome size spellings as exact synonyms of the step names', async () => {
    for (const [step, alias] of [['s', 'small'], ['m', 'medium'], ['l', 'large']] as const) {
      const stepped = panel(await render(step));
      const aliased = panel(await render(alias));
      expect(aliased.paddingBlockStart, `${alias} padding`).to.equal(stepped.paddingBlockStart);
      expect(aliased.fontSize, `${alias} font`).to.equal(stepped.fontSize);
    }
  });

  it('keeps the compact inline treatment padding-free at every tier', async () => {
    const el = (await fixture(html`<lr-callout inline size="xl">Message</lr-callout>`)) as LyraCallout;
    expect(panel(el).paddingBlockStart).to.equal('0px');
    expect(panel(el).paddingInlineStart).to.equal('0px');
  });

  it('stays accessible at the smallest tier with a close action', async () => {
    const el = (await fixture(html`<lr-callout size="2xs" closable>Message</lr-callout>`)) as LyraCallout;
    await expect(el).to.be.accessible();
  });
});

it('inherits contextual variant and size only while their attributes are unset', async () => {
  const outer = (await fixture(html`
    <lr-callout
      variant="danger"
      size="xl"
      style="
        --lr-theme-color-danger-fill-quiet: rgb(10, 20, 30);
        --lr-theme-color-danger-fill-loud: rgb(40, 50, 60);
        --lr-theme-color-brand-fill-quiet: rgb(70, 80, 90);
        --lr-theme-color-brand-fill-loud: rgb(100, 110, 120);
        --lr-theme-color-success-fill-quiet: rgb(130, 140, 150);
        --lr-theme-color-success-fill-loud: rgb(160, 170, 180);
        --lr-theme-font-size-xl: 30px;
        --lr-theme-font-size-m: 18px;
        --lr-theme-font-size-sm: 14px;
        --lr-theme-space-l: 20px;
        --lr-theme-space-m: 12px;
        --lr-theme-space-s: 8px;
      "
    ><lr-callout id="inner">Nested</lr-callout></lr-callout>
  `)) as LyraCallout;
  const inner = outer.querySelector('#inner') as LyraCallout;
  await inner.updateComplete;
  const rendered = () => getComputedStyle(inner);

  expect(inner.variant).to.equal('brand');
  expect(inner.size).to.equal('m');
  expect(inner.hasAttribute('variant')).to.equal(false);
  expect(inner.hasAttribute('size')).to.equal(false);
  expect(rendered().backgroundColor).to.equal('rgb(10, 20, 30)');
  expect(rendered().borderColor).to.equal('rgb(40, 50, 60)');
  expect(rendered().fontSize).to.equal('30px');
  expect(rendered().paddingBlockStart).to.equal('20px');

  inner.variant = 'brand';
  inner.size = 'm';
  await inner.updateComplete;
  expect(inner.getAttribute('variant')).to.equal('brand');
  expect(inner.getAttribute('size')).to.equal('m');
  expect(rendered().backgroundColor).to.equal('rgb(70, 80, 90)');
  expect(rendered().borderColor).to.equal('rgb(100, 110, 120)');
  expect(rendered().fontSize).to.equal('18px');
  expect(rendered().paddingBlockStart).to.equal('12px');

  inner.removeAttribute('variant');
  inner.removeAttribute('size');
  await inner.updateComplete;
  expect(rendered().backgroundColor).to.equal('rgb(10, 20, 30)');
  expect(rendered().fontSize).to.equal('30px');

  outer.variant = 'success';
  outer.size = 's';
  await outer.updateComplete;
  expect(rendered().backgroundColor).to.equal('rgb(130, 140, 150)');
  expect(rendered().borderColor).to.equal('rgb(160, 170, 180)');
  expect(rendered().fontSize).to.equal('14px');
  expect(rendered().paddingBlockStart).to.equal('8px');
});

it('maps explicit neutral to its semantic quiet/loud palette', async () => {
  const el = (await fixture(html`
    <lr-callout
      variant="neutral"
      style="--lr-color-neutral-fill-quiet: rgb(11, 22, 33); --lr-color-neutral-fill-loud: rgb(44, 55, 66)"
    >Neutral</lr-callout>
  `)) as LyraCallout;
  const rendered = getComputedStyle(el);
  expect(rendered.backgroundColor).to.equal('rgb(11, 22, 33)');
  expect(rendered.borderColor).to.equal('rgb(44, 55, 66)');
  expect(rendered.color).to.equal('rgb(44, 55, 66)');
});

it('gives close-button a rendered hover state', async () => {
  const el = (await fixture(html`<lr-callout closable>Message</lr-callout>`)) as LyraCallout;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  const rect = button.getBoundingClientRect();
  const resting = getComputedStyle(button).backgroundColor;
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    expect(getComputedStyle(button).backgroundColor).to.not.equal(resting);
  } finally {
    await resetMouse();
  }
});

it('decouples the close-button hover fill from --lr-callout-background so a brand-variant panel is not the sole override hook', async () => {
  const el = (await fixture(
    html`<lr-callout variant="brand" closable>Message</lr-callout>`,
  )) as LyraCallout;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;

  // Overriding the hover-fill token alone must not move the panel background.
  const panelBefore = getComputedStyle(el).backgroundColor;
  el.style.setProperty('--lr-callout-close-hover-bg', 'rgb(1, 2, 3)');
  await el.updateComplete;
  expect(getComputedStyle(el).backgroundColor).to.equal(panelBefore);

  // The dedicated token is reachable at all -- proof it is not just a bare literal.
  expect(getComputedStyle(button).getPropertyValue('--lr-callout-close-hover-bg').trim()).to.equal(
    'rgb(1, 2, 3)',
  );
});

// -- quiet-tier background across light and dark mode -------------------------

/** WCAG relative luminance of a computed `rgb()`/`rgba()` string, so "is this actually the dark
 *  tier?" is asserted on the rendered colour rather than on a memorised hex value that a legitimate
 *  ramp regeneration would churn. */
function relativeLuminance(color: string): number {
  const channels = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/u.exec(color);
  if (!channels) throw new Error(`unparseable computed colour: ${color}`);
  const linearChannel = (index: number): number => {
    const rawChannel = channels[index];
    if (rawChannel === undefined) throw new Error(`missing computed colour channel: ${color}`);
    const channel = Number(rawChannel) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [linearChannel(1), linearChannel(2), linearChannel(3)];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('quiet-tier background in dark mode', () => {
  const VARIANTS = ['brand', 'neutral', 'success', 'warning', 'danger'] as const;

  it('darkens the standalone fallback background, the arm an unset variant actually renders', async () => {
    // An unset variant matches none of the contextual variant rules, so --lr-color-fill-quiet is
    // undefined on the host and the SECOND arm of --lr-callout-background is what paints the panel.
    // That fallback arm is the one place a light-mode literal could hide, so it gets its own case.
    const light = (await fixture(html`<lr-callout>Message</lr-callout>`)) as LyraCallout;
    const dark = (await fixture(html`<lr-callout data-lr-theme="dark">Message</lr-callout>`)) as LyraCallout;
    expect(light.hasAttribute('variant'), 'fixture no longer exercises the fallback arm').to.equal(false);
    expect(dark.hasAttribute('variant'), 'fixture no longer exercises the fallback arm').to.equal(false);
    const lightFill = getComputedStyle(light).backgroundColor;
    const darkFill = getComputedStyle(dark).backgroundColor;
    expect(darkFill, 'the unset-variant fallback background did not move in dark mode').to.not.equal(
      lightFill,
    );
    expect(
      relativeLuminance(darkFill),
      `dark fallback background (${darkFill}) is not darker than its light value (${lightFill})`,
    ).to.be.lessThan(relativeLuminance(lightFill));
  });

  it('darkens the quiet background of every explicit variant', async () => {
    for (const variant of VARIANTS) {
      const light = (await fixture(html`<lr-callout variant=${variant}>Message</lr-callout>`)) as LyraCallout;
      const dark = (await fixture(
        html`<lr-callout variant=${variant} data-lr-theme="dark">Message</lr-callout>`,
      )) as LyraCallout;
      const lightFill = getComputedStyle(light).backgroundColor;
      const darkFill = getComputedStyle(dark).backgroundColor;
      expect(darkFill, `${variant} quiet background did not move in dark mode`).to.not.equal(lightFill);
      expect(
        relativeLuminance(darkFill),
        `${variant} dark quiet background (${darkFill}) is not darker than its light value (${lightFill})`,
      ).to.be.lessThan(relativeLuminance(lightFill));
    }
  });

  it('still resolves the dark background through its --lr-theme-* input, on the fallback arm too', async () => {
    // A literal in the dark branch would render the same colour whatever the theme input says.
    const fallback = (await fixture(html`
      <lr-callout data-lr-theme="dark" style="--lr-theme-color-brand-fill-quiet: rgb(3, 5, 7)"
        >Message</lr-callout
      >
    `)) as LyraCallout;
    expect(getComputedStyle(fallback).backgroundColor).to.equal('rgb(3, 5, 7)');

    for (const variant of VARIANTS) {
      const el = (await fixture(html`
        <lr-callout
          variant=${variant}
          data-lr-theme="dark"
          style="--lr-theme-color-${variant}-fill-quiet: rgb(9, 11, 13)"
        >Message</lr-callout>
      `)) as LyraCallout;
      expect(getComputedStyle(el).backgroundColor, `${variant} ignored its theme input`).to.equal(
        'rgb(9, 11, 13)',
      );
    }
  });
});

it('uses break-word, not anywhere, on content/message text', async () => {
  const el = (await fixture(html`<lr-callout>A short two word message</lr-callout>`)) as LyraCallout;
  await el.updateComplete;
  const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
  const message = el.shadowRoot!.querySelector('[part="message"]') as HTMLElement;
  expect(getComputedStyle(content).overflowWrap).to.equal('break-word');
  expect(getComputedStyle(message).overflowWrap).to.equal('break-word');
});
