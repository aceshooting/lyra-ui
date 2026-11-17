import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './push-to-talk.js';
import type { LyraPushToTalk } from './push-to-talk.js';

class CaptureTrack {
  stopCalls = 0;
  stop(): void { this.stopCalls++; }
}

class CaptureStream {
  readonly track = new CaptureTrack();
  getTracks(): MediaStreamTrack[] { return [this.track as unknown as MediaStreamTrack]; }
}

function stubCapture() {
  const mediaDevices = navigator.mediaDevices;
  const permissionDescriptor = Object.getOwnPropertyDescriptor(mediaDevices, 'getUserMedia');
  const recorderDescriptor = Object.getOwnPropertyDescriptor(window, 'MediaRecorder');
  const streams: CaptureStream[] = [];
  const recorders: CaptureRecorder[] = [];

  class CaptureRecorder {
    static isTypeSupported(type: string): boolean { return type === 'audio/webm;codecs=opus'; }
    readonly mimeType = 'audio/webm;codecs=opus';
    state: RecordingState = 'inactive';
    ondataavailable: ((event: BlobEvent) => void) | null = null;
    onstop: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    stopCalls = 0;

    constructor(_stream: MediaStream, _options?: MediaRecorderOptions) { recorders.push(this); }
    start(_timeslice?: number): void { this.state = 'recording'; }
    stop(): void {
      if (this.state === 'inactive') throw new DOMException('Recorder is already stopped', 'InvalidStateError');
      this.stopCalls++;
      this.state = 'inactive';
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) } as BlobEvent);
        this.onstop?.(new Event('stop'));
      });
    }
  }

  Object.defineProperty(mediaDevices, 'getUserMedia', {
    configurable: true,
    writable: true,
    value: async (): Promise<MediaStream> => {
      const stream = new CaptureStream();
      streams.push(stream);
      return stream as unknown as MediaStream;
    },
  });
  Object.defineProperty(window, 'MediaRecorder', { configurable: true, writable: true, value: CaptureRecorder });
  return {
    streams,
    recorders,
    restore(): void {
      if (permissionDescriptor) Object.defineProperty(mediaDevices, 'getUserMedia', permissionDescriptor);
      else Reflect.deleteProperty(mediaDevices, 'getUserMedia');
      if (recorderDescriptor) Object.defineProperty(window, 'MediaRecorder', recorderDescriptor);
      else Reflect.deleteProperty(window, 'MediaRecorder');
    },
  };
}

async function expectFreshTake(element: LyraPushToTalk, capture: ReturnType<typeof stubCapture>): Promise<void> {
  const previousRequests = capture.streams.length;
  const previousRecorders = capture.recorders.length;
  const started = oneEvent(element, 'lr-record-start');
  expect(await element.start()).to.equal(true);
  await started;
  expect(element.state).to.equal('recording');
  expect(capture.streams.length).to.equal(previousRequests + 1);
  expect(capture.recorders.length).to.equal(previousRecorders + 1);
  expect(element.stream === (capture.streams.at(-1) as unknown as MediaStream)).to.equal(true);
  expect(capture.streams.at(-1)!.track.stopCalls).to.equal(0);
  const stopped = oneEvent(element, 'lr-record-stop');
  element.stop();
  const event = await stopped;
  expect((event.detail.blob as Blob).size).to.be.greaterThan(0);
  expect(element.state).to.equal('idle');
  expect(element.stream === null).to.equal(true);
  expect(capture.streams.at(-1)!.track.stopCalls).to.equal(1);
  expect(capture.recorders.at(-1)!.stopCalls).to.equal(1);
}

