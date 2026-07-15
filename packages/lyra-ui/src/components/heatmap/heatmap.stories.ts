import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { CalendarDay } from './calendar-grid.js';

const meta: Meta = {
  title: 'Heatmap',
  component: 'lyra-heatmap',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-heatmap
      cell-size="24"
      value-label="events"
      .rowLabels=${['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
      .colLabels=${['0h', '6h', '12h', '18h']}
      .values=${[
        [1, 4, 9, 2],
        [0, 2, 6, 3],
        [5, 8, 3, 1],
        [-1, 1, 4, 7],
        [2, 3, 5, 6],
      ]}
    ></lyra-heatmap>
  `,
};

export const SqrtScaleFitToWidth: Story = {
  render: () => html`
    <lyra-heatmap
      scale="sqrt"
      fit-to-width
      value-label="requests"
      .rowLabels=${['Mon', 'Tue', 'Wed']}
      .colLabels=${['0h', '6h', '12h', '18h']}
      .values=${[
        [1, 8, 400, 20],
        [0, 2, 6, 3],
        [-1, 1, 4, 7],
      ]}
    ></lyra-heatmap>
  `,
};

export const CalendarMode: Story = {
  render: () => {
    const days: CalendarDay[] = [];
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 120; i++) {
      const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const value = Math.round(Math.abs(Math.sin(i / 6)) * 10);
      days.push({ date, value });
    }
    return html`
      <lyra-heatmap mode="calendar" value-label="commits" bucket-count="5" .days=${days}></lyra-heatmap>
    `;
  },
};

export const CustomTheme: Story = {
  render: () => html`
    <lyra-heatmap
      style="
        --lyra-heatmap-scale-lo: var(--lyra-color-danger-quiet);
        --lyra-heatmap-scale-hi: var(--lyra-color-danger);
        --lyra-heatmap-no-data-fill: var(--lyra-color-no-data);
        --lyra-heatmap-label-font: 11px monospace;
      "
      cell-size="24"
      value-label="events"
      .rowLabels=${['Mon', 'Tue', 'Wed']}
      .colLabels=${['0h', '6h', '12h']}
      .values=${[
        [1, 4, 9],
        [0, 2, 6],
        [-1, 1, 4],
      ]}
    ></lyra-heatmap>
  `,
};

/**
 * Hover a cell for its tooltip, tab to the grid and use the arrow keys to
 * move the focus ring (a visually-hidden live region announces each move),
 * and click or press Enter/Space on a cell to see its `lyra-cell-click`
 * detail logged below.
 */
export const HoverFocusClick: Story = {
  render: () => {
    const onCellClick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const out = document.getElementById('cell-click-out');
      if (out) out.textContent = JSON.stringify(detail);
    };
    return html`
      <lyra-heatmap
        cell-size="28"
        value-label="events"
        .rowLabels=${['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
        .colLabels=${['0h', '6h', '12h', '18h']}
        .values=${[
          [1, 4, 9, 2],
          [0, 2, 6, 3],
          [5, 8, 3, 1],
          [-1, 1, 4, 7],
          [2, 3, 5, 6],
        ]}
        @lyra-cell-click=${onCellClick}
      ></lyra-heatmap>
      <p>Last <code>lyra-cell-click</code> detail: <code id="cell-click-out">(none yet)</code></p>
    `;
  },
};

/**
 * Opts into persistent native buttons over the canvas for consumers that need
 * one accessible control per cell. The overlay keeps a roving tab stop and
 * exposes the controlled `selectedCell` as `aria-pressed`.
 */
export const AccessibleCells: Story = {
  render: () => html`
    <lyra-heatmap
      accessible-cells
      cell-size="28"
      value-label="events"
      .rowLabels=${['Mon', 'Tue', 'Wed']}
      .colLabels=${['0h', '6h', '12h', '18h']}
      .values=${[
        [1, 4, 9, 2],
        [0, 2, 6, 3],
        [5, 8, 3, 1],
      ]}
      .selectedCell=${{ row: 1, col: 2 }}
    ></lyra-heatmap>
  `,
};

/**
 * Cells flagged via `annotations` get a stroked ring; ones with a `label`
 * also surface a swatch + text entry in the legend.
 */
export const Annotations: Story = {
  render: () => html`
    <lyra-heatmap
      cell-size="24"
      value-label="events"
      .rowLabels=${['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
      .colLabels=${['0h', '6h', '12h', '18h']}
      .values=${[
        [1, 4, 9, 2],
        [0, 2, 6, 3],
        [5, 8, 3, 1],
        [-1, 1, 4, 7],
        [2, 3, 5, 6],
      ]}
      .annotations=${[
        { row: 0, col: 2, label: 'Peak load' },
        { row: 2, col: 1, label: 'Incident' },
      ]}
    ></lyra-heatmap>
  `,
};

export const Selection: Story = {
  render: () => html`
    <lyra-heatmap
      .rowLabels=${['Mon', 'Tue', 'Wed']}
      .colLabels=${['00h', '06h', '12h', '18h']}
      .values=${[
        [3, 8, 12, 4],
        [1, 2, 9, 5],
        [0, 4, 6, 2],
      ]}
      .selectedCell=${{ row: 1, col: 2 }}
    ></lyra-heatmap>
  `,
};

/**
 * `cellText` overrides the built-in English tooltip/live-region template —
 * here with a French translation — for both matrix and calendar modes.
 */
export const CustomCellText: Story = {
  render: () => html`
    <lyra-heatmap
      cell-size="28"
      value-label="évènements"
      .rowLabels=${['Lun', 'Mar', 'Mer']}
      .colLabels=${['0h', '6h', '12h']}
      .values=${[
        [1, 4, 9],
        [0, 2, 6],
        [-1, 1, 4],
      ]}
      .cellText=${(pos: { row?: number; col?: number }, value: number) => {
        const rows = ['Lun', 'Mar', 'Mer'];
        const cols = ['0h', '6h', '12h'];
        const valueText = value < 0 ? 'aucune donnée' : String(value);
        return `Ligne ${rows[pos.row!]}, Col ${cols[pos.col!]} : ${valueText}`;
      }}
    ></lyra-heatmap>
  `,
};

/**
 * `columnX` overrides where each week column is painted (and hit-tested) in
 * calendar mode — here spaced wider than the default formula, to show how a
 * consumer could pass the same coordinate function to a sibling chart for
 * pixel-perfect column alignment.
 */
export const CalendarColumnAlignment: Story = {
  render: () => {
    const days: CalendarDay[] = [];
    const start = Date.UTC(2026, 0, 4); // a Sunday
    for (let i = 0; i < 42; i++) {
      const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const value = Math.round(Math.abs(Math.sin(i / 5)) * 10);
      days.push({ date, value });
    }
    const columnX = (week: number) => 32 + week * 20;
    return html`
      <lyra-heatmap
        mode="calendar"
        value-label="commits"
        bucket-count="5"
        .days=${days}
        .columnX=${columnX}
      ></lyra-heatmap>
    `;
  },
};

/** `annotations` in calendar mode match by ISO `date` instead of `row`/`col`. */
export const CalendarAnnotations: Story = {
  render: () => {
    const days: CalendarDay[] = [];
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 120; i++) {
      const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const value = Math.round(Math.abs(Math.sin(i / 6)) * 10);
      days.push({ date, value });
    }
    return html`
      <lyra-heatmap
        mode="calendar"
        value-label="commits"
        bucket-count="5"
        .days=${days}
        .annotations=${[{ date: '2026-02-14', label: 'Release day' }]}
      ></lyra-heatmap>
    `;
  },
};
