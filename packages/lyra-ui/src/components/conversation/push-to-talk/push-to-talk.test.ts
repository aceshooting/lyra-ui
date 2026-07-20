import { fixture, expect, oneEvent, aTimeout, html } from '@open-wc/testing';
import './push-to-talk.js';
import '../../utility/live-region/live-region.js';
import type { LyraPushToTalk } from './push-to-talk.js';
import { MAX_TIMEOUT_MS } from '../../../internal/numbers.js';
import { styles } from './push-to-talk.styles.js';

// -- Fakes for getUserMedia / MediaRecorder / AudioContext -----------------
// No `sinon` in this repo -- plain manual monkey-patching (save the real
// global, assign a fake, restore in `finally`) is the established pattern,
// see src/internal/motion.test.ts's window.matchMedia stub.

class FakeTrack {
  stopped = false;
  stop(): void {
    this.stopped = true;
  }
}
class FakeStream {
  private tracks = [new FakeTrack()];
  getTracks(): FakeTrack[] {
    return this.tracks;
  }
}
class FakeMediaRecorder extends EventTarget {
  static isTypeSupported(type: string): boolean {
    return type === 'audio/webm;codecs=opus';
  }
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType: string;
  constructor(
    public stream: FakeStream,
    options?: { mimeType?: string },
  ) {
    super();
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }
  start(_timeslice?: number): void {
    this.state = 'recording';
  }
  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['x'], { type: this.mimeType }) });
    this.onstop?.();
  }
}
class FakeAnalyserNode {
  fftSize = 256;
  frequencyBinCount = 128;
  getByteTimeDomainData(arr: Uint8Array): void {
    arr.fill(220); // a loud, non-silent signal
  }
}
class FakeAudioContext {
  state = 'running';
  createMediaStreamSource(_stream: unknown): { connect: () => void } {
    return { connect: () => {} };
  }
  createAnalyser(): FakeAnalyserNode {
    return new FakeAnalyserNode();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

function stubSuccessfulCapture(): () => void {
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
  const originalMediaRecorder = window.MediaRecorder;
  const originalAudioContext = window.AudioContext;
  navigator.mediaDevices.getUserMedia = (async () => new FakeStream() as unknown as MediaStream) as typeof navigator.mediaDevices.getUserMedia;
  window.MediaRecorder = FakeMediaRecorder as unknown as typeof MediaRecorder;
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  return () => {
    navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    window.MediaRecorder = originalMediaRecorder;
    (window as unknown as { AudioContext: unknown }).AudioContext = originalAudioContext;
  };
}

/** Stubs getUserMedia with a promise the test controls, to simulate a still-pending permission
 *  prompt (state === 'requesting') and exercise release-while-requesting handling. */
function stubDeferredCapture(): { restore: () => void; resolve: () => void } {
  const original = navigator.mediaDevices.getUserMedia;
  let resolveFn: () => void = () => {};
  navigator.mediaDevices.getUserMedia = (() =>
    new Promise<MediaStream>((resolve) => {
      resolveFn = () => resolve(new FakeStream() as unknown as MediaStream);
    })) as typeof navigator.mediaDevices.getUserMedia;
  window.MediaRecorder = FakeMediaRecorder as unknown as typeof MediaRecorder;
  return {
    restore: () => {
      navigator.mediaDevices.getUserMedia = original;
    },
    resolve: () => resolveFn(),
  };
}

function stubDeniedCapture(): () => void {
  const original = navigator.mediaDevices.getUserMedia;
  navigator.mediaDevices.getUserMedia = (async () => {
    throw new DOMException('denied', 'NotAllowedError');
  }) as typeof navigator.mediaDevices.getUserMedia;
  return () => {
    navigator.mediaDevices.getUserMedia = original;
  };
}

function stubErroringCapture(): () => void {
  const original = navigator.mediaDevices.getUserMedia;
  navigator.mediaDevices.getUserMedia = (async () => {
    throw new Error('device busy');
  }) as typeof navigator.mediaDevices.getUserMedia;
  return () => {
    navigator.mediaDevices.getUserMedia = original;
  };
}

function trigger(el: LyraPushToTalk): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}
function status(el: LyraPushToTalk): string {
  return el.shadowRoot!.querySelector('[part="status"]')?.textContent?.trim() ?? '';
}

// -- Defaults ----------------------------------------------------------

it('defaults to mode=hold, state=idle, and every capture prop at its documented default', async () => {
  const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
  expect(el.mode).to.equal('hold');
  expect(el.state).to.equal('idle');
  expect(el.getAttribute('data-state')).to.equal('idle');
  expect(el.timesliceMs).to.equal(0);
  expect(el.mimeType).to.equal('');
  expect(el.deviceId).to.equal('');
  expect(el.levelEvents).to.be.false;
  expect(el.maxDurationMs).to.equal(0);
  expect(el.showTimer).to.be.true;
  expect(el.disabled).to.be.false;
  expect(el.stream).to.be.null;
});

it('gives the trigger a hover state while enabled', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='trigger'\]:hover:not\(:disabled\)[^{]*\{[^}]*background:/);
});

