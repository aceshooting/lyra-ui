import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
import type { LyraPushToTalk } from '../push-to-talk/push-to-talk.js';
import './realtime-session.js';
import type { LyraRealtimeSession, LyraRealtimeSessionEventMap } from './realtime-session.js';

it('composes connection status, voice activity, transcript, and capture controls', async () => {
  const el = (await fixture(
    html`<lr-realtime-session
      state="connected"
      voice-state="speaking"
      level="0.7"
      session-id="voice-session-a"
      .entries=${[{ id: '1', speaker: 'Assistant', text: 'Hello' }]}
    ></lr-realtime-session>`
  )) as LyraRealtimeSession;
  expect(el.shadowRoot!.querySelector('lr-audio-visualizer')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-transcript-feed')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-push-to-talk')).to.exist;
  expect((el.shadowRoot!.querySelector('lr-transcript-feed') as HTMLElement & { sessionId: string }).sessionId).to.equal(
    'voice-session-a'
  );
  expect(el.shadowRoot!.textContent).to.contain('Connected');
  await expect(el).to.be.accessible();
});

it('audits clean against axe as the real, composed custom element -- not just its serialized shadow tree -- in both the default and connected states', async () => {
  const disconnected = (await fixture(html`<lr-realtime-session></lr-realtime-session>`)) as LyraRealtimeSession;
  await expect(disconnected).to.be.accessible();

  const connected = (await fixture(
    html`<lr-realtime-session
      state="connected"
      voice-state="speaking"
      level="0.7"
      .entries=${[{ id: '1', speaker: 'Assistant', text: 'Hello' }]}
    ></lr-realtime-session>`
  )) as LyraRealtimeSession;
  await expect(connected).to.be.accessible();
});

it('types and preserves every composed push-to-talk event unchanged', async () => {
  const eventNames = [
    'lr-record-start',
    'lr-record-chunk',
    'lr-record-stop',
    'lr-record-cancel',
    'lr-record-error',
    'lr-level',
    'lr-record-state-change',
  ] as const satisfies readonly (keyof LyraRealtimeSessionEventMap)[];
  const details: readonly unknown[] = [
    { stream: 'stream-sentinel' },
    { blob: 'chunk-sentinel' },
    { blob: 'recording-sentinel', durationMs: 42 },
    null,
    { error: 'error-sentinel' },
    { level: 0.4 },
    { state: 'recording' },
  ];
  const el = (await fixture(
    html`<lr-realtime-session state="connected"></lr-realtime-session>`
  )) as LyraRealtimeSession;
  const capture = el.shadowRoot!.querySelector('lr-push-to-talk')!;

  for (const [index, eventName] of eventNames.entries()) {
    const pending = oneEvent(el, eventName);
    capture.dispatchEvent(
      new CustomEvent(eventName, {
        bubbles: true,
        composed: true,
        detail: details[index],
      })
    );
    const received = await pending;
    expect(received.target instanceof Element ? received.target.localName : null).to.equal(
      'lr-realtime-session'
    );
    expect(received.bubbles).to.equal(true);
    expect(received.composed).to.equal(true);
    expect(received.detail).to.deep.equal(details[index]);
  }
});

it('emits controlled connect, disconnect, mute, and interrupt intents', async () => {
  const disconnected = (await fixture(html`<lr-realtime-session></lr-realtime-session>`)) as LyraRealtimeSession;
  const connectPending = oneEvent(disconnected, 'lr-connect');
  (disconnected.shadowRoot!.querySelector('[part="connect"]') as HTMLButtonElement).click();
  await connectPending;

  const connected = (await fixture(
    html`<lr-realtime-session state="connected"></lr-realtime-session>`
  )) as LyraRealtimeSession;
  const mutePending = oneEvent(connected, 'lr-mute-change');
  (connected.shadowRoot!.querySelector('[part="mute"]') as HTMLButtonElement).click();
  expect((await mutePending).detail).to.deep.equal({ muted: true });

  const interruptPending = oneEvent(connected, 'lr-interrupt');
  (connected.shadowRoot!.querySelector('[part="interrupt"]') as HTMLButtonElement).click();
  await interruptPending;

  const disconnectPending = oneEvent(connected, 'lr-disconnect');
  (connected.shadowRoot!.querySelector('[part="disconnect"]') as HTMLButtonElement).click();
  await disconnectPending;
});

it('renders a localized generic error without an inert provider-code surface', async () => {
  const el = (await fixture(html`<lr-realtime-session state="error"></lr-realtime-session>`)) as LyraRealtimeSession;
  expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent?.trim()).to.equal(
    'The realtime connection failed.'
  );
  expect(el.state).to.equal('error');
  expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent?.trim()).to.equal(
    'The realtime connection failed.'
  );
  await expect(el).shadowDom.to.be.accessible();
});

