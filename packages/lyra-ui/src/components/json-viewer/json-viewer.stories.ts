import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './json-viewer.js';

const sample = {
  id: 'call_9f2e1',
  name: 'get_weather',
  arguments: {
    location: 'Brussels, BE',
    unit: 'celsius',
    days: 3,
    includeAlerts: true,
    tags: ['storm-watch', 'coastal'],
  },
  result: {
    forecast: [
      { day: 'Mon', high: 19, low: 12, conditions: 'Cloudy' },
      { day: 'Tue', high: 21, low: 13, conditions: 'Sunny' },
      { day: 'Wed', high: 17, low: 10, conditions: 'Rain' },
    ],
    warning: null,
    source: undefined,
  },
};

const meta: Meta = {
  title: 'JsonViewer',
  component: 'lyra-json-viewer',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A collapsible, copyable tree view for an arbitrary JSON-serializable value. The fallback renderer for anywhere a raw payload (tool call arguments, a tool result, an API response) needs inspecting without a bespoke view.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-json-viewer .data=${sample} style="max-width: 32rem;"></lyra-json-viewer>`,
};

export const CollapsedDepth: Story = {
  render: () => html`
    <lyra-json-viewer .data=${sample} collapsed-depth="1" style="max-width: 32rem;"></lyra-json-viewer>
  `,
};

export const CollapsedImmediately: Story = {
  name: 'collapsed-depth="0" (top-level starts collapsed)',
  render: () => html`
    <lyra-json-viewer .data=${sample} collapsed-depth="0" style="max-width: 32rem;"></lyra-json-viewer>
  `,
};

export const Copyable: Story = {
  render: () => html`
    <lyra-json-viewer
      .data=${sample}
      copyable
      style="max-width: 32rem;"
      @lyra-copy=${(e: CustomEvent<{ text: string }>) => console.log('lyra-copy', e.detail.text)}
    ></lyra-json-viewer>
  `,
};

export const Search: Story = {
  render: () => html`
    <lyra-json-viewer .data=${sample} search="storm" collapsed-depth="1" style="max-width: 32rem;"></lyra-json-viewer>
  `,
};

export const MaxHeightScrolling: Story = {
  render: () => html`
    <lyra-json-viewer .data=${sample} max-height="10rem" style="max-width: 32rem;"></lyra-json-viewer>
  `,
};

export const PrimitiveRoot: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 32rem;">
      <lyra-json-viewer .data=${'a bare string value'}></lyra-json-viewer>
      <lyra-json-viewer .data=${42}></lyra-json-viewer>
      <lyra-json-viewer .data=${null}></lyra-json-viewer>
      <lyra-json-viewer .data=${undefined}></lyra-json-viewer>
    </div>
  `,
};

export const EmptyContainers: Story = {
  render: () => html`
    <lyra-json-viewer .data=${{ emptyObject: {}, emptyArray: [] }} style="max-width: 32rem;"></lyra-json-viewer>
  `,
};
