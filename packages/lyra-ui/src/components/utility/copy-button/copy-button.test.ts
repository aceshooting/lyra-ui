import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './copy-button.js';
import type { LyraCopyButton } from './copy-button.js';

/** The clipboard write is awaited before any feedback state is applied, so a click needs one
 *  macrotask (which drains every pending microtask first) plus the Lit update it schedules. */
const settle = async (el: LyraCopyButton): Promise<void> => {
  await aTimeout(0);
  await el.updateComplete;
};

const baseButton = (el: LyraCopyButton): HTMLButtonElement =>
  el.shadowRoot!.querySelector('[part~="base"]') as HTMLButtonElement;

const feedbackText = (el: LyraCopyButton): string =>
  (el.shadowRoot!.querySelector('[part="feedback"]') as HTMLElement).textContent!.trim();

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
    expect(baseButton(el).getAttribute('aria-label')).to.equal('Copy');
    expect(el.shadowRoot!.querySelectorAll('[part="copy-icon"]').length).to.equal(1);
    expect(feedbackText(el)).to.equal('');
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
    expect(button.getAttribute('part')).to.equal('base base-success');
    expect(el.shadowRoot!.querySelectorAll('[part="success-icon"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="error-icon"]').length).to.equal(0);
    expect(feedbackText(el)).to.equal('Copied!');
  });

  it('reverts the copied confirmation after ~1.5s', async () => {
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
    expect(el.shadowRoot!.activeElement).to.equal(null);
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
    expect(baseButton(el).getAttribute('part')).to.equal('base');
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
    const el = (await fixture(html`<lr-copy-button></lr-copy-button>`)) as LyraCopyButton;
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

    // NaN self-heals to the DEFAULT_FEEDBACK_DURATION (1500ms), not 0/never -- a short wait must
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
      expect(button.getAttribute('part')).to.equal('base base-error');
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
      expect(baseButton(el).getAttribute('part')).to.equal('base base-error');
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
        expect(baseButton(el).getAttribute('part')).to.equal('base base-error');
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
      expect(baseButton(el).getAttribute('part')).to.equal('base base-error');

      await aTimeout(60);
      await el.updateComplete;
      expect(baseButton(el).getAttribute('part')).to.equal('base');
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
      expect(baseButton(el).getAttribute('part')).to.equal('base base-error');

      el.value = 'new';
      await el.updateComplete;
      expect(baseButton(el).getAttribute('part')).to.equal('base');

      baseButton(el).click();
      await settle(el);
      expect(baseButton(el).getAttribute('part')).to.equal('base base-error');
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await el.updateComplete;
      expect(baseButton(el).getAttribute('part')).to.equal('base');
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
        expect(baseButton(el).getAttribute('part')).to.equal('base');
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