it('normalizes invalid connection and voice states from attributes and direct property writes', async () => {
  const el = (await fixture(html`
    <lr-realtime-session state="invalid" voice-state="invalid"></lr-realtime-session>
  `)) as LyraRealtimeSession;
  expect(el.state).to.equal('disconnected');
  expect(el.getAttribute('state')).to.equal('disconnected');
  expect(el.voiceState).to.equal('idle');

  el.state = 'connected';
  el.voiceState = 'speaking';
  await el.updateComplete;
  (el as unknown as { state: string; voiceState: string }).state = 'also-invalid';
  (el as unknown as { state: string; voiceState: string }).voiceState = 'also-invalid';
  await el.updateComplete;
  expect(el.state).to.equal('disconnected');
  expect(el.getAttribute('state')).to.equal('disconnected');
  expect(el.voiceState).to.equal('idle');
});

it('preserves an explicitly empty host aria-label instead of replacing it with fallback prose', async () => {
  const el = (await fixture(html`<lr-realtime-session aria-label=""></lr-realtime-session>`)) as LyraRealtimeSession;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');
});

it('uses the localized default label when label is omitted', async () => {
  const el = (await fixture(html`<lr-realtime-session></lr-realtime-session>`)) as LyraRealtimeSession;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Realtime session',
  );
});

it('reads back an omitted label as undefined, not the empty string', async () => {
  const el = (await fixture(html`<lr-realtime-session></lr-realtime-session>`)) as LyraRealtimeSession;
  expect(el.label).to.equal(undefined);
});

it('suppresses the localized default label when label is explicitly empty', async () => {
  const el = (await fixture(
    html`<lr-realtime-session label=""></lr-realtime-session>`,
  )) as LyraRealtimeSession;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');
});

it('contains undocumented native input/change events from auxiliary children', async () => {
  const el = (await fixture(
    html`<lr-realtime-session state="connected"></lr-realtime-session>`
  )) as LyraRealtimeSession;
  const capture = el.shadowRoot!.querySelector('lr-push-to-talk')!;
  let inputs = 0;
  let changes = 0;
  el.addEventListener('input', () => inputs++);
  el.addEventListener('change', () => changes++);

  capture.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  capture.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

  expect(inputs).to.equal(0);
  expect(changes).to.equal(0);
});

