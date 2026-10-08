import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { COPY_FEEDBACK_MS } from './copy-feedback.js';
import '../components/utility/copy-button/copy-button.js';
import '../components/utility/diff-view/diff-view.js';
import '../components/utility/json-viewer/json-viewer.js';
import type { LyraCopyButton } from '../components/utility/copy-button/copy-button.js';

/** Delays of every window timer scheduled while `action` runs. */
async function timerDelaysDuring(action: () => Promise<void>): Promise<number[]> {
  const original = window.setTimeout;
  const browserSetTimeout = original as unknown as (handler: TimerHandler, delay?: number, ...args: unknown[]) => number;
  const delays: number[] = [];
  const recording = (handler: TimerHandler, delay?: number, ...args: unknown[]): number => {
    delays.push(Number(delay ?? 0));
    return browserSetTimeout.call(window, handler, delay, ...args);
  };
  window.setTimeout = recording as unknown as typeof window.setTimeout;
  try {
    await action();
  } finally {
    window.setTimeout = original;
  }
  return delays;
}

it('shares one 1500 ms copied-feedback duration', () => {
  expect(COPY_FEEDBACK_MS).to.equal(1500);
});

it('defaults lr-copy-button feedback-duration to the shared constant', async () => {
  const el = await fixture<LyraCopyButton>(html`<lr-copy-button value="x"></lr-copy-button>`);
  expect(el.feedbackDuration).to.equal(COPY_FEEDBACK_MS);
});

for (const tag of ['lr-json-viewer', 'lr-diff-view'] as const) {
  it(`${tag} resets its copied feedback after the shared duration`, async () => {
    const el = tag === 'lr-json-viewer'
      ? await fixture<HTMLElement>(html`<lr-json-viewer copyable .data=${{ a: 1 }}></lr-json-viewer>`)
      : await fixture<HTMLElement>(html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`);
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="copy-button"]')!;
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    // Headless pages have no clipboard permission; a resolved write is the success path under test.
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } });
    try {
      const delays = await timerDelaysDuring(async () => {
        const copied = oneEvent(el, 'lr-copy');
        button.click();
        await copied;
      });
      expect(delays).to.include(COPY_FEEDBACK_MS);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
}