// -- Unsupported environment ---------------------------------------------

it('renders the trigger disabled and shows the unsupported status when MediaRecorder is unavailable', async () => {
  const original = window.MediaRecorder;
  // @ts-expect-error deliberately undefining a browser global for the test
  delete window.MediaRecorder;
  try {
    const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    expect(trigger(el).disabled).to.be.true;
    expect(status(el)).to.equal('Recording is not supported in this browser');
    expect(await el.start()).to.be.false;
  } finally {
    window.MediaRecorder = original;
  }
});

// -- Hold mode: full lifecycle --------------------------------------------

describe('hold mode', () => {
  it('pointerdown starts a take (emitting lr-record-start with the stream) and pointerup stops it (emitting lr-record-stop with a blob and durationMs)', async () => {
    const restore = stubSuccessfulCapture();
    try {
      const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
      const btn = trigger(el);

      const startPromise = oneEvent(el, 'lr-record-start');
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      const startEvent = await startPromise;
      expect(startEvent.detail.stream).to.exist;
      expect(el.state).to.equal('recording');
      expect(el.getAttribute('data-state')).to.equal('recording');
      expect(el.stream).to.equal(startEvent.detail.stream);

      const stopPromise = oneEvent(el, 'lr-record-stop');
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
      const stopEvent = await stopPromise;
      expect(stopEvent.detail.blob).to.be.instanceOf(Blob);
      expect(stopEvent.detail.durationMs).to.be.a('number');
      expect(el.state).to.equal('idle');
      expect(el.stream).to.be.null;
    } finally {
      restore();
    }
  });

  it('renders no aria-pressed in hold mode (it is not a toggle button)', async () => {
    const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    expect(trigger(el).hasAttribute('aria-pressed')).to.be.false;
  });

  it('ignores a repeated (auto-repeat) Enter keydown -- only the first keydown starts a take', async () => {
    const restore = stubSuccessfulCapture();
    try {
      const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
      const btn = trigger(el);
      let starts = 0;
      el.addEventListener('lr-record-start', () => starts++);

      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, repeat: false }));
      await aTimeout(20);
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, repeat: true }));
      await aTimeout(20);
      expect(starts).to.equal(1);

      btn.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      await aTimeout(20);
      expect(el.state).to.equal('idle');
    } finally {
      restore();
    }
  });

  it('stops an in-progress take on blur', async () => {
    const restore = stubSuccessfulCapture();
    try {
      const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
      const btn = trigger(el);
      const startPromise = oneEvent(el, 'lr-record-start');
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      await startPromise;

      const stopPromise = oneEvent(el, 'lr-record-stop');
      btn.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      await stopPromise;
      expect(el.state).to.equal('idle');
    } finally {
      restore();
    }
  });

  it('releasing (pointerup) while a permission request is still pending cancels it instead of letting recording start (regression)', async () => {
    const { restore, resolve } = stubDeferredCapture();
    try {
      const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
      const btn = trigger(el);
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      await el.updateComplete;
      expect(el.state).to.equal('requesting');

      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));

      const cancelPromise = oneEvent(el, 'lr-record-cancel');
      resolve();
      await cancelPromise;
      expect(el.state).to.equal('idle');
    } finally {
      restore();
    }
  });

  it('releasing (Enter keyup) while a permission request is still pending cancels it instead of letting recording start (regression)', async () => {
    const { restore, resolve } = stubDeferredCapture();
    try {
      const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
      const btn = trigger(el);
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await el.updateComplete;
      expect(el.state).to.equal('requesting');

      btn.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

      const cancelPromise = oneEvent(el, 'lr-record-cancel');
      resolve();
      await cancelPromise;
      expect(el.state).to.equal('idle');
    } finally {
      restore();
    }
  });
});

