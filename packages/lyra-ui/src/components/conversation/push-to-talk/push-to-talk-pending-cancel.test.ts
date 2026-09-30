import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './push-to-talk.js';
import type { LyraPushToTalk } from './push-to-talk.js';

describe('explicit pending microphone cancellation', () => {
  for (const outcome of ['grant', 'deny'] as const) {
    it(`retires a permission request before its later ${outcome} without recording or reporting an error`, async () => {
      const original = navigator.mediaDevices.getUserMedia;
      const recorderDescriptor = Object.getOwnPropertyDescriptor(window, 'MediaRecorder');
      let recorderConstructions = 0;
      // Cancellation must retire permission ownership before constructing any recorder.
      Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: class {
        constructor() { recorderConstructions += 1; throw new Error('Retired permission constructed a recorder'); }
      } });
      let grant: (stream: MediaStream) => void = () => {};
      let deny: (error: DOMException) => void = () => {};
      let requests = 0;
      let stopped = 0;
      navigator.mediaDevices.getUserMedia = () => {
        requests += 1;
        return new Promise<MediaStream>((resolve, reject) => { grant = resolve; deny = reject; });
      };
      try {
        const element = await fixture<LyraPushToTalk>(html`<lr-push-to-talk></lr-push-to-talk>`);
        let starts = 0;
        let errors = 0;
        let cancellations = 0;
        element.addEventListener('lr-record-start', () => { starts += 1; });
        element.addEventListener('lr-record-error', () => { errors += 1; });
        element.addEventListener('lr-record-cancel', () => { cancellations += 1; });
        const started = element.start();
        expect(element.state).to.equal('requesting');
        const cancelled = oneEvent(element, 'lr-record-cancel');
        element.cancel();
        if (outcome === 'grant') {
          grant({ getTracks: () => [{ stop() { stopped += 1; } }] } as unknown as MediaStream);
        } else {
          deny(new DOMException('Permission denied', 'NotAllowedError'));
        }
        expect(await started).to.equal(false);
        await cancelled;
        expect(element.state).to.equal('idle');
        expect(requests).to.equal(1);
        expect(starts).to.equal(0);
        expect(errors).to.equal(0);
        expect(cancellations).to.equal(1);
        expect(stopped).to.equal(outcome === 'grant' ? 1 : 0);
        expect(recorderConstructions).to.equal(0);
        element.cancel();
        expect(cancellations).to.equal(1);
      } finally {
        navigator.mediaDevices.getUserMedia = original;
        if (recorderDescriptor) Object.defineProperty(window, 'MediaRecorder', recorderDescriptor);
        else Reflect.deleteProperty(window, 'MediaRecorder');
      }
    });
  }
});
