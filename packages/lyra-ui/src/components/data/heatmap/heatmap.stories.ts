import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { CalendarDay } from './calendar-grid.js';
import type { CalendarCellPos, MatrixCellPos } from './heatmap.js';

const meta: Meta = {
  title: 'Heatmap',
  component: 'lr-heatmap',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-heatmap
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
    ></lr-heatmap>
  `,
};

export const SqrtScaleFitToWidth: Story = {
  render: () => html`
    <lr-heatmap
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
    ></lr-heatmap>
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
      <lr-heatmap mode="calendar" value-label="commits" bucket-count="5" .days=${days}></lr-heatmap>
    `;
  },
};

export const CustomTheme: Story = {
  render: () => html`
    <lr-heatmap
      style="
        --lr-heatmap-scale-lo: var(--lr-color-danger-quiet);
        --lr-heatmap-scale-hi: var(--lr-color-danger);
        --lr-heatmap-no-data-fill: var(--lr-color-no-data);
        --lr-heatmap-label-font: 11px monospace;
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
    ></lr-heatmap>
  `,
};

/**
 * Hover a cell for its tooltip, tab to the grid and use the arrow keys to
 * move the focus ring (a visually-hidden live region announces each move),
 * and click or press Enter/Space on a cell to see its `lr-cell-click`
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
      <lr-heatmap
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
        @lr-cell-click=${onCellClick}
      ></lr-heatmap>
      <p>Last <code>lr-cell-click</code> detail: <code id="cell-click-out">(none yet)</code></p>
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
    <lr-heatmap
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
    ></lr-heatmap>
  `,
};

/**
 * Cells flagged via `annotations` get a stroked ring; ones with a `label`
 * also surface a swatch + text entry in the legend.
 */
export const Annotations: Story = {
  render: () => html`
    <lr-heatmap
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
    ></lr-heatmap>
  `,
};

export const Selection: Story = {
  render: () => html`
    <lr-heatmap
      .rowLabels=${['Mon', 'Tue', 'Wed']}
      .colLabels=${['00h', '06h', '12h', '18h']}
      .values=${[
        [3, 8, 12, 4],
        [1, 2, 9, 5],
        [0, 4, 6, 2],
      ]}
      .selectedCell=${{ row: 1, col: 2 }}
    ></lr-heatmap>
  `,
};

/**
 * `cellText` overrides the built-in English tooltip/live-region template —
 * here with a French translation — for both matrix and calendar modes.
 */
export const CustomCellText: Story = {
  render: () => html`
    <lr-heatmap
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
    ></lr-heatmap>
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
      <lr-heatmap
        mode="calendar"
        value-label="commits"
        bucket-count="5"
        .days=${days}
        .columnX=${columnX}
      ></lr-heatmap>
    `;
  },
};

/**
 * When `cellColor` paints a domain of its own, `legendStops` keeps the legend honest: the
 * two-endpoint gradient bar is replaced by one swatch per stop, so the key matches the grid
 * instead of the `--lr-heatmap-scale-lo`/`-hi` ramp the grid no longer follows.
 *
 * Here each day is shaded by its share of the busiest day, with a 12% opacity floor so "some
 * activity, however small" stays visible; the stops reuse the same shading function. A stop's
 * label defaults to the component's own numeric formatting of `value` — only the zero stop needs
 * an explicit `label` override.
 */
export const CustomScaleLegend: Story = {
  render: () => {
    const days: CalendarDay[] = [];
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 120; i++) {
      const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const value = Math.max(0, Math.round(Math.sin(i / 9) * 12));
      days.push({ date, value });
    }
    const max = days.reduce((hi, d) => Math.max(hi, d.value), 0);
    /** A percentage of the accent color with a 12% floor, so a 1-event day still reads as "some". */
    const shade = (ratio: number) =>
      `color-mix(in srgb, var(--lr-color-brand) ${Math.round(Math.max(0.12, ratio) * 100)}%, transparent)`;
    return html`
      <lr-heatmap
        mode="calendar"
        value-label="events"
        .days=${days}
        .cellColor=${(_pos: unknown, value: number) => (value > 0 ? shade(value / max) : undefined)}
        .legendStops=${[
          { value: 0, color: 'var(--lr-color-no-data)', label: 'none' },
          { value: Math.round(max * 0.25), color: shade(0.25) },
          { value: Math.round(max * 0.5), color: shade(0.5) },
          { value: Math.round(max * 0.75), color: shade(0.75) },
          { value: max, color: shade(1) },
        ]}
      ></lr-heatmap>
    `;
  },
};