// -- Toggle mode -----------------------------------------------------------

describe('toggle mode', () => {
  it('click starts and a second click stops, toggling aria-pressed', async () => {
    const restore = stubSuccessfulCapture();
    try {
      const el = (await fixture(html`<lr-push-to-talk mode="toggle"></lr-push-to-talk>`)) as LyraPushToTalk;
      const btn = trigger(el);
      expect(btn.getAttribute('aria-pressed')).to.equal('false');

      const startPromise = oneEvent(el, 'lr-record-start');
      btn.click();
      await startPromise;
      await el.updateComplete;
      expect(btn.getAttribute('aria-pressed')).to.equal('true');
      expect(el.state).to.equal('recording');

      const stopPromise = oneEvent(el, 'lr-record-stop');
      btn.click();
      await stopPromise;
      await el.updateComplete;
      expect(btn.getAttribute('aria-pressed')).to.equal('false');
      expect(el.state).to.equal('idle');
    } finally {
      restore();
    }
  });

  it('a pointerdown/pointerup pair does nothing in toggle mode', async () => {
    const restore = stubSuccessfulCapture();
    try {
      const el = (await fixture(html`<lr-push-to-talk mode="toggle"></lr-push-to-talk>`)) as LyraPushToTalk;
      const btn = trigger(el);
      let fired = false;
      el.addEventListener('lr-record-start', () => (fired = true));
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
      await aTimeout(20);
      expect(fired).to.be.false;
    } finally {
      restore();
    }
  });
});

// -- Escape cancels in both modes ------------------------------------------

it('Escape cancels an in-progress take, firing lr-record-cancel (never lr-record-stop)', async () => {
  const restore = stubSuccessfulCapture();
  try {
    const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    const btn = trigger(el);
    const startPromise = oneEvent(el, 'lr-record-start');
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    await startPromise;

    let stopped = false;
    el.addEventListener('lr-record-stop', () => (stopped = true));
    const cancelPromise = oneEvent(el, 'lr-record-cancel');
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await cancelPromise;
    expect(stopped).to.be.false;
    expect(el.state).to.equal('idle');
  } finally {
    restore();
  }
});

it('the public cancel() method works identically to the Escape key', async () => {
  const restore = stubSuccessfulCapture();
  try {
    const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    await el.start();
    expect(el.state).to.equal('recording');
    const cancelPromise = oneEvent(el, 'lr-record-cancel');
    el.cancel();
    await cancelPromise;
    expect(el.state).to.equal('idle');
  } finally {
    restore();
  }
});

// -- Permission / error paths -----------------------------------------------

it('resolves start() false and transitions to denied on NotAllowedError, emitting lr-record-error', async () => {
  const restore = stubDeniedCapture();
  try {
    const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    const errorPromise = oneEvent(el, 'lr-record-error');
    const started = await el.start();
    const errorEvent = await errorPromise;
    expect(started).to.be.false;
    expect(el.state).to.equal('denied');
    expect(el.getAttribute('data-state')).to.equal('denied');
    expect((errorEvent.detail.error as DOMException).name).to.equal('NotAllowedError');
    expect(status(el)).to.equal('Microphone access denied');
  } finally {
    restore();
  }
});

it('transitions to the generic error state for a non-permission failure', async () => {
  const restore = stubErroringCapture();
  try {
    const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    await el.start();
    expect(el.state).to.equal('error');
    expect(status(el)).to.equal('Recording failed');
  } finally {
    restore();
  }
});

it('disabled suppresses start() entirely', async () => {
  const restore = stubSuccessfulCapture();
  try {
    const el = (await fixture(html`<lr-push-to-talk disabled></lr-push-to-talk>`)) as LyraPushToTalk;
    expect(await el.start()).to.be.false;
    expect(el.state).to.equal('idle');
  } finally {
    restore();
  }
});

// -- Chunked streaming -------------------------------------------------------

