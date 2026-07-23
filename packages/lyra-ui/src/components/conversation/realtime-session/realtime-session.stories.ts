import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './realtime-session.js';

const meta: Meta = { title: 'Conversation/Realtime Session', component: 'lr-realtime-session' };
export default meta;
type Story = StoryObj;

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
