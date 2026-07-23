import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './realtime-session.js';
import type { LyraRealtimeSession } from './realtime-session.js';

it('composes connection status, voice activity, transcript, and capture controls', async () => {
  const el = (await fixture(
    html`<lr-realtime-session
      state="connected"
      voice-state="speaking"
      level="0.7"
      .entries=${[{ id: '1', speaker: 'Assistant', text: 'Hello' }]}
    ></lr-realtime-session>`,
  )) as LyraRealtimeSession;
  expect(el.shadowRoot!.querySelector('lr-audio-visualizer')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-transcript-feed')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-push-to-talk')).to.exist;
  expect(el.shadowRoot!.textContent).to.contain('Connected');
});

it('emits controlled connect, disconnect, mute, and interrupt intents', async () => {
  const disconnected = (await fixture(html`<lr-realtime-session></lr-realtime-session>`)) as LyraRealtimeSession;
  const connectPending = oneEvent(disconnected, 'lr-connect');
  (disconnected.shadowRoot!.querySelector('[part="connect"]') as HTMLButtonElement).click();
  await connectPending;

  const connected = (await fixture(html`<lr-realtime-session state="connected"></lr-realtime-session>`)) as LyraRealtimeSession;
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

it('localizes errors instead of exposing a caught error object and remains accessible', async () => {
  const el = (await fixture(
    html`<lr-realtime-session state="error" error-code="network"></lr-realtime-session>`,
  )) as LyraRealtimeSession;
  expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('The realtime connection failed.');
  await expect(el).shadowDom.to.be.accessible();
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-realtime-session
    .strings=${{ realtimeSessionLabel: 'Localized voice session' }}
  ></lr-realtime-session>`)) as LyraRealtimeSession;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized voice session');
});
