import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './realtime-session.js';
import type { LyraRealtimeSession, LyraRealtimeSessionEventMap } from './realtime-session.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

function sinkTexts(politeness: 'polite' | 'assertive', doc: Document = document): string[] {
  return Array.from(
    doc.querySelectorAll<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"] > div`),
    (node) => node.textContent ?? ''
  );
}

it('composes connection status, voice activity, transcript, and capture controls', async () => {
  const el = (await fixture(
    html`<lr-realtime-session
      state="connected"
      voice-state="speaking"
      level="0.7"
      .entries=${[{ id: '1', speaker: 'Assistant', text: 'Hello' }]}
    ></lr-realtime-session>`
  )) as LyraRealtimeSession;
  expect(el.shadowRoot!.querySelector('lr-audio-visualizer')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-transcript-feed')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-push-to-talk')).to.exist;
  expect(el.shadowRoot!.textContent).to.contain('Connected');
});

it('types and preserves every composed push-to-talk event unchanged', async () => {
  const eventNames = [
    'lr-record-start',
    'lr-record-chunk',
    'lr-record-stop',
    'lr-record-cancel',
    'lr-record-error',
    'lr-level',
    'lr-state-change',
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
    html`<lr-realtime-session state="connected"></lr-realtime-session>`,
  )) as LyraRealtimeSession;
  const capture = el.shadowRoot!.querySelector('lr-push-to-talk')!;

  for (const [index, eventName] of eventNames.entries()) {
    const pending = oneEvent(el, eventName);
    capture.dispatchEvent(
      new CustomEvent(eventName, {
        bubbles: true,
        composed: true,
        detail: details[index],
      }),
    );
    const received = await pending;
    expect(received.target?.localName).to.equal('lr-realtime-session');
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

it('keeps errorCode informational while rendering a localized generic error', async () => {
  const el = (await fixture(
    html`<lr-realtime-session state="error" error-code="network"></lr-realtime-session>`
  )) as LyraRealtimeSession;
  expect(el.errorCode).to.equal('network');
  expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('The realtime connection failed.');

  el.errorCode = 'provider-authentication-expired';
  await el.updateComplete;
  expect(el.errorCode).to.equal('provider-authentication-expired');
  expect(el.state).to.equal('error');
  expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('The realtime connection failed.');
  await expect(el).shadowDom.to.be.accessible();
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-realtime-session
    .strings=${{ realtimeSessionLabel: 'Localized voice session' }}
  ></lr-realtime-session>`)) as LyraRealtimeSession;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized voice session');
});

it('announces connection transitions after mount without announcing the initial state', async () => {
  const el = (await fixture(html`
    <lr-realtime-session .strings=${{ realtimeSessionConnected: 'SESSION READY' }}></lr-realtime-session>
  `)) as LyraRealtimeSession;
  expect(sinkTexts('polite')).to.deep.equal([]);
  expect(el.shadowRoot!.querySelectorAll('lr-live-region').length).to.equal(0);

  el.state = 'connected';
  await el.updateComplete;
  expect(sinkTexts('polite')).to.deep.equal(['SESSION READY']);
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

it('moves focus from the capture control when showCapture removes it without a state change', async () => {
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

  el.showCapture = false;
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('disconnect');
});

it('does not move a surviving session action when showCapture changes', async () => {
  const el = (await fixture(
    html`<lr-realtime-session state="connected"></lr-realtime-session>`
  )) as LyraRealtimeSession;
  (el.shadowRoot!.querySelector('[part="mute"]') as HTMLButtonElement).focus();

  el.showCapture = false;
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('mute');
});

it('preserves action focus from a genuinely foreign descendant after adoption', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;
  const el = (await fixture(
    html`<lr-realtime-session state="connected" .showCapture=${false}></lr-realtime-session>`
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
