import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraAudioVisualizer } from './audio-visualizer.class.js';
import './audio-visualizer.js';

async function paintedCanvas(el: LyraAudioVisualizer): Promise<HTMLCanvasElement> {
  const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('canvas')!;
  await waitUntil(() => {
    const context = canvas.getContext('2d');
    return !!context && context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data[3]! > 0;
  }, 'the external level draws a visible bar');
  return canvas;
}

it('draws an external audio level when the browser has no intersection observer', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  let el: LyraAudioVisualizer | undefined;
  try {
    el = await fixture<LyraAudioVisualizer>(html`<lr-audio-visualizer style="width:120px;height:48px" .level=${1}></lr-audio-visualizer>`);
    const canvas = await paintedCanvas(el);
    expect(canvas.width).to.be.greaterThan(0);
  } finally {
    el?.remove();
    if (descriptor) Object.defineProperty(window, 'IntersectionObserver', descriptor);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
  }
});

for (const rejectObservation of [true, false]) {
  it(`preserves audio drawing and disconnects safely when observer cleanup throws (observe fails: ${rejectObservation})`, async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
    let disconnects = 0;
    class BrokenCleanupObserver {
      readonly root = null;
      readonly rootMargin = '0px';
      readonly thresholds = [0];
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element): void {
        if (rejectObservation) throw new Error('observation unavailable');
        queueMicrotask(() => this.callback([{ target, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver));
      }
      unobserve(): void {}
      takeRecords(): IntersectionObserverEntry[] { return []; }
      disconnect(): never { disconnects += 1; throw new Error('observer cleanup unavailable'); }
    }
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: BrokenCleanupObserver });
    let el: LyraAudioVisualizer | undefined;
    try {
      el = await fixture<LyraAudioVisualizer>(html`<lr-audio-visualizer style="width:120px;height:48px" .level=${1}></lr-audio-visualizer>`);
      await paintedCanvas(el);
      el.remove();
      expect(disconnects).to.equal(1);
      expect(el.isConnected).to.equal(false);
    } finally {
      el?.remove();
      if (descriptor) Object.defineProperty(window, 'IntersectionObserver', descriptor);
      else Reflect.deleteProperty(window, 'IntersectionObserver');
    }
  });
}