describe('push-to-talk lifecycle changes during state notifications', () => {
  for (const retirement of ['cancel', 'remove'] as const) {
    it(`does not begin a permission request after ${retirement} during the requesting notification`, async () => {
      const capture = stubCapture();
      let element: LyraPushToTalk | undefined;
      try {
        const wrapper = await fixture<HTMLDivElement>(html`<div><lr-push-to-talk></lr-push-to-talk></div>`);
        element = wrapper.querySelector<LyraPushToTalk>('lr-push-to-talk')!;
        await element.updateComplete;
        const host = element;
        let retired = 0;
        let starts = 0;
        let stops = 0;
        let errors = 0;
        host.addEventListener('lr-record-start', () => { starts++; });
        host.addEventListener('lr-record-stop', () => { stops++; });
        host.addEventListener('lr-record-error', () => { errors++; });
        host.addEventListener('lr-record-state-change', event => {
          if (event.detail.state !== 'requesting') return;
          retired++;
          if (retirement === 'cancel') host.cancel();
          else host.remove();
        }, { once: true });

        expect(await host.start()).to.equal(false);
        expect(retired).to.equal(1);
        expect(host.state).to.equal('idle');
        expect(host.stream === null).to.equal(true);
        expect(capture.streams.length, 'retirement precedes the first permission request').to.equal(0);
        expect(capture.recorders.length).to.equal(0);
        expect({ starts, stops, errors }).to.deep.equal({ starts: 0, stops: 0, errors: 0 });

        if (!host.isConnected) wrapper.append(host);
        await host.updateComplete;
        await expectFreshTake(host, capture);
        expect({ starts, stops, errors }).to.deep.equal({ starts: 1, stops: 1, errors: 0 });
      } finally {
        element?.remove();
        await Promise.resolve();
        capture.restore();
      }
    });
  }

  it('does not publish an obsolete record-start after removal during the recording notification', async () => {
    const capture = stubCapture();
    let element: LyraPushToTalk | undefined;
    try {
      const wrapper = await fixture<HTMLDivElement>(html`<div><lr-push-to-talk></lr-push-to-talk></div>`);
      element = wrapper.querySelector<LyraPushToTalk>('lr-push-to-talk')!;
      await element.updateComplete;
      const host = element;
      let retired = 0;
      let starts = 0;
      let obsoleteStarts = 0;
      let stops = 0;
      let errors = 0;
      host.addEventListener('lr-record-start', () => {
        starts++;
        if (!host.isConnected) obsoleteStarts++;
      });
      host.addEventListener('lr-record-stop', () => { stops++; });
      host.addEventListener('lr-record-error', () => { errors++; });
      const retire = (event: CustomEvent<{ state: string }>): void => {
        if (event.detail.state !== 'recording') return;
        host.removeEventListener('lr-record-state-change', retire);
        retired++;
        host.remove();
      };
      host.addEventListener('lr-record-state-change', retire);

      await host.start();
      expect(retired).to.equal(1);
      expect(host.isConnected).to.equal(false);
      expect(capture.streams.length).to.equal(1);
      expect(capture.recorders.length).to.equal(1);
      await waitUntil(() => host.state === 'idle' && capture.streams[0]!.track.stopCalls === 1,
        'the disconnected take releases its stream after the recorder stops');
      expect(capture.recorders[0]!.stopCalls).to.equal(1);
      expect(host.stream === null).to.equal(true);
      expect({ starts, obsoleteStarts, stops, errors }).to.deep.equal({ starts: 0, obsoleteStarts: 0, stops: 0, errors: 0 });

      wrapper.append(host);
      await host.updateComplete;
      await expectFreshTake(host, capture);
      expect({ starts, obsoleteStarts, stops, errors }).to.deep.equal({ starts: 1, obsoleteStarts: 0, stops: 1, errors: 0 });
      expect(capture.streams[0]!.track.stopCalls).to.equal(1);
    } finally {
      element?.remove();
      await Promise.resolve();
      capture.restore();
    }
  });

  for (const terminalAction of ['cancel', 'stop'] as const) {
    it(`does not publish an obsolete record-start after ${terminalAction} during the recording notification`, async () => {
      const capture = stubCapture();
      let element: LyraPushToTalk | undefined;
      try {
        element = await fixture<LyraPushToTalk>(html`<lr-push-to-talk></lr-push-to-talk>`);
        await element.updateComplete;
        const host = element;
        let retired = 0;
        let starts = 0;
        let stops = 0;
        let cancellations = 0;
        let errors = 0;
        host.addEventListener('lr-record-start', () => { starts++; });
        host.addEventListener('lr-record-stop', () => { stops++; });
        host.addEventListener('lr-record-cancel', () => { cancellations++; });
        host.addEventListener('lr-record-error', () => { errors++; });
        const retire = (event: CustomEvent<{ state: string }>): void => {
          if (event.detail.state !== 'recording') return;
          host.removeEventListener('lr-record-state-change', retire);
          retired++;
          host[terminalAction]();
        };
        host.addEventListener('lr-record-state-change', retire);
        const terminal = oneEvent(host, terminalAction === 'cancel' ? 'lr-record-cancel' : 'lr-record-stop');

        await host.start();
        const event = await terminal;
        expect(retired).to.equal(1);
        expect(host.isConnected).to.equal(true);
        expect(host.state).to.equal('idle');
        expect(host.stream === null).to.equal(true);
        expect(capture.streams.length).to.equal(1);
        expect(capture.recorders.length).to.equal(1);
        expect(capture.streams[0]!.track.stopCalls).to.equal(1);
        expect(capture.recorders[0]!.stopCalls).to.equal(1);
        expect({ starts, stops, cancellations, errors }).to.deep.equal({
          starts: 0,
          stops: terminalAction === 'stop' ? 1 : 0,
          cancellations: terminalAction === 'cancel' ? 1 : 0,
          errors: 0,
        });
        if (terminalAction === 'cancel') {
          expect(event.detail).to.equal(null);
        } else {
          expect(await (event.detail.blob as Blob).text()).to.equal('voice');
          expect(event.detail.durationMs).to.be.at.least(0);
        }

        await expectFreshTake(host, capture);
        expect({ starts, stops, cancellations, errors }).to.deep.equal({
          starts: 1,
          stops: terminalAction === 'stop' ? 2 : 1,
          cancellations: terminalAction === 'cancel' ? 1 : 0,
          errors: 0,
        });
        expect(capture.streams[0]!.track.stopCalls).to.equal(1);
        expect(capture.recorders[0]!.stopCalls).to.equal(1);
      } finally {
        element?.remove();
        await Promise.resolve();
        capture.restore();
      }
    });
  }
});
