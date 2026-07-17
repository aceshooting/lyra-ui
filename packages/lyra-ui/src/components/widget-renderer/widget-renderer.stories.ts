import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './widget-renderer.js';
import type { WidgetNode } from './resolve.js';

const meta: Meta = {
  title: 'Widget Renderer',
  component: 'lyra-widget-renderer',
};
export default meta;
type Story = StoryObj;

const dashboard: WidgetNode = {
  type: 'col',
  props: { gap: 'm' },
  children: [
    {
      type: 'row',
      props: { gap: 'm' },
      children: [
        { type: 'stat', props: { label: 'Users', value: '1,204' } },
        { type: 'stat', props: { label: 'Errors', value: '3', variant: 'danger' } },
      ],
    },
    { type: 'button', props: { variant: 'brand' }, actionId: 'refresh', children: ['Refresh'] },
  ],
};

const unsafeTree: WidgetNode = {
  type: 'row',
  children: [
    { type: 'evil-widget', props: { onclick: 'alert(1)' } },
    { type: 'stat', props: { label: 'Still renders', value: 'safely' } },
  ],
};

export const Default: Story = {
  render: () =>
    html`<lyra-widget-renderer style="display:block;max-width:32rem" .tree=${dashboard}></lyra-widget-renderer>`,
};

export const SecurityAllowlistDemo: Story = {
  render: () =>
    html`<lyra-widget-renderer style="display:block;max-width:32rem" .tree=${unsafeTree}></lyra-widget-renderer>`,
};

export const Narrow320: Story = {
  render: () =>
    html`<div style="max-width:320px">
      <lyra-widget-renderer style="display:block" .tree=${dashboard}></lyra-widget-renderer>
    </div>`,
};
