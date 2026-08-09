import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './dashboard-grid.js';
import type { DashboardCell } from './dashboard-grid.js';

const layout: DashboardCell[] = [
  { id: 'users', x: 0, y: 0, w: 4, h: 2, label: 'Active users', widget: { type: 'stat', props: { label: 'Active users', value: '1,204' } } },
  { id: 'errors', x: 4, y: 0, w: 4, h: 2, label: 'Errors', widget: { type: 'stat', props: { label: 'Errors', value: '3' } } },
  { id: 'latency', x: 8, y: 0, w: 4, h: 2, label: 'p95 latency', widget: { type: 'stat', props: { label: 'p95 latency', value: '212ms' } } },
  { id: 'summary', x: 0, y: 2, w: 12, h: 3, label: 'Summary', widget: { type: 'markdown', props: { content: 'Nothing needs attention right now.' } } },
];
const unbrokenCustomCellText = 'LocalizationWithoutBreakOpportunity'.repeat(20);

const meta: Meta = {
  title: 'Dashboard Grid',
  component: 'lr-dashboard-grid',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-dashboard-grid style="width:100%" .layout=${layout}></lr-dashboard-grid>`,
};

export const Editable: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Pointer-drag/resize a cell (mouse) or focus one and use Ctrl/Cmd+Arrow to move, Ctrl/Cmd+Shift+Arrow to resize -- both paths are fully equivalent. This story only listens for the events; it does not persist the resulting layout anywhere (the host always owns persistence).',
      },
    },
  },
  render: () => html`
    <lr-dashboard-grid
      style="width:100%"
      cells-draggable
      cells-resizable
      collision="push"
      .layout=${layout}
    ></lr-dashboard-grid>
  `,
};

export const ThemedInteractionElevation: Story = {
  name: 'Themed drag/resize elevation',
  parameters: {
    docs: {
      description: {
        story:
          'Start dragging or resizing a cell to see a component-scoped --lr-dashboard-grid-interaction-shadow override.',
      },
    },
  },
  render: () => html`
    <lr-dashboard-grid
      style="
        width:100%;
        --lr-dashboard-grid-interaction-shadow:
          0 0 var(--lr-space-xs) var(--lr-space-2xs) var(--lr-color-brand);
      "
      cells-draggable
      cells-resizable
      .layout=${layout}
    ></lr-dashboard-grid>
  `,
};

export const LockedCell: Story = {
  render: () =>
    html`<lr-dashboard-grid
      style="width:100%"
      cells-draggable
      cells-resizable
      .layout=${layout.map((cell) => (cell.id === 'errors' ? { ...cell, locked: true } : cell))}
    ></lr-dashboard-grid>`,
};

export const Empty: Story = {
  render: () => html`<lr-dashboard-grid style="width:100%"></lr-dashboard-grid>`,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'At a 320px container allocation (a @container query, not the viewport) the grid drops its column layout for a single stacked column, in the same row-major reading order the grid itself renders.',
      },
    },
  },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; border:1px dashed var(--lr-color-border);">
      <lr-dashboard-grid style="width:100%" .layout=${layout}></lr-dashboard-grid>
    </div>
  `,
};

export const NarrowShortResizableCustomCells: Story = {
  name: 'Narrow short resizable custom cells (320px RTL)',
  parameters: {
    docs: {
      description: {
        story:
          'Short consumer-authored cells retain the shared 40px action floor while their resize handles exist, preventing an absolute handle from overlapping the previous cell or stacked gap.',
      },
    },
  },
  render: () => html`
    <div
      dir="rtl"
      style="inline-size: 320px; max-inline-size: 100%; border: var(--lr-border-width-thin) dashed var(--lr-color-border);"
    >
      <lr-dashboard-grid style="inline-size: 100%;" cells-resizable .layout=${[
        { id: 'short-a', x: 0, y: 0, w: 6, h: 1, label: 'Short A' },
        { id: 'short-b', x: 6, y: 0, w: 6, h: 1, label: 'Short B' },
      ] satisfies DashboardCell[]}>
        <div cell-id="short-a">A</div>
        <div cell-id="short-b">B</div>
      </lr-dashboard-grid>
    </div>
  `,
};

export const NarrowLongCustomContent: Story = {
  name: 'Narrow long custom content (320px RTL)',
  parameters: {
    docs: {
      description: {
        story:
          'A direct unbroken text run wraps inside its custom cell, while a consumer that explicitly owns overflow can retain a contained horizontal scrollport without widening the dashboard.',
      },
    },
  },
  render: () => html`
    <div
      dir="rtl"
      style="inline-size: 320px; max-inline-size: 100%; border: var(--lr-border-width-thin) dashed var(--lr-color-border);"
    >
      <lr-dashboard-grid style="inline-size: 100%;" .layout=${[
        { id: 'wrapped', x: 0, y: 0, w: 6, h: 1, label: 'Wrapped content' },
        { id: 'scrollport', x: 6, y: 0, w: 6, h: 1, label: 'Owned scrollport' },
      ] satisfies DashboardCell[]}>
        <div cell-id="wrapped">${unbrokenCustomCellText}</div>
        <div cell-id="scrollport" style="overflow: auto; white-space: nowrap;">
          ${unbrokenCustomCellText}
        </div>
      </lr-dashboard-grid>
    </div>
  `,
};
