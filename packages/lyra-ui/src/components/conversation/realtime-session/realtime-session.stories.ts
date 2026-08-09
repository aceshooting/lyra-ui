import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './realtime-session.js';
import type { LyraRealtimeSession } from './realtime-session.js';

const meta: Meta = { title: 'Conversation/Realtime Session', component: 'lr-realtime-session' };
export default meta;
type Story = StoryObj;

/** The composed capture keeps its seven `lr-record-*`/`lr-level`/`lr-state-change` events intact;
 * use Storybook's Actions panel while operating the push-to-talk control to inspect them. */
export const Connected: Story = {
  render: () => html`<lr-realtime-session
    state="connected"
    voice-state="speaking"
    level="0.65"
    .entries=${[
      { id: '1', speaker: 'You', text: 'Summarize the evidence.' },
      { id: '2', speaker: 'Assistant', text: 'The sources agree on three findings.' },
    ]}
  ></lr-realtime-session>`,
};

/**
 * `errorCode` remains host-readable provider metadata. The shell deliberately renders one
 * localized generic failure instead of exposing provider-specific codes as user-facing text.
 */
export const ErrorMetadata: Story = {
  render: () => html`
    <lr-realtime-session state="error" error-code="provider-authentication-expired"></lr-realtime-session>
  `,
};

/** Tab to the capture control and press V. The host hides capture from the composed key event, and
 * focus moves to Disconnect rather than falling out of the session. */
export const CaptureVisibilityFocus: Story = {
  render: () => html`
    <lr-realtime-session
      state="connected"
      @keydown=${(event: KeyboardEvent) => {
        if (event.key.toLocaleLowerCase() !== 'v') return;
        (event.currentTarget as LyraRealtimeSession).showCapture = false;
      }}
    ></lr-realtime-session>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px), long connected state',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-realtime-session
        state="connected"
        voice-state="speaking"
        level="0.65"
        label="A very long localized realtime assistant session label that must wrap"
        .entries=${[
          {
            id: '1',
            speaker: 'A very long participant name that cannot fit on one line',
            text: 'An uninterrupted transcript payload abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
          },
          {
            id: '2',
            speaker: 'Assistant',
            text: 'The connected state keeps every action and status reachable in a narrow allocated panel.',
          },
        ]}
      ></lr-realtime-session>
    </div>
  `,
};
