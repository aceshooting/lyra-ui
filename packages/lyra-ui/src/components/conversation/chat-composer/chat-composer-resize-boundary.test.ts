import { expect, fixture, html } from '@open-wc/testing';
import './chat-composer.js';
import type { LyraChatComposer } from './chat-composer.js';

it('coalesces legacy resize notifications and ignores callbacks retained after disconnect', async () => {
  const OriginalObserver = window.ResizeObserver;
  const originalRaf = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  const observations = new Map<Element, { callback: ResizeObserverCallback; observer: ResizeObserver }>();
  class ControlledObserver implements ResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element): void { observations.set(target, { callback: this.callback, observer: this }); }
    unobserve(): void {}
    disconnect(): void {}
  }
  let el: LyraChatComposer | undefined;
  try {
    window.ResizeObserver = ControlledObserver;
    el = await fixture<LyraChatComposer>(html`<lr-chat-composer style="display:block;width:600px" min-rows="1" max-rows="10"></lr-chat-composer>`);
    el.value = 'A long draft that must remain readable when its container becomes narrow. '.repeat(5);
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="textarea"]')!;
    const observation = observations.get(textarea);
    if (!observation) throw new Error('Textarea observation was not armed');
    const wideHeight = parseFloat(textarea.style.height);
    const frames = new Map<number, FrameRequestCallback>();
    let sequence = 0;
    window.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence; };
    window.cancelAnimationFrame = handle => { frames.delete(handle); };
    const deliver = (width: number): void => {
      const entry: ResizeObserverEntry = { target: textarea, contentRect: new DOMRectReadOnly(0, 0, width, 40),
        contentBoxSize: [], borderBoxSize: [], devicePixelContentBoxSize: [] };
      observation.callback([entry], observation.observer);
    };
    el.style.width = '140px';
    deliver(200);
    deliver(140);
    expect(frames.size, 'one pending resize for the latest allocation').to.equal(1);
    const latest = [...frames.values()][0]!;
    frames.clear();
    latest(performance.now());
    expect(parseFloat(textarea.style.height), 'the latest narrow allocation keeps the draft readable').to.be.greaterThan(wideHeight);
    el.remove();
    const height = textarea.style.height;
    deliver(300);
    expect(frames.size, 'a disconnected observer cannot schedule more work').to.equal(0);
    expect(textarea.style.height).to.equal(height);
  } finally {
    window.ResizeObserver = OriginalObserver;
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancel;
    el?.remove();
  }
});