/**
 * A `legendStops` entry may omit `color` entirely, rendering a **caption-only** stop: label text
 * with no `[part="legend-swatch"]` element in the DOM. That is what a GitHub-style
 * "Less ▢▢▢▢ More" key needs — bare captions bracketing the colored ramp, instead of two empty
 * swatch boxes at the ends of the row.
 */
export const CaptionOnlyLegendStops: Story = {
  render: () => {
    const days: CalendarDay[] = [];
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 120; i++) {
      const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      days.push({ date, value: Math.round(Math.abs(Math.sin(i / 6)) * 10) });
    }
    const shade = (ratio: number) =>
      `color-mix(in srgb, var(--lr-color-brand) ${Math.round(ratio * 100)}%, transparent)`;
    return html`
      <lr-heatmap
        mode="calendar"
        value-label="commits"
        .days=${days}
        .legendStops=${[
          { value: 0, label: 'Less' },
          { value: 3, color: shade(0.25) },
          { value: 5, color: shade(0.5) },
          { value: 8, color: shade(0.75) },
          { value: 10, color: shade(1) },
          { value: 11, label: 'More' },
        ]}
      ></lr-heatmap>
    `;
  },
};

/**
 * `fit-to-width` divides the whole host width across the grid, which turns a short calendar in a
 * wide pane into a handful of giant blocks. `max-cell-size` caps that, and `min-cell-size` raises
 * the built-in 4px floor so a long calendar in a narrow pane overflows rather than collapsing into
 * hairlines. Both are ignored while `fit-to-width` is unset. The canvas is sized from the *clamped*
 * cell size, so a capped grid deliberately leaves the rest of the host width unfilled.
 */
export const ClampedFitToWidth: Story = {
  render: () => {
    const days: CalendarDay[] = [];
    const start = Date.UTC(2026, 0, 4); // a Sunday -> 5 clean week columns
    for (let i = 0; i < 35; i++) {
      const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      days.push({ date, value: Math.round(Math.abs(Math.sin(i / 4)) * 10) });
    }
    return html`
      <div style="display: grid; gap: 1.5rem;">
        <div>
          <p style="margin: 0 0 0.25rem; font: 0.75rem system-ui;">fit-to-width, unclamped</p>
          <lr-heatmap mode="calendar" fit-to-width value-label="commits" .days=${days}></lr-heatmap>
        </div>
        <div>
          <p style="margin: 0 0 0.25rem; font: 0.75rem system-ui;">fit-to-width, max-cell-size="26"</p>
          <lr-heatmap
            mode="calendar"
            fit-to-width
            max-cell-size="26"
            value-label="commits"
            .days=${days}
          ></lr-heatmap>
        </div>
        <div style="inline-size: 180px;">
          <p style="margin: 0 0 0.25rem; font: 0.75rem system-ui;">narrow host, min-cell-size="14"</p>
          <lr-heatmap
            mode="calendar"
            fit-to-width
            min-cell-size="14"
            value-label="commits"
            .days=${days}
          ></lr-heatmap>
        </div>
      </div>
    `;
  },
};

/**
 * In calendar mode the position passed to `cellText`, `cellColor` and `cellInteractive` carries the
 * resolved ISO `date` alongside `week`/`weekday` — for gap positions with no entry in `days` too.
 * Here `cellInteractive` retires every date after the data ends (no tooltip, no keyboard stop), and
 * `cellText` writes the date straight into the tooltip without re-deriving the grid's anchor
 * arithmetic.
 */
export const DateAwareCallbacks: Story = {
  render: () => {
    const days: CalendarDay[] = [];
    const start = Date.UTC(2026, 0, 4);
    for (let i = 0; i < 70; i++) {
      const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      if (i % 5 !== 0) days.push({ date, value: Math.round(Math.abs(Math.sin(i / 4)) * 10) });
    }
    const lastDay = days[days.length - 1]!.date;
    return html`
      <lr-heatmap
        mode="calendar"
        value-label="commits"
        .days=${days}
        .cellInteractive=${(pos: MatrixCellPos | CalendarCellPos) =>
          (pos as CalendarCellPos).date <= lastDay}
        .cellText=${(pos: MatrixCellPos | CalendarCellPos, value: number) =>
          `${(pos as CalendarCellPos).date}: ${value < 0 ? 'no data' : value}`}
      ></lr-heatmap>
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
      <lr-heatmap
        mode="calendar"
        value-label="commits"
        bucket-count="5"
        .days=${days}
        .annotations=${[{ date: '2026-02-14', label: 'Release day' }]}
      ></lr-heatmap>
    `;
  },
};
