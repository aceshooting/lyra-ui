import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './push-to-talk.js';
import type { LyraPushToTalk } from './push-to-talk.js';

class CoverageTrack {
  stopCalls = 0;
  stop(): void {
    this.stopCalls++;
  }
}

class CoverageStream {
  readonly track = new CoverageTrack();
  getTracks(): MediaStreamTrack[] {
    return [this.track as unknown as MediaStreamTrack];
  }
}

class CoverageRecorder {
  static isTypeSupported(type: string): boolean {
    return type === 'audio/webm;codecs=opus';
  }
  readonly mimeType = 'audio/webm;codecs=opus';
  state: RecordingState = 'inactive';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}
  start(): void {
    this.state = 'recording';
  }
  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) } as BlobEvent);
    this.onstop?.(new Event('stop'));
  }
}

/** Finishes a stop request one microtask after it is made, like a real recorder's async stop. */
class DelayedRecorder extends CoverageRecorder {
  override stop(): void {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) } as BlobEvent);
      this.onstop?.(new Event('stop'));
    });
  }
}

/** Acknowledges stop() but never finishes, until the test calls finish(). */
class HungRecorder extends CoverageRecorder {
  static last: HungRecorder | undefined;
  stopCalls = 0;
  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    super(stream, options);
    HungRecorder.last = this;
  }
  override stop(): void {
    this.stopCalls++;
    this.state = 'inactive';
  }
  finish(): void {
    this.onstop?.(new Event('stop'));
  }
}

/** Reports a recorder error from inside start() and then throws, as a failing device might. */
class ErrorThenThrowRecorder extends CoverageRecorder {
  override start(): void {
    const event = Object.assign(new Event('error'), { error: new DOMException('device lost', 'NotReadableError') });
    this.onerror?.(event);
    throw new DOMException('cannot start', 'InvalidStateError');
  }
}

interface Capture {
  restore: () => void;
  requestCount: () => number;
  resolve: (index: number) => void;
  streamAt: (index: number) => CoverageStream;
}

function stubCaptures(recorder: unknown, owner: Window = window): Capture {
  const originalGetUserMedia = owner.navigator.mediaDevices.getUserMedia;
  const runtime = owner as unknown as { MediaRecorder: unknown };
  const originalRecorder = runtime.MediaRecorder;
  const requests: Array<{ stream: CoverageStream; resolve: (stream: MediaStream) => void }> = [];
  owner.navigator.mediaDevices.getUserMedia = (() =>
    new Promise<MediaStream>((resolve) => {
      requests.push({ stream: new CoverageStream(), resolve });
    })) as typeof navigator.mediaDevices.getUserMedia;
  runtime.MediaRecorder = recorder;
  return {
    restore: () => {
      owner.navigator.mediaDevices.getUserMedia = originalGetUserMedia;
      runtime.MediaRecorder = originalRecorder;
    },
    requestCount: () => requests.length,
    resolve: (index) => requests[index]!.resolve(requests[index]!.stream as unknown as MediaStream),
    streamAt: (index) => requests[index]!.stream,
  };
}

function trigger(element: LyraPushToTalk): HTMLButtonElement {
  return element.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}

describe('push-to-talk coverage', () => {
  it('keeps a held press queued behind an old-realm take across a reconnect', async () => {
    const mainCapture = stubCaptures(DelayedRecorder);
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameCapture = stubCaptures(DelayedRecorder, iframe.contentWindow!);
    let el: LyraPushToTalk | undefined;
    try {
      el = await fixture<LyraPushToTalk>(html`<lr-push-to-talk></lr-push-to-talk>`);
      let cancels = 0;
      let errors = 0;
      el.addEventListener('lr-record-cancel', () => cancels++);
      el.addEventListener('lr-record-error', () => errors++);

      const firstStarted = oneEvent(el, 'lr-record-start');
      trigger(el).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 301 }));
      await el.updateComplete;
      mainCapture.resolve(0);
      await firstStarted;

      // All of this is synchronous: the old-realm take is still finishing when the new press lands
      // and when the element is detached and re-attached.
      frameDocument.adoptNode(el);
      frameDocument.body.append(el);
      trigger(el).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 302 }));
      el.remove();
      frameDocument.body.append(el);

      await waitUntil(
        () => frameCapture.requestCount() === 1 && el!.state === 'requesting',
        'the held press survives the reconnect and requests the microphone',
      );

      const started = oneEvent(el, 'lr-record-start');
      frameCapture.resolve(0);
      await started;
      const stopped = oneEvent(el, 'lr-record-stop');
      trigger(el).dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 302 }));
      await stopped;
      expect(el.state).to.equal('idle');
      expect(cancels).to.equal(0);
      expect(errors).to.equal(0);
    } finally {
      el?.remove();
      mainCapture.restore();
      frameCapture.restore();
      iframe.remove();
    }
  });

  it('reports one error and stops its tracks when the recorder fails and then throws from start()', async () => {
    const capture = stubCaptures(ErrorThenThrowRecorder);
    let el: LyraPushToTalk | undefined;
    try {
      el = await fixture<LyraPushToTalk>(html`<lr-push-to-talk></lr-push-to-talk>`);
      let errors = 0;
      el.addEventListener('lr-record-error', () => errors++);

      const result = el.start();
      await el.updateComplete;
      capture.resolve(0);

      expect(await result).to.equal(false);
      expect(el.state).to.equal('error');
      expect(errors).to.equal(1);
      expect(capture.streamAt(0).track.stopCalls).to.be.greaterThan(0);
    } finally {
      el?.remove();
      capture.restore();
    }
  });

  it('ignores elapsed and max-duration timers that fire after the lifecycle was invalidated mid-stop', async () => {
    const capture = stubCaptures(HungRecorder);
    let el: LyraPushToTalk | undefined;
    try {
      el = await fixture<LyraPushToTalk>(html`<lr-push-to-talk max-duration-ms="600000"></lr-push-to-talk>`);
      let stops = 0;
      let cancels = 0;
      el.addEventListener('lr-record-stop', () => stops++);
      el.addEventListener('lr-record-cancel', () => cancels++);

      const started = oneEvent(el, 'lr-record-start');
      void el.start();
      await el.updateComplete;
      capture.resolve(0);
      await started;
      const recorder = HungRecorder.last!;
      const timer = (): string => el!.shadowRoot!.querySelector('[part="timer"]')!.textContent!.trim();
      expect(timer()).to.equal('0:00');

      // The recorder acknowledges stop() but has not finished, so the take is still active.
      el.stop();
      expect(recorder.stopCalls).to.equal(1);
      // Re-arm both timers while the stop is in flight, then invalidate the lifecycle.
      el.withoutTimer = true;
      await el.updateComplete;
      el.withoutTimer = false;
      el.maxDurationMs = 1500;
      await el.updateComplete;
      el.disabled = true;
      await el.updateComplete;
      expect(el.state).to.equal('recording');

      // wait-reason: both re-armed timers (1s tick, ~1.5s limit) must elapse to show they are ignored
      await aTimeout(1700);

      expect(timer()).to.equal('0:00');
      expect(el.state).to.equal('recording');
      expect(recorder.stopCalls).to.equal(1);
      expect(stops).to.equal(0);
      expect(cancels).to.equal(0);

      recorder.finish();
      await waitUntil(() => el!.state === 'idle', 'the hung stop eventually completes');
    } finally {
      el?.remove();
      HungRecorder.last = undefined;
      capture.restore();
    }
  });
});