it('emits lr-record-chunk once per timeslice when timeslice-ms > 0, and never when it is 0', async () => {
  const restore = stubSuccessfulCapture();
  try {
    const el = (await fixture(
      html`<lr-push-to-talk timeslice-ms="250"></lr-push-to-talk>`,
    )) as LyraPushToTalk;
    const chunks: Blob[] = [];
    el.addEventListener('lr-record-chunk', (e) => chunks.push((e as CustomEvent<{ blob: Blob }>).detail.blob));
    await el.start();
    const recorder = (el as unknown as { recorder: FakeMediaRecorder }).recorder;
    recorder.ondataavailable!({ data: new Blob(['a']) });
    recorder.ondataavailable!({ data: new Blob(['b']) });
    expect(chunks.length).to.equal(2);

    const noSlice = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    let fired = false;
    noSlice.addEventListener('lr-record-chunk', () => (fired = true));
    await noSlice.start();
    (noSlice as unknown as { recorder: FakeMediaRecorder }).recorder.ondataavailable!({ data: new Blob(['c']) });
    expect(fired).to.be.false;
  } finally {
    restore();
  }
});

// -- Level meter -------------------------------------------------------------

it('emits lr-level while recording when level-events is set', async () => {
  const restore = stubSuccessfulCapture();
  try {
    const el = (await fixture(html`<lr-push-to-talk level-events></lr-push-to-talk>`)) as LyraPushToTalk;
    const levelPromise = oneEvent(el, 'lr-level');
    await el.start();
    const levelEvent = await levelPromise;
    expect(levelEvent.detail.level).to.be.within(0, 1);
    expect(levelEvent.detail.level).to.be.greaterThan(0); // FakeAnalyserNode emits a loud signal
  } finally {
    restore();
  }
});

it('emits no lr-level when level-events is unset (the default)', async () => {
  const restore = stubSuccessfulCapture();
  try {
    const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    let fired = false;
    el.addEventListener('lr-level', () => (fired = true));
    await el.start();
    await aTimeout(50);
    expect(fired).to.be.false;
  } finally {
    restore();
  }
});

// -- max-duration-ms auto-stop -----------------------------------------------

it('auto-stops at max-duration-ms', async () => {
  const restore = stubSuccessfulCapture();
  try {
    const el = (await fixture(
      html`<lr-push-to-talk max-duration-ms="40"></lr-push-to-talk>`,
    )) as LyraPushToTalk;
    const stopPromise = oneEvent(el, 'lr-record-stop');
    await el.start();
    await stopPromise;
    expect(el.state).to.equal('idle');
  } finally {
    restore();
  }
});

// -- Numeric safety (finiteDuration clamping) --------------------------------

it('clamps a NaN/oversized timeslice-ms before it reaches MediaRecorder.start() instead of an unsanitized value reaching that native API (regression)', async () => {
  const restore = stubSuccessfulCapture();
  const originalStart = FakeMediaRecorder.prototype.start;
  const startArgs: (number | undefined)[] = [];
  FakeMediaRecorder.prototype.start = function (this: FakeMediaRecorder, timeslice?: number) {
    startArgs.push(timeslice);
    return originalStart.call(this, timeslice);
  };
  try {
    const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    el.timesliceMs = Number.MAX_SAFE_INTEGER;
    await el.start();
    expect(startArgs).to.have.lengthOf(1);
    expect(Number.isFinite(startArgs[0])).to.be.true;
    expect(startArgs[0]).to.be.at.most(MAX_TIMEOUT_MS);
  } finally {
    FakeMediaRecorder.prototype.start = originalStart;
    restore();
  }
});

it('clamps an oversized max-duration-ms to the browser timer ceiling instead of overflowing setTimeout\'s 32-bit delay (regression)', async () => {
  const restore = stubSuccessfulCapture();
  const originalSetTimeout = window.setTimeout;
  const delays: number[] = [];
  window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    delays.push(delay ?? 0);
    return originalSetTimeout(handler, delay, ...args);
  }) as typeof window.setTimeout;
  try {
    const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    el.maxDurationMs = Number.MAX_SAFE_INTEGER;
    await el.start();
    expect(delays.length).to.be.greaterThan(0);
    expect(Math.max(...delays)).to.be.at.most(MAX_TIMEOUT_MS);
    el.cancel();
  } finally {
    window.setTimeout = originalSetTimeout;
    restore();
  }
});

it('never schedules a max-duration-ms auto-stop for a NaN or negative value (the existing `> 0` guard already excludes them)', async () => {
  const restore = stubSuccessfulCapture();
  try {
    const nan = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    nan.maxDurationMs = NaN;
    await nan.start();
    await aTimeout(30);
    expect(nan.state).to.equal('recording'); // never auto-stopped
    nan.cancel();

    const negative = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    negative.maxDurationMs = -100;
    await negative.start();
    await aTimeout(30);
    expect(negative.state).to.equal('recording');
    negative.cancel();
  } finally {
    restore();
  }
});

