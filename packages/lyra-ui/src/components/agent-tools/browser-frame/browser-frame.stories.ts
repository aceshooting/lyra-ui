import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './browser-frame.js';
import type { BrowserPing } from './browser-frame.class.js';

const meta: Meta = {
  title: 'Browser Frame',
  component: 'lr-browser-frame',
};
export default meta;
type Story = StoryObj;

const pings: BrowserPing[] = [
  { id: 'p1', x: 30, y: 40, kind: 'click' },
  { id: 'p2', x: 60, y: 20, kind: 'type' },
];

export const Streaming: Story = {
  render: () => html`
    <lr-browser-frame
      style="max-width:36rem"
      url="https://example.com/dashboard"
      status="streaming"
      frame-src="https://placehold.co/800x450"
      .pings=${pings}
    ></lr-browser-frame>
  `,
};

export const Connecting: Story = {
  render: () => html`<lr-browser-frame style="max-width:36rem" status="connecting"></lr-browser-frame>`,
};

export const Stalled: Story = {
  render: () => html`
    <lr-browser-frame
      style="max-width:36rem"
      url="https://example.com/dashboard"
      status="stalled"
    ></lr-browser-frame>
  `,
};

export const UserControlled: Story = {
  render: () => html`
    <lr-browser-frame
      style="max-width:36rem"
      url="https://example.com"
      status="streaming"
      controller="user"
    ></lr-browser-frame>
  `,
};

export const NoControls: Story = {
  render: () => html`
    <lr-browser-frame
      style="max-width:36rem"
      url="https://example.com"
      status="streaming"
      .controls=${false}
    ></lr-browser-frame>
  `,
};

export const Narrow320: Story = {
  render: () => html`
    <div style="max-width:320px">
      <lr-browser-frame
        url="https://example.com/dashboard"
        status="streaming"
        frame-src="https://placehold.co/800x450"
        .pings=${pings}
      ></lr-browser-frame>
    </div>
  `,
};