it('contains the composed transcript follow event outside its public event surface', async () => {
  const el = (await fixture(
    html`<lr-realtime-session state="connected"></lr-realtime-session>`,
  )) as LyraRealtimeSession;
  const transcript = el.shadowRoot!.querySelector('lr-transcript-feed')!;
  let followChanges = 0;
  el.addEventListener('lr-follow-change', () => followChanges++);

  transcript.dispatchEvent(new CustomEvent('lr-follow-change', {
    bubbles: true,
    composed: true,
    detail: { following: false },
  }));

  expect(followChanges).to.equal(0);
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-realtime-session
    .strings=${{ realtimeSessionLabel: 'Localized voice session' }}
  ></lr-realtime-session>`)) as LyraRealtimeSession;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized voice session');
});

it('announces connection transitions after mount without announcing the initial state', async () => {
  const el = (await fixture(html`
    <lr-realtime-session .strings=${{
      realtimeSessionConnected: 'SESSION READY',
      realtimeSessionReconnecting: 'SESSION RETRYING',
    }}></lr-realtime-session>
  `)) as LyraRealtimeSession;
  expect(sinkTexts('polite')).to.deep.equal([]);
  expect(el.shadowRoot!.querySelectorAll('lr-live-region').length).to.equal(0);

  el.state = 'connected';
  await el.updateComplete;
  expect(sinkTexts('polite')).to.deep.equal(['SESSION READY']);

  el.state = 'reconnecting';
  await el.updateComplete;
  expect(sinkTexts('polite')).to.deep.equal(['SESSION READY', 'SESSION RETRYING']);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('true');
});

it('keeps repeated sink synchronization idempotent in the same owner document', async () => {
  const el = (await fixture(html`<lr-realtime-session></lr-realtime-session>`)) as LyraRealtimeSession;
  const internals = el as unknown as {
    statusAnnouncementSink: unknown;
    errorAnnouncementSink: unknown;
    syncAnnouncementSinks(): void;
  };
  const status = internals.statusAnnouncementSink;
  const error = internals.errorAnnouncementSink;

  internals.syncAnnouncementSinks();
  expect(internals.statusAnnouncementSink === status).to.equal(true);
  expect(internals.errorAnnouncementSink === error).to.equal(true);
});

it('moves focus to the replacement connection action when state changes', async () => {
  const el = (await fixture(html`<lr-realtime-session></lr-realtime-session>`)) as LyraRealtimeSession;
  (el.shadowRoot!.querySelector('[part="connect"]') as HTMLButtonElement).focus();
  el.state = 'connecting';
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('disconnect');
});

it('moves focus from a disappearing connected-session action to the error-state connect action', async () => {
  const el = (await fixture(
    html`<lr-realtime-session state="connected"></lr-realtime-session>`
  )) as LyraRealtimeSession;
  (el.shadowRoot!.querySelector('[part="mute"]') as HTMLButtonElement).focus();

  el.state = 'error';
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('connect');
});

it('moves focus from a nested capture control when the connected controls are replaced', async () => {
  const el = (await fixture(
    html`<lr-realtime-session state="connected"></lr-realtime-session>`
  )) as LyraRealtimeSession;
  const capture = el.shadowRoot!.querySelector('lr-push-to-talk') as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await capture.updateComplete;
  const trigger = capture.shadowRoot!.querySelector('button') as HTMLButtonElement;
  // This test owns only the parent's nested-focus restoration contract. WebKit's test context has
  // no MediaRecorder, so the child correctly starts unsupported/disabled; make the native target
  // focusable without pretending that microphone capture itself is available.
  trigger.disabled = false;
  trigger.focus();
  expect(capture.shadowRoot!.activeElement === trigger).to.be.true;

  el.state = 'error';
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('connect');
});

it('moves focus from the capture control when withoutCapture removes it without a state change', async () => {
  const el = (await fixture(
    html`<lr-realtime-session state="connected"></lr-realtime-session>`
  )) as LyraRealtimeSession;
  const capture = el.shadowRoot!.querySelector('lr-push-to-talk') as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await capture.updateComplete;
  const trigger = capture.shadowRoot!.querySelector('button') as HTMLButtonElement;
  trigger.disabled = false;
  trigger.focus();

  el.withoutCapture = true;
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('disconnect');
});

it('moves focus from capture to the visible Unmute action when muting disables capture', async () => {
  const el = (await fixture(
    html`<lr-realtime-session state="connected"></lr-realtime-session>`
  )) as LyraRealtimeSession;
  const capture = el.shadowRoot!.querySelector('lr-push-to-talk') as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await capture.updateComplete;
  const trigger = capture.shadowRoot!.querySelector('button') as HTMLButtonElement;
  trigger.disabled = false;
  trigger.focus();

  el.muted = true;
  await el.updateComplete;

  const focused = el.shadowRoot!.activeElement as HTMLButtonElement | null;
  expect(focused?.getAttribute('part')).to.equal('mute');
  expect(focused?.textContent?.trim()).to.equal('Unmute microphone');
});

it('does not move foreign focus when mute state changes', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="outside">Outside</button>
      <lr-realtime-session state="connected"></lr-realtime-session>
    </div>
  `);
  const el = wrapper.querySelector('lr-realtime-session') as LyraRealtimeSession;
  wrapper.querySelector<HTMLElement>('#outside')!.focus();

  el.muted = true;
  await el.updateComplete;

  expect(el.ownerDocument.activeElement?.id).to.equal('outside');
});

it('does not move a surviving session action when withoutCapture changes', async () => {
  const el = (await fixture(
    html`<lr-realtime-session state="connected"></lr-realtime-session>`
  )) as LyraRealtimeSession;
  (el.shadowRoot!.querySelector('[part="mute"]') as HTMLButtonElement).focus();

  el.withoutCapture = true;
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('mute');
});

it('preserves action focus from a genuinely foreign descendant after adoption', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;
  const el = (await fixture(
    html`<lr-realtime-session state="connected" without-capture></lr-realtime-session>`
  )) as LyraRealtimeSession;

  try {
    el.remove();
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    const controls = el.shadowRoot!.querySelector<HTMLElement>('[part="controls"]')!;
    const foreignAction = frameDocument.createElement('button');
    controls.append(foreignAction);
    foreignAction.focus();
    expect(foreignAction instanceof HTMLElement, 'the active action is not ambient-branded').to.be.false;
    expect(el.shadowRoot!.activeElement === foreignAction).to.be.true;

    el.state = 'error';
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('connect');
  } finally {
    el.remove();
    iframe.remove();
  }
});

it('preserves action focus without consulting the ambient ShadowRoot constructor', async () => {
  const el = (await fixture(html`<lr-realtime-session></lr-realtime-session>`)) as LyraRealtimeSession;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'ShadowRoot')!;
  const AmbientShadowRoot = class {};

  try {
    Object.defineProperty(globalThis, 'ShadowRoot', {
      configurable: true,
      writable: true,
      value: AmbientShadowRoot,
    });
    (el.shadowRoot!.querySelector('[part="connect"]') as HTMLButtonElement).focus();
    el.state = 'connecting';
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('disconnect');
  } finally {
    Object.defineProperty(globalThis, 'ShadowRoot', descriptor);
  }
});