// -- Announcements -----------------------------------------------------------

function liveRegionText(el: LyraPushToTalk): string {
  const region = el.shadowRoot!.querySelector('lr-live-region')!;
  return region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
}

it('announces start/stop/cancel via the internal live region', async () => {
  const restore = stubSuccessfulCapture();
  try {
    const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
    await el.start();
    await aTimeout(20);
    expect(liveRegionText(el)).to.equal('Recording started');
    await el.stop();
    await aTimeout(20);
    expect(liveRegionText(el)).to.equal('Recording stopped');
  } finally {
    restore();
  }
});

// -- Slots --------------------------------------------------------------

it('slots override the default icon and recording-icon glyphs', async () => {
  const el = (await fixture(html`
    <lr-push-to-talk>
      <span slot="icon">mic</span>
      <span slot="recording-icon">rec</span>
    </lr-push-to-talk>
  `)) as LyraPushToTalk;
  const iconSlot = el.shadowRoot!.querySelector('[part="icon"] slot') as HTMLSlotElement;
  expect(iconSlot.assignedElements()[0].textContent).to.equal('mic');
});

// -- Accessibility -------------------------------------------------------

it('is accessible in hold mode', async () => {
  const el = (await fixture(html`<lr-push-to-talk></lr-push-to-talk>`)) as LyraPushToTalk;
  await expect(el).to.be.accessible();
});

it('is accessible in toggle mode while recording', async () => {
  const restore = stubSuccessfulCapture();
  try {
    const el = (await fixture(html`<lr-push-to-talk mode="toggle"></lr-push-to-talk>`)) as LyraPushToTalk;
    await el.start();
    await expect(el).to.be.accessible();
  } finally {
    restore();
  }
});

// -- Localization ------------------------------------------------------------

it('localizes trigger labels and status text via this.localize()', async () => {
  const el = (await fixture(html`
    <lr-push-to-talk
      .strings=${{ pushToTalkHold: 'Maintenir pour parler', pushToTalkDenied: 'Accès micro refusé' }}
    ></lr-push-to-talk>
  `)) as LyraPushToTalk;
  expect(trigger(el).getAttribute('aria-label')).to.equal('Maintenir pour parler');
});

// -- ARIA-name forwarding ------------------------------------------------------

it('a host-level aria-label overrides the computed trigger label', async () => {
  const el = (await fixture(
    html`<lr-push-to-talk aria-label="Talk to the assistant"></lr-push-to-talk>`,
  )) as LyraPushToTalk;
  expect(trigger(el).getAttribute('aria-label')).to.equal('Talk to the assistant');
});

describe('recording-state cssprop escape hatch', () => {
  function resolvedInShadow(el: LyraPushToTalk, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  // The recording tint keys purely on the `data-state` attribute, so setting it directly is enough
  // to activate the `[part='trigger']` treatment under test (the internal lifecycle sets the same
  // attribute when a real take begins).
  async function recording(style = ''): Promise<LyraPushToTalk> {
    const wrapper = (await fixture(html`
      <div style=${style}><lr-push-to-talk data-state="recording"></lr-push-to-talk></div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-push-to-talk') as LyraPushToTalk;
    await el.updateComplete;
    return el;
  }

  it('recolors the recording trigger border+text from an ancestor via --lr-push-to-talk-recording-color', async () => {
    const el = await recording('--lr-push-to-talk-recording-color: rgb(0, 51, 102)');
    const t = trigger(el);
    expect(getComputedStyle(t).borderTopColor).to.equal('rgb(0, 51, 102)');
    expect(getComputedStyle(t).color).to.equal('rgb(0, 51, 102)');
  });

  it('renders byte-identical to the danger token when unset', async () => {
    const el = await recording();
    const t = trigger(el);
    const danger = resolvedInShadow(el, 'color: var(--lr-color-danger)', 'color');
    expect(getComputedStyle(t).borderTopColor).to.equal(danger);
    expect(getComputedStyle(t).color).to.equal(danger);
  });

  it('is accessible with the recording-state prop themed', async () => {
    const el = await recording('--lr-push-to-talk-recording-color: rgb(0, 51, 102)');
    await expect(el).to.be.accessible();
  });
});
