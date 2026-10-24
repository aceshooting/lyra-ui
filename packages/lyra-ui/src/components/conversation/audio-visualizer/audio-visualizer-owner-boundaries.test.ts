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

function replaceOwnProperty(target: object, name: PropertyKey, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, name);
  Object.defineProperty(target, name, { configurable: true, writable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(target, name, descriptor);
    else delete (target as Record<PropertyKey, unknown>)[name];
  };
}

describe('audio visualizer owner boundaries', () => {
  it('waits for a usable intersection entry after malformed observer callbacks', async () => {
    class MalformedObserver {
      readonly root = null;
      readonly rootMargin = '0px';
      readonly thresholds = [0];
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element): void {
        queueMicrotask(() => {
          this.callback(undefined as unknown as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
          this.callback([{ target, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
        });
      }
      unobserve(): void {}
      takeRecords(): IntersectionObserverEntry[] { return []; }
      disconnect(): void {}
    }
    const restore = replaceOwnProperty(window, 'IntersectionObserver', MalformedObserver);
    let el: LyraAudioVisualizer | undefined;
    try {
      el = await fixture<LyraAudioVisualizer>(html`<lr-audio-visualizer style="width:120px;height:48px" .level=${1}></lr-audio-visualizer>`);
      const canvas = await paintedCanvas(el);
      expect(canvas.width).to.be.greaterThan(0);
    } finally {
      el?.remove();
      restore();
    }
  });

  it('survives a window-less document and draws again when returned to a window', async () => {
    const el = await fixture<LyraAudioVisualizer>(html`<lr-audio-visualizer style="width:120px;height:48px" .level=${1}></lr-audio-visualizer>`);
    await paintedCanvas(el);
    const windowless = document.implementation.createHTMLDocument('windowless');

    let constructions = 0;
    class CountingContext extends EventTarget {
      state = 'suspended';
      constructor() {
        super();
        constructions += 1;
      }
      createMediaStreamSource(): never { throw new Error('unreachable'); }
      createAnalyser(): never { throw new Error('unreachable'); }
      resume(): Promise<void> { return Promise.resolve(); }
      suspend(): Promise<void> { return Promise.resolve(); }
      close(): Promise<void> { return Promise.resolve(); }
    }
    const restoreContext = replaceOwnProperty(window, 'AudioContext', CountingContext);

    try {
      el.remove();
      windowless.body.append(windowless.adoptNode(el));
      expect(el.isConnected).to.equal(true);
      el.stream = { getAudioTracks: () => [{ readyState: 'live' } as MediaStreamTrack] } as MediaStream;
      await el.updateComplete;
      expect(constructions, 'no audio graph is built where there is no window').to.equal(0);
      el.stream = null;
      windowless.body.removeChild(el);

      document.body.append(document.adoptNode(el));
      restoreContext();
      await paintedCanvas(el);
    } finally {
      el.remove();
      restoreContext();
    }
  });

  it('draws in an owner window that has no media-query support', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe style="width:200px;height:120px"></iframe>`);
    const frameWindow = frame.contentWindow!;
    const frameDocument = frame.contentDocument!;
    const el = await fixture<LyraAudioVisualizer>(html`<lr-audio-visualizer style="width:120px;height:48px" .level=${1}></lr-audio-visualizer>`);
    const restore = replaceOwnProperty(frameWindow, 'matchMedia', undefined);
    try {
      el.remove();
      frameDocument.body.append(frameDocument.adoptNode(el));
      await paintedCanvas(el);
    } finally {
      el.remove();
      restore();
    }
  });
});

describe('audio visualizer stream attachment rollback', () => {
  it('disconnects a created source node when the analyser cannot be built', async () => {
    let sourceDisconnects = 0;
    let closes = 0;
    class PartialGraphContext extends EventTarget {
      state: 'suspended' | 'running' | 'closed' = 'suspended';
      createMediaStreamSource(): MediaStreamAudioSourceNode {
        return { connect() {}, disconnect() { sourceDisconnects += 1; } } as unknown as MediaStreamAudioSourceNode;
      }
      createAnalyser(): never {
        throw new Error('No analyser');
      }
      resume(): Promise<void> { return Promise.resolve(); }
      suspend(): Promise<void> { return Promise.resolve(); }
      close(): Promise<void> {
        closes += 1;
        this.state = 'closed';
        return Promise.resolve();
      }
    }
    const restore = replaceOwnProperty(window, 'AudioContext', PartialGraphContext);
    try {
      const el = await fixture<LyraAudioVisualizer>(html`<lr-audio-visualizer></lr-audio-visualizer>`);
      el.stream = { getAudioTracks: () => [{ readyState: 'live' } as MediaStreamTrack] } as MediaStream;
      await el.updateComplete;

      expect(sourceDisconnects).to.equal(1);
      expect(closes).to.equal(1);
    } finally {
      restore();
    }
  });
});
