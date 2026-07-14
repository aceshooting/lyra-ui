import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './segmented.js';

const meta: Meta = {
  title: 'Segmented',
  component: 'lyra-segmented',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A single-select button row with the WAI-ARIA APG `radiogroup` contract built in: `role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation (click or arrow-key move both select immediately, like a native radio group), cyclic Arrow/Home/End navigation among non-disabled items.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-segmented
      .items=${[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ]}
      value="week"
    ></lyra-segmented>
  `,
};

export const FourItems: Story = {
  name: 'Four items',
  render: () => html`
    <lyra-segmented
      .items=${[
        { value: 'list', label: 'List' },
        { value: 'board', label: 'Board' },
        { value: 'calendar', label: 'Calendar' },
        { value: 'timeline', label: 'Timeline' },
      ]}
      value="board"
    ></lyra-segmented>
  `,
};

export const WithDisabledItem: Story = {
  name: 'With a disabled item',
  render: () => html`
    <lyra-segmented
      .items=${[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week', disabled: true },
        { value: 'month', label: 'Month' },
      ]}
      value="day"
    ></lyra-segmented>
  `,
};

export const WithIcons: Story = {
  name: 'With leading icons',
  render: () => html`
    <lyra-segmented
      label="Layout"
      .items=${[
        { value: 'list', label: 'List', icon: html`<span aria-hidden="true">☰</span>` },
        { value: 'board', label: 'Board', icon: html`<span aria-hidden="true">▦</span>` },
        { value: 'calendar', label: 'Calendar', icon: html`<span aria-hidden="true">▣</span>` },
      ]}
      value="board"
    ></lyra-segmented>
  `,
};

export const AccessibleName: Story = {
  name: 'Accessible name (label prop)',
  parameters: {
    docs: {
      description: {
        story:
          'The `label` property sets `aria-label` on the `role="radiogroup"` root. It renders no visible text of its own -- use it when the control has no adjacent heading or wrapping `<label>` to derive an accessible name from.',
      },
    },
  },
  render: () => html`
    <lyra-segmented
      label="View"
      .items=${[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ]}
      value="week"
    ></lyra-segmented>
  `,
};

export const RightToLeft: Story = {
  name: 'Right-to-left',
  render: () => html`
    <lyra-segmented
      dir="rtl"
      .items=${[
        { value: 'day', label: 'يوم' },
        { value: 'week', label: 'أسبوع' },
        { value: 'month', label: 'شهر' },
      ]}
      value="week"
    ></lyra-segmented>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <lyra-segmented
        .items=${[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
        value="day"
        @lyra-change=${(e: CustomEvent<{ value: string }>) => {
          const out = document.getElementById('segmented-log');
          if (out) out.textContent = `lyra-change: ${JSON.stringify(e.detail)}`;
        }}
      ></lyra-segmented>
      <p id="segmented-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};
