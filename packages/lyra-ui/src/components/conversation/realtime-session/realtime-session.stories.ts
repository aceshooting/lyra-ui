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

