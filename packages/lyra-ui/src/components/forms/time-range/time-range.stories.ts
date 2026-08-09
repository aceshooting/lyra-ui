import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { TimeRangePreset, TimeRangeValueFormatter } from './time-range.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

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
  parameters: {
    docs: {
      description: {
        story:
          'Direct or fieldset disablement also aborts any keyboard or captured-pointer gesture already in flight. A later physical release cannot commit a stale change; form reset applies the same invalidation before restoring declared values.',
      },
    },
  },
  render: () =>
    html`<lr-time-range min="0" max="100" start="20" end="80" disabled></lr-time-range>`,
};

export const CoarseStep: Story = {
  render: () =>
    html`<lr-time-range min="0" max="100" start="20" end="80" step="10"></lr-time-range>`,
};

export const KeyboardBlurCommit: Story = {
  name: 'Keyboard blur commit',
  parameters: {
    docs: {
      description: {
        story:
          'Move a handle with Arrow/Home/End/PageUp/PageDown, then move focus before releasing the key. The pending keyboard gesture commits once on handle blur; the later keyup cannot emit a duplicate change.',
      },
    },
  },
  render: () => html`
    <lr-time-range min="0" max="100" start="20" end="80" step="5"></lr-time-range>
    <button type="button">Next focus target</button>
  `,
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

/** Preset and handle pointer states have independent hooks, with the original shared-token paint
 * retained as the fallback when a hook is unset. Hover or press each control to compare them. */
export const IndependentPointerStates: Story = {
  name: 'Independent pointer-state themes',
  parameters: {
    docs: {
      description: {
        story:
          'Preset hover/press and handle rest/hover/press paint can be themed independently without changing a library-wide brand token.',
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
      style="
        --lr-time-range-preset-hover-border-color: var(--lr-color-success);
        --lr-time-range-preset-pressed-border-color: var(--lr-color-warning);
        --lr-time-range-preset-pressed-bg: var(--lr-color-warning-quiet);
        --lr-time-range-handle-bg: var(--lr-color-brand);
        --lr-time-range-handle-border-color: var(--lr-color-surface-raised);
        --lr-time-range-handle-hover-bg: var(--lr-color-success);
        --lr-time-range-handle-pressed-bg: var(--lr-color-warning);
      "
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

/** 320px allocation covering endpoint handles and long wrapping preset labels. */
export const Narrow: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-time-range
        min="0"
        max="100"
        start="0"
        end="100"
        .presets=${[
          { label: 'Entire available reporting period', start: 0, end: 100 },
          { label: 'Most recent thirty business days', start: 70, end: 100 },
        ]}
      ></lr-time-range>
    </div>
  `,
};