it('uses only the assertive error owner when transitioning to error', async () => {
  const el = (await fixture(
    html`<lr-realtime-session state="connected"></lr-realtime-session>`
  )) as LyraRealtimeSession;

  el.state = 'error';
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="error"]')!.getAttribute('role')).to.equal(null);
  expect(sinkTexts('polite')).to.deep.equal([]);
  expect(sinkTexts('assertive')).to.deep.equal(['The realtime connection failed.']);
});

it('re-targets both connection announcement sinks when adopted into another document', async () => {
  const el = (await fixture(html`<lr-realtime-session></lr-realtime-session>`)) as LyraRealtimeSession;
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;

  try {
    frameDocument.body.append(el);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    el.state = 'error';
    await el.updateComplete;

    expect(sinkTexts('assertive'), 'the old document receives no adopted announcements').to.deep.equal([]);
    expect(sinkTexts('assertive', frameDocument)).to.deep.equal(['The realtime connection failed.']);
  } finally {
    el.remove();
    iframe.remove();
  }
});

it('treats a state write queued while detached as a silent reconnect baseline', async () => {
  const el = (await fixture(
    html`<lr-realtime-session state="connected"></lr-realtime-session>`
  )) as LyraRealtimeSession;
  const parent = el.parentNode!;

  el.remove();
  el.state = 'error';
  parent.appendChild(el);
  await el.updateComplete;
  expect(sinkTexts('assertive'), 'the detached error state is resting content on reconnect').to.deep.equal([]);
  expect(sinkTexts('polite')).to.deep.equal([]);

  el.state = 'connected';
  await el.updateComplete;
  expect(sinkTexts('polite'), 'the next connected transition still announces').to.deep.equal(['Connected']);
});

it('uses break-word, not anywhere, on the status text', async () => {
  const el = (await fixture(html`<lr-realtime-session state="connected"></lr-realtime-session>`)) as LyraRealtimeSession;
  await el.updateComplete;
  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;
  expect(getComputedStyle(status).overflowWrap).to.equal('break-word');
});

it('cancels a take in progress when withoutCapture hides the capture', async () => {
  const media = navigator.mediaDevices.getUserMedia;
  const Recorder = window.MediaRecorder;
  const Context = window.AudioContext;
  navigator.mediaDevices.getUserMedia = (async () => ({ getTracks: () => [{ stop() {} }] })) as unknown as typeof media;
  window.MediaRecorder = class {
    static isTypeSupported(): boolean { return false; }
    state = 'inactive';
    mimeType = '';
    onstop: (() => void) | null = null;
    start(): void { this.state = 'recording'; }
    stop(): void { this.state = 'inactive'; this.onstop?.(); }
  } as unknown as typeof MediaRecorder;
  window.AudioContext = class {
    state = 'running';
    createMediaStreamSource() { return { connect() {} }; }
    createAnalyser() { return { fftSize: 0, frequencyBinCount: 1, getByteTimeDomainData() {} }; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  } as unknown as typeof AudioContext;
  try {
    const el = await fixture<LyraRealtimeSession>(html`<lr-realtime-session state="connected"></lr-realtime-session>`);
    const capture = el.shadowRoot!.querySelector('lr-push-to-talk') as LyraPushToTalk;
    await capture.updateComplete;
    expect(await capture.start()).to.be.true;
    let cancelled = false;
    el.addEventListener('lr-record-cancel', () => (cancelled = true));
    el.withoutCapture = true;
    await waitUntil(() => cancelled, 'the session host never heard the take end');
    expect(capture.state).to.equal('idle');
  } finally {
    navigator.mediaDevices.getUserMedia = media;
    window.MediaRecorder = Recorder;
    window.AudioContext = Context;
  }
});

it('names the mute toggle by its action without aria-pressed', async () => {
  const el = await fixture<LyraRealtimeSession>(html`<lr-realtime-session state="connected" muted></lr-realtime-session>`);
  const mute = el.shadowRoot!.querySelector('[part="mute"]')!;
  expect(mute.hasAttribute('aria-pressed')).to.be.false;
  expect(mute.textContent?.trim()).to.equal('Unmute microphone');
});

it('keeps the newest transcript entries past the collection limit', () => {
  expectDevWarning(collectionTruncationWarningKey('lr-realtime-session', 'entries'));
  const el = document.createElement('lr-realtime-session') as LyraRealtimeSession;
  el.entries = Array.from({ length: 10_005 }, (_, i) => ({ id: String(i), text: `line ${i}` }));
  expect(el.entries.at(-1)?.id).to.equal('10004');
});
