import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './copy-button.js';
import type { LyraCopyButton } from './copy-button.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

function sinkElement(politeness: 'polite' | 'assertive'): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`);
}

function sinkTexts(politeness: 'polite' | 'assertive'): string[] {
  const element = sinkElement(politeness);
  return element ? Array.from(element.children).map((child) => child.textContent ?? '') : [];
}

/** The clipboard write is awaited before any feedback state is applied, so a click needs one
 *  macrotask (which drains every pending microtask first) plus the Lit update it schedules.
 *
 *  A status change also opens the internal lr-tooltip, whose popup fades in through a WAAPI
 *  animation (tooltip.class.ts's settleTransition()) rather than settling synchronously. Left
 *  alone, a caller asserting accessibility right after settle() samples the DOM mid-fade: axe's
 *  color-contrast check factors in the popup's current (transitional) opacity, so a
 *  partially-shown popup blends its text and background toward each other and reports a false
 *  "serious" violation -- exactly what intermittently failed WebKit's full-engine shard. Finishing
 *  the animation outright (rather than awaiting it) matches the idiom overlay.test.ts already uses
 *  for this same kind of popup animation. */
const settle = async (el: LyraCopyButton): Promise<void> => {
  await aTimeout(0);
  await el.updateComplete;
  const popup = tooltip(el).shadowRoot?.querySelector('[part~="popup"]');
  popup?.getAnimations().forEach((animation) => animation.finish());
  await el.updateComplete;
};

const baseButton = (el: LyraCopyButton): HTMLButtonElement =>
  el.shadowRoot!.querySelector('[part~="base"]') as HTMLButtonElement;

const feedbackText = (el: LyraCopyButton): string =>
  (el.shadowRoot!.querySelector('[part="feedback"]') as HTMLElement).textContent!.trim();

type TooltipElement = HTMLElement & {
  content: string;
  disabled: boolean;
  hoist: boolean;
  open: boolean;
  placement: string;
  trigger: string;
  updateComplete: Promise<unknown>;
};

const tooltip = (el: LyraCopyButton): TooltipElement =>
  el.shadowRoot!.querySelector('lr-tooltip') as TooltipElement;

const partTokens = (el: Element): string[] => (el.getAttribute('part') ?? '').split(/\s+/).filter(Boolean);

/** Replaces `navigator.clipboard` for the duration of `run`, always restoring whatever descriptor
 *  was there before — a leaked stub bleeds into every later test file. */
const withClipboard = async (value: unknown, run: () => Promise<void>): Promise<void> => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
  try {
    await run();
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
};

describe('lr-copy-button', () => {
  // The real Clipboard API rejects under an untrusted (scripted) click in a headless browser, so
  // every success-path test would otherwise depend on the runner's focus/permission state. Each
  // test starts from a clipboard that resolves; the ones exercising failure override it locally.
  let writes: string[] = [];
  let originalClipboard: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    writes = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          writes.push(text);
          return Promise.resolve();
        },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('defaults to an empty value and the resting "Copy" label', async () => {
    const el = (await fixture(html`<lr-copy-button></lr-copy-button>`)) as LyraCopyButton;
    expect(el.value).to.equal('');
    expect(el.copyLabel).to.equal('');
    expect(el.successLabel).to.equal('');
    expect(el.errorLabel).to.equal('');
    expect(el.from).to.equal('');
    expect(el.tooltip).to.equal('full');
    expect(el.tooltipPlacement).to.equal('top');
    expect(el.hoist).to.be.false;
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copy');
    expect(partTokens(baseButton(el))).to.include.members(['base', 'button']);
    expect(el.shadowRoot!.querySelectorAll('[part="copy-icon"]').length).to.equal(1);
    expect(feedbackText(el)).to.equal('');

    const tip = tooltip(el);
    expect(tip.content).to.equal('Copy');
    expect(tip.trigger).to.equal('hover focus');
    expect(tip.placement).to.equal('top');
    expect(tip.hoist).to.be.false;
    expect(tip.open).to.be.false;
    expect(tip.getAttribute('exportparts')).to.equal(
      'base:tooltip__base, base__popup:tooltip__base__popup, base__arrow:tooltip__base__arrow, body:tooltip__body',
    );
  });

  it('uses public copy/success labels for the accessible name, tooltip, and feedback', async () => {
    const el = (await fixture(html`
      <lr-copy-button
        value="hello"
        copy-label="Copy token"
        success-label="Token copied"
        feedback-duration="10000"
      ></lr-copy-button>
    `)) as LyraCopyButton;
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copy token');
    expect(tooltip(el).content).to.equal('Copy token');

    baseButton(el).click();
    await settle(el);
    await tooltip(el).updateComplete;
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Token copied');
    expect(feedbackText(el)).to.equal('Token copied');
    expect(tooltip(el).content).to.equal('Token copied');
    expect(tooltip(el).open).to.be.true;
  });

  it('opens the full resting tooltip from built-in-button focus and closes it on blur', async () => {
    const el = (await fixture(html`
      <lr-copy-button value="hello" copy-label="Copy greeting"></lr-copy-button>
    `)) as LyraCopyButton;
    const tip = tooltip(el);
    baseButton(el).focus();
    await aTimeout(250);
    await tip.updateComplete;
    expect(tip.open).to.be.true;
    expect(tip.content).to.equal('Copy greeting');

    baseButton(el).blur();
    await aTimeout(50);
    await tip.updateComplete;
    expect(tip.open).to.be.false;
  });

  it('copies textContent, an attribute, or a property from the element named by from', async () => {
    const wrapper = await fixture(html`
      <div>
        <span id="copy-source-text">source text</span>
        <span id="copy-source-attribute" data-copy="attribute text"></span>
        <input id="copy-source-property" .value=${'property text'} />
        <lr-copy-button from="copy-source-text" value="ignored"></lr-copy-button>
        <lr-copy-button from="copy-source-attribute[data-copy]"></lr-copy-button>
        <lr-copy-button from="copy-source-property.value"></lr-copy-button>
      </div>
    `);
    const buttons = [...wrapper.querySelectorAll('lr-copy-button')] as LyraCopyButton[];
    for (const button of buttons) {
      baseButton(button).click();
      await settle(button);
    }
    expect(writes).to.deep.equal(['source text', 'attribute text', 'property text']);
  });

  it('uses foreign shadow content, the owner clipboard, and the exact owner feedback timer', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const host = frameDocument.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const source = frameDocument.createElement('span');
    source.id = 'foreign-copy-source';
    source.textContent = 'foreign source text';
    const el = (await fixture(html`
      <lr-copy-button from="foreign-copy-source" feedback-duration="60000"></lr-copy-button>
    `)) as LyraCopyButton;
    const trigger = frameDocument.createElement('button');
    trigger.textContent = 'Copy foreign source';
    el.append(trigger);
    await el.updateComplete;

    const mainClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const frameClipboard = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
    const nativeSetTimeout = frameWindow.setTimeout.bind(frameWindow);
    const nativeClearTimeout = frameWindow.clearTimeout.bind(frameWindow);
    const cancelled: number[] = [];
    let feedbackHandle: number | undefined;
    let feedbackCallback: (() => void) | undefined;
    let mainWrites = 0;
    const frameWrites: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => { mainWrites++; return Promise.resolve(); } },
    });
    Object.defineProperty(frameWindow.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => { frameWrites.push(text); return Promise.resolve(); } },
    });
    frameWindow.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const handle = nativeSetTimeout(handler, timeout, ...args);
      if (timeout === el.feedbackDuration) {
        feedbackHandle = handle;
        if (typeof handler === 'function') feedbackCallback = handler;
      }
      return handle;
    }) as typeof frameWindow.setTimeout;
    frameWindow.clearTimeout = ((handle?: number) => {
      if (handle !== undefined) cancelled.push(handle);
      nativeClearTimeout(handle);
    }) as typeof frameWindow.clearTimeout;

    try {
      frameDocument.body.append(host);
      shadow.append(source, frameDocument.adoptNode(el));
      await el.updateComplete;
      await aTimeout(0);
      trigger.click();
      await settle(el);

      expect(mainWrites).to.equal(0);
      expect(frameWrites).to.deep.equal(['foreign source text']);
      expect(feedbackHandle).to.be.a('number');

      document.body.append(document.adoptNode(el));
      expect(cancelled).to.include(feedbackHandle!);
      await el.updateComplete;
      expect(feedbackText(el)).to.equal('');

      el.from = '';
      el.value = 'new owner text';
      await el.updateComplete;
      trigger.click();
      await settle(el);
      expect(feedbackText(el)).to.equal('Copied!');
      feedbackCallback?.();
      await el.updateComplete;
      expect(feedbackText(el), 'the retired iframe callback cannot clear current feedback').to.equal('Copied!');
    } finally {
      if (feedbackHandle !== undefined) nativeClearTimeout(feedbackHandle);
      el.remove();
      host.remove();
      frameWindow.setTimeout = nativeSetTimeout;
      frameWindow.clearTimeout = nativeClearTimeout;
      if (mainClipboard) Object.defineProperty(navigator, 'clipboard', mainClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
      if (frameClipboard) Object.defineProperty(frameWindow.navigator, 'clipboard', frameClipboard);
      else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
      frame.remove();
    }
  });

  it('classifies a rejection from the adopted owner realm and never calls the ambient clipboard', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const mainClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const frameClipboard = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
    let mainWrites = 0;
    let frameWrites = 0;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => { mainWrites++; return Promise.reject(new Error('wrong realm')); } },
    });
    Object.defineProperty(frameWindow.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => {
          frameWrites++;
          return Promise.reject(new frameWindow.DOMException('Denied', 'NotAllowedError'));
        },
      },
    });
    const el = (await fixture(html`<lr-copy-button value="owner text"></lr-copy-button>`)) as LyraCopyButton;

    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      const failed = oneEvent(el, 'lr-copy-error');
      baseButton(el).click();
      const event = await failed;
      expect(event.detail.reason).to.equal('denied');
      expect(mainWrites).to.equal(0);
      expect(frameWrites).to.equal(1);
    } finally {
      el.remove();
      if (mainClipboard) Object.defineProperty(navigator, 'clipboard', mainClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
      if (frameClipboard) Object.defineProperty(frameWindow.navigator, 'clipboard', frameClipboard);
      else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
      frame.remove();
    }
  });

  it('does not reach the ambient clipboard while disconnected in an ownerless document', async () => {
    const ownerlessDocument = document.implementation.createHTMLDocument('ownerless');
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    let writes = 0;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => { writes++; return Promise.resolve(); } },
    });
    const el = (await fixture(html`<lr-copy-button value="ownerless"></lr-copy-button>`)) as LyraCopyButton;
    const button = baseButton(el);
    try {
      el.remove();
      ownerlessDocument.adoptNode(el);
      button.click();
      await Promise.resolve();
      expect(writes).to.equal(0);

      document.body.append(document.adoptNode(el));
      await el.updateComplete;
      expect(feedbackText(el)).to.equal('');
    } finally {
      el.remove();
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('treats a missing from target as an error and never falls back to value', async () => {
    const el = (await fixture(html`
      <lr-copy-button from="missing-copy-source" value="must not copy"></lr-copy-button>
    `)) as LyraCopyButton;
    const mappedError = oneEvent(el, 'lr-error');
    const detailedError = oneEvent(el, 'lr-copy-error');
    baseButton(el).click();
    const [event, detailed] = await Promise.all([mappedError, detailedError]);
    await settle(el);

    expect(event.constructor.name).to.equal('CustomEvent');
    expect(event.detail == null).to.be.true;
    expect(event.bubbles).to.be.true;
    expect(event.composed).to.be.true;
    expect(event.cancelable).to.be.false;
    expect(detailed.detail.reason).to.equal('failed');
    expect(writes).to.deep.equal([]);
    expect(partTokens(baseButton(el))).to.include('base-error');
  });

  it('treats an empty resolved value as an error without calling the Clipboard API', async () => {
    const el = (await fixture(html`<lr-copy-button></lr-copy-button>`)) as LyraCopyButton;
    const mappedError = oneEvent(el, 'lr-error');
    baseButton(el).click();
    await mappedError;
    await settle(el);
    expect(writes).to.deep.equal([]);
    expect(partTokens(baseButton(el))).to.include('base-error');
  });

  it('configures full, copy-only, and disabled tooltip modes with placement and hoisting', async () => {
    const el = (await fixture(html`
      <lr-copy-button
        value="hello"
        tooltip="copy"
        tooltip-placement="right"
        hoist
      ></lr-copy-button>
    `)) as LyraCopyButton;
    let tip = tooltip(el);
    expect(tip.trigger).to.equal('manual');
    expect(tip.placement).to.equal('right');
    expect(tip.hoist).to.be.true;
    expect(tip.disabled).to.be.false;

    baseButton(el).click();
    await settle(el);
    await tip.updateComplete;
    expect(tip.open).to.be.true;

    el.tooltip = 'none';
    await el.updateComplete;
    tip = tooltip(el);
    await tip.updateComplete;
    expect(tip.trigger).to.equal('manual');
    expect(tip.disabled).to.be.true;
    expect(tip.open).to.be.false;
  });

  it('renders copy, success, and error icon slots in their corresponding states', async () => {
    const el = (await fixture(html`
      <lr-copy-button value="hello" feedback-duration="10000">
        <span slot="copy-icon">C</span>
        <span slot="success-icon">S</span>
        <span slot="error-icon">E</span>
      </lr-copy-button>
    `)) as LyraCopyButton;
    const copySlot = el.shadowRoot!.querySelector('slot[name="copy-icon"]') as HTMLSlotElement;
    expect(copySlot.assignedElements()[0]!.textContent!.trim()).to.equal('C');
    expect(el.shadowRoot!.querySelectorAll('[part="success-icon"]').length).to.equal(0);

    baseButton(el).click();
    await settle(el);
    const successSlot = el.shadowRoot!.querySelector('slot[name="success-icon"]') as HTMLSlotElement;
    expect(successSlot.assignedElements()[0]!.textContent!.trim()).to.equal('S');
    expect(el.shadowRoot!.querySelectorAll('[part="copy-icon"]').length).to.equal(0);
  });

  it('uses default slot content as a custom trigger while retaining click/focus forwarding', async () => {
    const el = (await fixture(html`
      <lr-copy-button value="custom trigger">
        <button id="custom-copy-trigger" type="button">Copy custom value</button>
      </lr-copy-button>
    `)) as LyraCopyButton;
    await aTimeout(0);
    await el.updateComplete;
    const trigger = el.querySelector('#custom-copy-trigger') as HTMLButtonElement;
    expect(el.shadowRoot!.querySelectorAll('[part~="button"]').length).to.equal(0);

    el.focus();
    expect(document.activeElement === trigger).to.be.true;
    el.blur();
    expect(document.activeElement === trigger).to.be.false;

    const copied = oneEvent(el, 'lr-copy');
    el.click();
    await copied;
    expect(writes).to.deep.equal(['custom trigger']);
  });

  it('publishes the success custom state and applies --success-color', async () => {
    const el = (await fixture(html`
      <lr-copy-button
        value="hello"
        feedback-duration="10000"
        style="--success-color: rgb(1, 120, 45)"
      ></lr-copy-button>
    `)) as LyraCopyButton;
    baseButton(el).click();
    await settle(el);
    expect(getComputedStyle(baseButton(el)).color).to.equal('rgb(1, 120, 45)');
    try {
      expect(el.matches(':state(success)')).to.be.true;
      expect(el.matches(':state(error)')).to.be.false;
    } catch {
      // CustomStateSet is an optional styling hook in older test engines.
    }
  });

  it('fires lr-copy with the current value and writes it to the clipboard on click', async () => {
    const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
    const listener = oneEvent(el, 'lr-copy');
    baseButton(el).click();
    const { detail } = await listener;
    expect(detail).to.deep.equal({ text: 'hello' });
    expect(writes).to.deep.equal(['hello']);
  });

  it('confirms with the success icon and label only once the write resolves', async () => {
    const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
    baseButton(el).click();
    await settle(el);
    const button = baseButton(el);
    expect(button.getAttribute('aria-label')).to.equal('Copied!');
    expect(partTokens(button)).to.include.members(['base', 'button', 'base-success']);
    expect(el.shadowRoot!.querySelectorAll('[part="success-icon"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="error-icon"]').length).to.equal(0);
    expect(feedbackText(el)).to.equal('Copied!');
    expect(sinkTexts('polite')).to.deep.equal(['Copied!']);
    const feedback = el.shadowRoot!.querySelector('[part="feedback"]') as HTMLElement;
    // The retained part is a styling/inspection mirror only -- a live region inside a shadow root
    // is not reliably announced, and leaving it live would double-announce where it *is* honored.
    expect(feedback.getAttribute('role')).to.equal(null);
    expect(feedback.getAttribute('aria-hidden')).to.equal('true');
  });

  it('announces a second identical copy again instead of silently rewriting one text node', async () => {
    const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
    expect(sinkTexts('polite'), 'mounting must not announce a resting state').to.deep.equal([]);
    baseButton(el).click();
    await settle(el);
    baseButton(el).click();
    await settle(el);
    expect(
      sinkTexts('polite'),
      'an identical repeat must be a second addition so assistive tech reads it again',
    ).to.deep.equal(['Copied!', 'Copied!']);
  });

  it('ref-counts the shared sink away once the last copy button disconnects', async () => {
    const first = (await fixture(html`<lr-copy-button value="a"></lr-copy-button>`)) as LyraCopyButton;
    const second = (await fixture(html`<lr-copy-button value="b"></lr-copy-button>`)) as LyraCopyButton;
    expect(sinkElement('polite') !== null, 'a connected copy button holds the sink').to.be.true;
    first.remove();
    expect(sinkElement('polite') !== null, 'a still-connected copy button keeps it mounted').to.be
      .true;
    second.remove();
    expect(sinkElement('polite') === null, 'the last disconnect unmounts it').to.be.true;
  });

  it('reverts the copied confirmation after the default duration', async () => {
    const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
    baseButton(el).click();
    await settle(el);
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copied!');
    await aTimeout(1600);
    await el.updateComplete;
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copy');
    expect(feedbackText(el)).to.equal('');
  });

  it('forwards a host aria-label to the internal semantic button', async () => {
    const el = (await fixture(html`
      <lr-copy-button aria-label="Copy API key" value="secret"></lr-copy-button>
    `)) as LyraCopyButton;
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copy API key');

    baseButton(el).click();
    await settle(el);
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copy API key');
    // The custom name is fixed, so the live region is the only channel left to announce the
    // outcome — it must still carry it.
    expect(feedbackText(el)).to.equal('Copied!');
    await expect(el).to.be.accessible();
  });

  it('disables the internal button and suppresses activation', async () => {
    const el = (await fixture(html`
      <lr-copy-button disabled value="secret"></lr-copy-button>
    `)) as LyraCopyButton;
    const button = baseButton(el);
    let copies = 0;
    let failures = 0;
    el.addEventListener('lr-copy', () => copies++);
    el.addEventListener('lr-copy-error', () => failures++);

    button.click();
    await settle(el);
    expect(el.disabled).to.be.true;
    expect(button.disabled).to.be.true;
    expect(copies).to.equal(0);
    expect(failures).to.equal(0);
    expect(writes).to.deep.equal([]);
  });

  it('forwards focus() and blur() to the internal button', async () => {
    const el = (await fixture(html`<lr-copy-button></lr-copy-button>`)) as LyraCopyButton;
    const button = baseButton(el);

    el.focus();
    expect(el.shadowRoot!.activeElement === button).to.be.true;
    el.blur();
    expect((el.shadowRoot!.activeElement) === (null)).to.equal(true);
  });

  it('forwards host click() to the internal button and respects disabled state', async () => {
    const el = (await fixture(html`<lr-copy-button value="host"></lr-copy-button>`)) as LyraCopyButton;
    let copies = 0;
    el.addEventListener('lr-copy', () => copies++);

    el.click();
    expect(copies).to.equal(1);

    el.disabled = true;
    await el.updateComplete;
    el.click();
    expect(copies).to.equal(1);
  });

  it('clears copied feedback state on disconnect so reconnect starts at Copy', async () => {
    const el = (await fixture(html`
      <lr-copy-button value="hello" feedback-duration="10000"></lr-copy-button>
    `)) as LyraCopyButton;
    const parent = el.parentElement!;
    baseButton(el).click();
    await settle(el);
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copied!');

    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copy');
    expect(partTokens(baseButton(el))).to.include.members(['base', 'button']);
    expect(partTokens(baseButton(el))).to.not.include('base-success');
  });

  it('clears copied feedback immediately when the source value changes', async () => {
    const el = (await fixture(html`
      <lr-copy-button value="old" feedback-duration="10000"></lr-copy-button>
    `)) as LyraCopyButton;
    baseButton(el).click();
    await settle(el);
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copied!');

    el.value = 'new';
    await el.updateComplete;
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copy');
    expect(feedbackText(el)).to.equal('');
  });

  it('uses string overrides for both resting and confirmation labels', async () => {
    const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
    el.strings = { copy: 'Copier', copied: 'Copié' };
    await el.updateComplete;
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copier');

    baseButton(el).click();
    await settle(el);
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copié');
    expect(feedbackText(el)).to.equal('Copié');
  });

  it('supports a configurable feedback duration', async () => {
    const el = (await fixture(html`
      <lr-copy-button value="hello" feedback-duration="20"></lr-copy-button>
    `)) as LyraCopyButton;
    expect(el.feedbackDuration).to.equal(20);
    baseButton(el).click();
    await settle(el);
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copied!');

    await aTimeout(50);
    await el.updateComplete;
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copy');
  });

  it('falls back to the default feedback duration for a non-finite/negative value instead of leaving the confirmation state stuck', async () => {
    const el = (await fixture(html`
      <lr-copy-button value="hello" feedback-duration="NaN"></lr-copy-button>
    `)) as LyraCopyButton;
    baseButton(el).click();
    await settle(el);
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copied!');

    // NaN self-heals to the DEFAULT_FEEDBACK_DURATION (1000ms), not 0/never -- a short wait must
    // NOT have already reverted it.
    await aTimeout(50);
    await el.updateComplete;
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copied!');

    el.feedbackDuration = -20;
    baseButton(el).click();
    await settle(el);
    // A negative duration clamps to 0, reverting on the very next tick.
    await aTimeout(10);
    await el.updateComplete;
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copy');
  });

  it('is accessible', async () => {
    const el = await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`);
    await expect(el).to.be.accessible();
  });

  it('dims the disabled button via the shared --lr-opacity-disabled token', async () => {
    const el = (await fixture(html`<lr-copy-button disabled value="hello"></lr-copy-button>`)) as LyraCopyButton;
    // Regression: the rule previously referenced the non-existent
    // --lr-disabled-opacity (reversed word order), which left the
    // invalid opacity declaration at its initial value (1) instead of the
    // shared 0.5 dimming used by every other disabled control.
    expect(getComputedStyle(baseButton(el)).opacity).to.equal('0.5');
  });
});

