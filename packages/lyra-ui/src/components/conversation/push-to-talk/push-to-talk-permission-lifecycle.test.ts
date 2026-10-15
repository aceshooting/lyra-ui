import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './push-to-talk.js';
import type { LyraPushToTalk } from './push-to-talk.js';

class CaptureTrack {
  stopCalls = 0;

  stop(): void {
    this.stopCalls++;
  }
}

class CaptureStream {
  readonly track = new CaptureTrack();

  getTracks(): MediaStreamTrack[] {
    return [this.track as unknown as MediaStreamTrack];
  }
}

class ImmediateMediaRecorder {
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

function stubCapture(): { restore: () => void; requestCount: () => number; stream: CaptureStream } {
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
  const originalMediaRecorder = window.MediaRecorder;
  const stream = new CaptureStream();
  let requests = 0;
  navigator.mediaDevices.getUserMedia = (async () => {
    requests++;
    return stream as unknown as MediaStream;
  }) as typeof navigator.mediaDevices.getUserMedia;
  window.MediaRecorder = ImmediateMediaRecorder as unknown as typeof MediaRecorder;

  return {
    restore: () => {
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
      window.MediaRecorder = originalMediaRecorder;
    },
    requestCount: () => requests,
    stream,
  };
}

function trigger(element: LyraPushToTalk): HTMLButtonElement {
  return element.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}

describe('push-to-talk permission lifecycle', () => {
  it('does not request permission while detached and can start after reconnecting', async () => {
    const capture = stubCapture();
    let element: LyraPushToTalk | undefined;
    try {
      element = await fixture<LyraPushToTalk>(html`<lr-push-to-talk></lr-push-to-talk>`);
      element.remove();

      expect(await element.start()).to.equal(false);
      expect(element.state).to.equal('idle');
      expect(capture.requestCount()).to.equal(0);

      document.body.append(element);
      await element.updateComplete;
      expect(await element.start()).to.equal(true);
      expect(capture.requestCount()).to.equal(1);
      expect(element.stream).to.equal(capture.stream);

      const stopped = oneEvent(element, 'lr-record-stop');
      element.stop();
      await stopped;
      expect(element.state).to.equal('idle');
      expect(capture.stream.track.stopCalls).to.equal(1);
    } finally {
      element?.remove();
      capture.restore();
    }
  });

  it('ignores a held gesture while a programmatic take is already recording', async () => {
    const capture = stubCapture();
    let element: LyraPushToTalk | undefined;
    try {
      element = await fixture<LyraPushToTalk>(html`<lr-push-to-talk></lr-push-to-talk>`);
      let starts = 0;
      let stops = 0;
      element.addEventListener('lr-record-start', () => starts++);
      element.addEventListener('lr-record-stop', () => stops++);

      expect(await element.start()).to.equal(true);
      expect(element.state).to.equal('recording');

      const button = trigger(element);
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 27 }));
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 27 }));

      expect(element.state).to.equal('recording');
      expect(capture.requestCount()).to.equal(1);
      expect(starts).to.equal(1);
      expect(stops).to.equal(0);
      expect(capture.stream.track.stopCalls).to.equal(0);

      const stopped = oneEvent(element, 'lr-record-stop');
      element.stop();
      await stopped;
      expect(element.state).to.equal('idle');
      expect(stops).to.equal(1);
      expect(capture.stream.track.stopCalls).to.equal(1);
    } finally {
      element?.remove();
      capture.restore();
    }
  });
});
