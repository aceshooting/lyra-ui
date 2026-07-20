import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './segmented.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'Segmented',
  component: 'lr-segmented',
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
    <lr-segmented
      .items=${[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ]}
      value="week"
    ></lr-segmented>
  `,
};

export const FourItems: Story = {
  name: 'Four items',
  render: () => html`
    <lr-segmented
      .items=${[
        { value: 'list', label: 'List' },
        { value: 'board', label: 'Board' },
        { value: 'calendar', label: 'Calendar' },
        { value: 'timeline', label: 'Timeline' },
      ]}
      value="board"
    ></lr-segmented>
  `,
};

export const WithDisabledItem: Story = {
  name: 'With a disabled item',
  render: () => html`
    <lr-segmented
      .items=${[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week', disabled: true },
        { value: 'month', label: 'Month' },
      ]}
      value="day"
    ></lr-segmented>
  `,
};

export const WithIcons: Story = {
  name: 'With leading icons',
  render: () => html`
    <lr-segmented
      label="Layout"
      .items=${[
        { value: 'list', label: 'List', icon: html`<span aria-hidden="true">☰</span>` },
        { value: 'board', label: 'Board', icon: html`<span aria-hidden="true">▦</span>` },
        { value: 'calendar', label: 'Calendar', icon: html`<span aria-hidden="true">▣</span>` },
      ]}
      value="board"
    ></lr-segmented>
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
    <lr-segmented
      label="View"
      .items=${[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ]}
      value="week"
    ></lr-segmented>
  `,
};

/** Narrow-allocation evidence: a five-item row (and long, translated-style labels) reflowing
 *  inside a 320px panel/dialog/split-pane rather than overflowing it. */
export const NarrowLongContent: Story = {
  name: 'Narrow (320px) with scrollable long content',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-segmented
        label="Filter"
        .items=${[
          { value: 'all', label: 'Alle Elemente' },
          { value: 'active', label: 'Aktive Elemente' },
          { value: 'pending', label: 'Ausstehende Elemente' },
          { value: 'archived', label: 'Archivierte Elemente' },
          { value: 'deleted', label: 'Gelöschte Elemente' },
        ]}
        value="active"
      ></lr-segmented>
    </div>
  `,
};

export const ScrollableOverflow: Story = {
  name: 'Scrollable overflow with edge fades',
  render: () => html`
    <div style="inline-size: 375px; max-inline-size: 100%;">
      <lr-segmented
        label="Filters"
        .items=${[
          { value: 'all', label: 'All conversations' },
          { value: 'active', label: 'Active conversations' },
          { value: 'waiting', label: 'Waiting for review' },
          { value: 'archived', label: 'Archived conversations' },
          { value: 'assigned', label: 'Assigned to me' },
          { value: 'mentions', label: 'Mentions and replies' },
        ]}
        value="active"
      ></lr-segmented>
    </div>
  `,
};

export const RightToLeft: Story = {
  name: 'Right-to-left',
  render: () => html`
    <lr-segmented
      dir="rtl"
      .items=${[
        { value: 'day', label: 'يوم' },
        { value: 'week', label: 'أسبوع' },
        { value: 'month', label: 'شهر' },
      ]}
      value="week"
    ></lr-segmented>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <lr-segmented
        .items=${[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
        value="day"
        @lr-change=${(e: CustomEvent<{ value: string }>) => {
          const out = document.getElementById('segmented-log');
          if (out) out.textContent = `lr-change: ${JSON.stringify(e.detail)}`;
        }}
      ></lr-segmented>
      <p id="segmented-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};

/** The checked pill's background, text color, weight and shadow are individually themeable, and so
 *  is the hover treatment of an *unchecked* segment — separately. Before these hooks the only way
 *  to recolor the selection was to hijack library-wide `--lr-color-surface`/`--lr-color-text`, which
 *  repainted hovered-unselected segments with the very same values. */
export const ThemedSelection: Story = {
  name: 'Themed selection (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `--lr-segmented-selected-bg`, `--lr-segmented-selected-color`, `--lr-segmented-selected-font-weight` and `--lr-segmented-selected-shadow` on the element or any ancestor — none of them are declared on `:host`, so an ancestor value is never shadowed. `--lr-segmented-hover-color` themes the hovered, unchecked segment independently (hover the two unselected pills to compare).',
      },
    },
  },
  render: () => html`
    <div
      style="--lr-segmented-selected-bg: ${storyColor('brand')}; --lr-segmented-selected-color: ${storyColor(
        'onBrand',
      )}; --lr-segmented-selected-shadow: none; --lr-segmented-selected-font-weight: 700; --lr-segmented-hover-color: ${storyColor(
        'brand',
      )};"
    >
      <lr-segmented
        label="View"
        .items=${[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
        value="week"
      ></lr-segmented>
    </div>
  `,
};

/** `--lr-segmented-track-height` pins the track to an exact height at any `size`, for a row that has
 *  to line up with a hard-sized toolbar control. Left unset (the default) each tier keeps its own
 *  `--lr-segmented-track-min-height` floor and grows with its content. */
export const ExactTrackHeight: Story = {
  name: 'Exact track height',
  render: () => html`
    <div style="display: flex; gap: 8px; align-items: center; --lr-segmented-track-height: 32px;">
      <lr-segmented
        size="s"
        label="View"
        .items=${[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
        value="week"
      ></lr-segmented>
      <lr-segmented
        size="l"
        label="Density"
        .items=${[
          { value: 'cozy', label: 'Cozy' },
          { value: 'compact', label: 'Compact' },
        ]}
        value="cozy"
      ></lr-segmented>
    </div>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-start;">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`<lr-segmented
          size=${size}
          .items=${[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
          value="week"
        ></lr-segmented>`,
      )}
    </div>
  `,
};
