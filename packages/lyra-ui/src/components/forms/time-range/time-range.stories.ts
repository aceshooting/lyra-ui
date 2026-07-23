import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { TimeRangePreset, TimeRangeValueFormatter } from './time-range.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const presets: TimeRangePreset[] = [
  { label: 'Last 7 days', start: 0, end: 7 },
  { label: 'Last 30 days', start: 0, end: 30 },
  { label: 'Last 90 days', start: 0, end: 90 },
];

const monthLabels = ['April 2023', 'May 2023', 'June 2023'];
const formatMonth: TimeRangeValueFormatter = (value, handle) => {
  const month = monthLabels[value];
  return month ? `${handle === 'start' ? 'From' : 'Through'} ${month}` : undefined;
};

const meta: Meta = {
  title: 'TimeRange',
  component: 'lr-time-range',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
};

export const Disabled: Story = {
  render: () =>
    html`<lr-time-range min="0" max="100" start="20" end="80" disabled></lr-time-range>`,
};

export const CoarseStep: Story = {
  render: () =>
    html`<lr-time-range min="0" max="100" start="20" end="80" step="10"></lr-time-range>`,
};

export const HumanReadableValueText: Story = {
  name: 'Human-readable value text',
  parameters: {
    docs: {
      description: {
        story:
          'A property-only `valueFormatter(value, handle)` maps the numeric domain to each slider handle’s `aria-valuetext` without changing `aria-valuenow` or adding date logic to the component.',
      },
    },
  },
  render: () => html`
    <lr-time-range
      min="0"
      max="2"
      start="0"
      end="2"
      .valueFormatter=${formatMonth}
    ></lr-time-range>
  `,
};

export const DiscretePresets: Story = {
  render: () => html`
    <lr-time-range min="0" max="90" start="0" end="30" .presets=${presets}></lr-time-range>
  `,
};

/** The active preset button's background, border and text color are themeable through
 *  `--lr-time-range-preset-active-bg`, `--lr-time-range-preset-active-border-color` and
 *  `--lr-time-range-preset-active-color`. None is declared on `:host`, so setting them on an
 *  ancestor recolors only the active preset — not everything else reading the brand tokens. */
export const ThemedActivePreset: Story = {
  name: 'Themed active preset (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `--lr-time-range-preset-active-bg`, `--lr-time-range-preset-active-border-color` and `--lr-time-range-preset-active-color` on the element or any ancestor to recolor the active preset without hijacking the library-wide brand tokens.',
      },
    },
  },
  render: () => html`
    <lr-time-range
      min="0"
      max="90"
      start="0"
      end="30"
      .presets=${presets}
      style="--lr-time-range-preset-active-bg: ${storyColor(
        'success',
      )}; --lr-time-range-preset-active-border-color: ${storyColor(
        'success',
      )}; --lr-time-range-preset-active-color: ${storyColor('onBrand')};"
    ></lr-time-range>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 2rem;">
      <div>
        <label style="display: block; margin-block-end: 0.5rem;">2xs</label>
        <lr-time-range min="0" max="100" start="20" end="80" size="2xs"></lr-time-range>
      </div>
      <div>
        <label style="display: block; margin-block-end: 0.5rem;">xs</label>
        <lr-time-range min="0" max="100" start="20" end="80" size="xs"></lr-time-range>
      </div>
      <div>
        <label style="display: block; margin-block-end: 0.5rem;">s</label>
        <lr-time-range min="0" max="100" start="20" end="80" size="s"></lr-time-range>
      </div>
      <div>
        <label style="display: block; margin-block-end: 0.5rem;">m (default)</label>
        <lr-time-range min="0" max="100" start="20" end="80" size="m"></lr-time-range>
      </div>
      <div>
        <label style="display: block; margin-block-end: 0.5rem;">l</label>
        <lr-time-range min="0" max="100" start="20" end="80" size="l"></lr-time-range>
      </div>
      <div>
        <label style="display: block; margin-block-end: 0.5rem;">xl</label>
        <lr-time-range min="0" max="100" start="20" end="80" size="xl"></lr-time-range>
      </div>
    </div>
  `,
};
