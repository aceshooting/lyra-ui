import { expect, fixture, html, nextFrame, oneEvent } from '@open-wc/testing';
import '../components/lr-commit-card.js';
import '../components/lr-stack-trace.js';
import '../components/lr-terminal.js';
import { COPY_FEEDBACK_MS } from './copy-feedback.js';
import '../components/lr-copy-button.js';
import '../components/lr-diff-view.js';
import '../components/lr-json-viewer.js';
import type { LyraCopyButton } from '../components/lr-copy-button.js';

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

const recordSources = {
  'lr-commit-card': 'hash',
  'lr-stack-trace': 'trace',
  'lr-terminal': 'content',
} as const;

for (const tag of Object.keys(recordSources) as (keyof typeof recordSources)[]) {
  it(`${tag} shows copy feedback only for the current record`, async () => {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const element = document.createElement(tag);
    const source = recordSources[tag];
    element.setAttribute(source, 'original');
    wrapper.append(element);
    await element.updateComplete;
    const button = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="copy-button"]')!;
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writes: string[] = [];
    let finish!: () => void;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText(text: string) {
        writes.push(text);
        return new Promise<void>(resolve => { finish = resolve; });
      } },
    });
    try {
      const events: string[] = [];
      element.addEventListener('lr-copy', event => events.push((event as CustomEvent<{ text: string }>).detail.text));
      button.click();
      element.setAttribute(source, 'replacement');
      await element.updateComplete;
      finish();
      await nextFrame();
      expect(writes).to.deep.equal(['original']);
      expect(button.dataset['copyStatus']).to.equal('rest');
      expect(events).to.deep.equal([]);

      const copied = oneEvent(element, 'lr-copy');
      button.click();
      element.setAttribute('size', 's');
      await element.updateComplete;
      finish();
      await copied;
      await element.updateComplete;
      expect(writes).to.deep.equal(['original', 'replacement']);
      expect(events).to.deep.equal(['replacement']);
      expect(button.dataset['copyStatus']).to.equal('success');
      if (element.localName === 'lr-terminal') {
        wrapper.querySelector('lr-terminal')!.write(' more');
      } else {
        element.setAttribute(source, 'another record');
      }
      await element.updateComplete;
      expect(button.dataset['copyStatus']).to.equal('rest');
    } finally {
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
}