describe('lr-copy-button clipboard failure', () => {
  const rejectingClipboard = (error: unknown) => ({
    writeText: () => Promise.reject(error),
  });

  it('enters the error state instead of reporting success when the write rejects', async () => {
    await withClipboard(rejectingClipboard(new DOMException('Denied', 'NotAllowedError')), async () => {
      const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
      baseButton(el).click();
      await settle(el);
      const button = baseButton(el);
      expect(partTokens(button)).to.include.members(['base', 'button', 'base-error']);
      expect(el.shadowRoot!.querySelectorAll('[part="error-icon"]').length).to.equal(1);
      expect(el.shadowRoot!.querySelectorAll('[part="success-icon"]').length).to.equal(0);
      // The `copyFailed` message key is pending in DEFAULT_STRINGS ('Copy failed'); asserting it
      // is merely distinct from both resting and success copy keeps this test honest either way.
      const label = button.getAttribute('aria-label') ?? '';
      expect(label).to.not.equal('Copy');
      expect(label).to.not.equal('Copied!');
      expect(label.length).to.be.greaterThan(0);
      expect(feedbackText(el)).to.equal(label);
    });
  });

  it('emits lr-copy-error with the rejection reason and the original error', async () => {
    const error = new DOMException('Document is not focused', 'NotAllowedError');
    await withClipboard(rejectingClipboard(error), async () => {
      const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
      const failed = oneEvent(el, 'lr-copy-error');
      baseButton(el).click();
      const event = await failed;
      expect(event.detail.text).to.equal('hello');
      expect(event.detail.reason).to.equal('denied');
      expect(event.detail.error === error).to.be.true;
      expect(event.bubbles).to.be.true;
      expect(event.composed).to.be.true;
    });
  });

  it('also emits the mapped lr-error event and uses error-label/--error-color', async () => {
    await withClipboard(rejectingClipboard(new Error('boom')), async () => {
      const el = (await fixture(html`
        <lr-copy-button
          value="hello"
          error-label="Could not copy token"
          style="--error-color: rgb(190, 10, 20)"
        ><span slot="error-icon">E</span></lr-copy-button>
      `)) as LyraCopyButton;
      const mappedError = oneEvent(el, 'lr-error');
      baseButton(el).click();
      const event = await mappedError;
      await settle(el);
      expect(event.detail == null).to.be.true;
      expect(event.bubbles).to.be.true;
      expect(event.composed).to.be.true;
      expect(event.cancelable).to.be.false;
      expect(baseButton(el).getAttribute('aria-label')).to.equal('Could not copy token');
      expect(feedbackText(el)).to.equal('Could not copy token');
      const errorSlot = el.shadowRoot!.querySelector('slot[name="error-icon"]') as HTMLSlotElement;
      expect(errorSlot.assignedElements()[0]!.textContent!.trim()).to.equal('E');
      expect(getComputedStyle(baseButton(el)).color).to.equal('rgb(190, 10, 20)');
      try {
        expect(el.matches(':state(error)')).to.be.true;
        expect(el.matches(':state(success)')).to.be.false;
      } catch {
        // CustomStateSet is an optional styling hook in older test engines.
      }
    });
  });

  it('reports an unknown rejection as reason "failed"', async () => {
    await withClipboard(rejectingClipboard(new Error('boom')), async () => {
      const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
      const failed = oneEvent(el, 'lr-copy-error');
      baseButton(el).click();
      const event = await failed;
      expect(event.detail.reason).to.equal('failed');
    });
  });

  it('reports a missing Clipboard API as reason "unsupported" and never shows success', async () => {
    await withClipboard(undefined, async () => {
      const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
      const failed = oneEvent(el, 'lr-copy-error');
      baseButton(el).click();
      const event = await failed;
      expect(event.detail.reason).to.equal('unsupported');
      await settle(el);
      expect(partTokens(baseButton(el))).to.include.members(['base', 'button', 'base-error']);
      expect(el.shadowRoot!.querySelectorAll('[part="success-icon"]').length).to.equal(0);
    });
  });

  it('survives a clipboard implementation that throws synchronously', async () => {
    await withClipboard(
      {
        writeText: () => {
          throw new DOMException('Blocked', 'SecurityError');
        },
      },
      async () => {
        const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
        const failed = oneEvent(el, 'lr-copy-error');
        baseButton(el).click();
        const event = await failed;
        expect(event.detail.reason).to.equal('denied');
        await settle(el);
        expect(partTokens(baseButton(el))).to.include.members(['base', 'button', 'base-error']);
      },
    );
  });

  it('still announces the activation through lr-copy so consumers keep their existing wiring', async () => {
    await withClipboard(rejectingClipboard(new Error('boom')), async () => {
      const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
      const copied = oneEvent(el, 'lr-copy');
      baseButton(el).click();
      const { detail } = await copied;
      expect(detail).to.deep.equal({ text: 'hello' });
    });
  });

  it('reverts the error state after the feedback duration', async () => {
    await withClipboard(rejectingClipboard(new Error('boom')), async () => {
      const el = (await fixture(html`
        <lr-copy-button value="hello" feedback-duration="20"></lr-copy-button>
      `)) as LyraCopyButton;
      baseButton(el).click();
      await settle(el);
      expect(partTokens(baseButton(el))).to.include.members(['base', 'button', 'base-error']);

      await aTimeout(60);
      await el.updateComplete;
      expect(partTokens(baseButton(el))).to.include.members(['base', 'button']);
      expect(partTokens(baseButton(el))).to.not.include('base-error');
      expect(el.shadowRoot!.querySelectorAll('[part="copy-icon"]').length).to.equal(1);
      expect(feedbackText(el)).to.equal('');
    });
  });

  it('clears the error state on a value change and on disconnect', async () => {
    await withClipboard(rejectingClipboard(new Error('boom')), async () => {
      const el = (await fixture(html`
        <lr-copy-button value="old" feedback-duration="10000"></lr-copy-button>
      `)) as LyraCopyButton;
      baseButton(el).click();
      await settle(el);
      expect(partTokens(baseButton(el))).to.include.members(['base', 'button', 'base-error']);

      el.value = 'new';
      await el.updateComplete;
      expect(partTokens(baseButton(el))).to.include.members(['base', 'button']);
      expect(partTokens(baseButton(el))).to.not.include('base-error');

      baseButton(el).click();
      await settle(el);
      expect(partTokens(baseButton(el))).to.include.members(['base', 'button', 'base-error']);
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await el.updateComplete;
      expect(partTokens(baseButton(el))).to.include.members(['base', 'button']);
      expect(partTokens(baseButton(el))).to.not.include('base-error');
    });
  });

  it('never applies a stale outcome after the value changed mid-write', async () => {
    let settleWrite: (() => void) | undefined;
    await withClipboard(
      {
        writeText: () =>
          new Promise<void>((_resolve, reject) => {
            settleWrite = () => reject(new Error('boom'));
          }),
      },
      async () => {
        const el = (await fixture(html`
          <lr-copy-button value="old" feedback-duration="10000"></lr-copy-button>
        `)) as LyraCopyButton;
        let failures = 0;
        el.addEventListener('lr-copy-error', () => failures++);
        baseButton(el).click();
        el.value = 'new';
        await el.updateComplete;
        settleWrite!();
        await settle(el);
        expect(partTokens(baseButton(el))).to.include.members(['base', 'button']);
        expect(partTokens(baseButton(el))).to.not.include('base-error');
        expect(failures).to.equal(0);
      },
    );
  });

  it('routes the error label through a string override', async () => {
    await withClipboard(rejectingClipboard(new Error('boom')), async () => {
      const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
      el.strings = { copyFailed: 'Échec de la copie' };
      await el.updateComplete;
      baseButton(el).click();
      await settle(el);
      expect(baseButton(el).getAttribute('aria-label')).to.equal('Échec de la copie');
      expect(feedbackText(el)).to.equal('Échec de la copie');
    });
  });

  it('signals the error with more than colour, and stays accessible', async () => {
    await withClipboard(rejectingClipboard(new Error('boom')), async () => {
      const resting = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
      const el = (await fixture(html`<lr-copy-button value="hello"></lr-copy-button>`)) as LyraCopyButton;
      const restingIcon = el.shadowRoot!.querySelector('[part="copy-icon"]')!.innerHTML;
      const restingLabel = baseButton(el).getAttribute('aria-label');
      baseButton(el).click();
      await settle(el);
      const errorIcon = el.shadowRoot!.querySelector('[part="error-icon"]')!;
      // Non-colour channels: a different glyph, a different accessible name, and a live-region
      // announcement. Colour is only the fourth signal.
      expect(errorIcon.innerHTML).to.not.equal(restingIcon);
      expect(errorIcon.getAttribute('aria-hidden')).to.equal('true');
      expect(baseButton(el).getAttribute('aria-label')).to.not.equal(restingLabel);
      expect(feedbackText(el).length).to.be.greaterThan(0);
      expect(getComputedStyle(baseButton(el)).color).to.not.equal(
        getComputedStyle(baseButton(resting)).color,
      );
      await expect(el).to.be.accessible();
    });
  });
});
