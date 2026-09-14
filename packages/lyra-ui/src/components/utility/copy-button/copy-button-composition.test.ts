import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import './copy-button.js';
import type { LyraCopyButton } from './copy-button.class.js';

const ANCESTOR_TOKENS =
  '--lr-icon-button-background: rgb(1, 2, 3); --lr-icon-button-color: rgb(4, 5, 6); --lr-icon-button-radius: 11px;';

function control(el: LyraCopyButton): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
}

describe('lr-copy-button: composed lr-icon-button', () => {
  // The real Clipboard API rejects under a scripted click in a headless browser, so every
  // success-path assertion here would otherwise depend on the runner's focus/permission state.
  let originalClipboard: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.resolve() },
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('composes a real lr-icon-button instead of its own native button', async () => {
    const el = (await fixture(
      html`<lr-copy-button value="hello"></lr-copy-button>`
    )) as LyraCopyButton;
    await el.updateComplete;
    expect(control(el).localName).to.equal('lr-icon-button');
  });

  it('takes its paint from the shared --lr-icon-button-* contract on an ancestor', async () => {
    const host = await fixture(html`
      <div style=${ANCESTOR_TOKENS}>
        <lr-copy-button value="hello"></lr-copy-button>
      </div>
    `);
    const el = host.querySelector<LyraCopyButton>('lr-copy-button')!;
    await el.updateComplete;
    const inner = control(el).shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!;
    const style = getComputedStyle(inner);
    expect(style.backgroundColor, 'the ancestor background token reaches the control').to.equal(
      'rgb(1, 2, 3)'
    );
    expect(style.color, 'the ancestor colour token reaches the control').to.equal('rgb(4, 5, 6)');
    expect(style.borderTopLeftRadius, 'the ancestor radius token reaches the control').to.equal(
      '11px'
    );
  });

  it('forwards the composed control as an exported part', async () => {
    const el = (await fixture(
      html`<lr-copy-button value="hello"></lr-copy-button>`
    )) as LyraCopyButton;
    await el.updateComplete;
    expect(control(el).getAttribute('exportparts')).to.contain('button:base__control');
  });

  it('copies on Enter from the actually focused control', async () => {
    const el = (await fixture(
      html`<lr-copy-button value="from-keyboard"></lr-copy-button>`
    )) as LyraCopyButton;
    await el.updateComplete;
    el.focus();
    await el.updateComplete;
    const inner = control(el).shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!;
    expect(
      control(el).shadowRoot!.activeElement === inner,
      'focus landed on the composed native control'
    ).to.equal(true);
    const copied = oneEvent(el, 'lr-copy');
    await sendKeys({ press: 'Enter' });
    const event = await copied;
    expect((event as CustomEvent<{ text: string }>).detail.text).to.equal('from-keyboard');
  });

  it('disables the composed control when the host is disabled', async () => {
    const el = (await fixture(
      html`<lr-copy-button value="hello" disabled></lr-copy-button>`
    )) as LyraCopyButton;
    await el.updateComplete;
    const composed = control(el) as HTMLElement & { disabled?: boolean };
    expect(composed.disabled, 'the composed icon button is disabled').to.equal(true);
    const inner = composed.shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
    expect(inner.disabled, 'the native control is disabled').to.equal(true);
  });

  it('keeps the outcome glyph colour under hover and press, on specificity not source order', async () => {
    const el = (await fixture(
      html`<lr-copy-button
        value="hello"
        feedback-duration="10000"
        style="--success-color: rgb(1, 120, 45)"
      ></lr-copy-button>`
    )) as LyraCopyButton;
    await el.updateComplete;
    el.click();
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part~="base-success"]') !== null,
      'the confirmation state renders'
    );
    await el.updateComplete;
    const composed = control(el);
    const inner = composed.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!;
    await waitUntil(
      () => getComputedStyle(inner).color === 'rgb(1, 120, 45)',
      'the success colour reaches the composed control'
    );
    // The resting rule and the outcome rule both declare --lr-icon-button-color on the same node.
    // Naming both part tokens makes the outcome (0,2,0) against the resting (0,1,0), so it wins
    // wherever it sits in the sheet -- and its -hover/-active arms keep it painted through both
    // pointer states, which is what the failure/confirmation colour is for.
    try {
      await hoverUntilMatched(composed, 'the composed control receives the pointer');
      await waitUntil(
        () => getComputedStyle(inner).color === 'rgb(1, 120, 45)',
        'the success colour survives hover'
      );
      expect(
        getComputedStyle(inner).getPropertyValue('--lr-icon-button-color-hover').trim()
      ).to.equal('rgb(1, 120, 45)');
      expect(
        getComputedStyle(inner).getPropertyValue('--lr-icon-button-color-active').trim()
      ).to.equal('rgb(1, 120, 45)');
    } finally {
      await resetMouse();
    }
  });

  it('is accessible in the confirmed state', async () => {
    const el = (await fixture(
      html`<lr-copy-button value="hello"></lr-copy-button>`
    )) as LyraCopyButton;
    await el.updateComplete;
    el.click();
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part~="base-success"]') !== null,
      'the confirmation state renders'
    );
    await el.updateComplete;
    // The confirmation also opens the nested tooltip, which fades its own surface in. axe samples
    // whatever colour is painted at the instant it runs, so reading mid-fade reports the
    // intermediate blend as a contrast failure -- reproducible in Firefox, invisible in Chromium.
    // Poll for a settled surface instead of racing the transition.
    const tooltipBody = el.shadowRoot!
      .querySelector('lr-tooltip')!
      .shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    let previous = '';
    await waitUntil(() => {
      const current = getComputedStyle(tooltipBody).backgroundColor;
      const settled = current === previous;
      previous = current;
      return settled;
    }, 'the tooltip surface stops transitioning');
    await expect(el).to.be.accessible();
  });
});
