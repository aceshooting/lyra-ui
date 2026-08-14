import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraBoxPlotSeries } from './box-plot.js';

const meta: Meta = {
  title: 'Charts/BoxPlot',
  component: 'lr-box-plot',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const boxes: LyraBoxPlotSeries[] = [
      {
        label: 'Loss',
        data: [
          { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
          { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
          { min: 1.5, q1: 2.5, median: 3.5, q3: 4.5, max: 6.5 },
        ],
      },
    ];
    return html`
      <lr-box-plot
        height="16rem"
        style="width: 22rem"
        .labels=${['K=2', 'K=3', 'K=4']}
        .datasets=${boxes}
      ></lr-box-plot>
    `;
  },
};

/**
 * Box plots share the chart legend's controlled/cancelable contract. The first series stays visible
 * because its proposal is vetoed; the second begins hidden and emits its complete next snapshot on
 * an accepted toggle.
 */
export const ControlledLegendVisibility: Story = {
  render: () => {
    const boxes: LyraBoxPlotSeries[] = [
      {
        label: 'Production (vetoed)',
        data: [{ min: 100, q1: 180, median: 240, q3: 330, max: 510 }],
      },
      {
        label: 'Candidate (initially hidden)',
        data: [{ min: 90, q1: 150, median: 210, q3: 300, max: 480 }],
      },
    ];
    return html`
      <lr-box-plot
        height="16rem"
        style="inline-size: 26rem; max-inline-size: 100%;"
        legend
        legend-position="start"
        .hiddenDatasets=${[1]}
        .labels=${['Request latency']}
        .datasets=${boxes}
        @lr-before-legend-visibility-change=${(
          event: CustomEvent<{ datasetIndex: number }>,
        ) => {
          if (event.detail.datasetIndex === 0) event.preventDefault();
        }}
        @lr-legend-visibility-change=${(event: CustomEvent) =>
          console.info('Committed box-plot legend visibility', event.detail)}
      ></lr-box-plot>
    `;
  },
};

/**
 * Narrow-allocation and long-content evidence for box plots embedded in compact panels. Click the
 * legend item to inspect its persistent line-through state and `legend-item-hidden` part hook.
 */
export const NarrowLongContent: Story = {
  name: 'Narrow (320px) with long content',
  render: () => {
    const boxes: LyraBoxPlotSeries[] = [
      {
        label: 'End-to-end request latency across all production regions',
        data: [
          { min: 100, q1: 180, median: 240, q3: 330, max: 510 },
          { min: 120, q1: 200, median: 280, q3: 370, max: 560 },
        ],
      },
    ];
    return html`
      <div style="inline-size: 320px; max-inline-size: 100%;">
        <lr-box-plot
          aria-label="Request latency distributions by deployment cohort"
          height="16rem"
          legend
          .labels=${['Current production cohort', 'Candidate deployment cohort']}
          .datasets=${boxes}
        ></lr-box-plot>
      </div>
    `;
  },
};

/**
 * Canvas chrome and the wrapping DOM legend share chart tokens; `refreshTheme()` picks up
 * out-of-band canvas and computed legend-swatch changes. Canvas-bound token expressions are
 * resolved to concrete colors and invalid values fail to semantic paint fallbacks.
 */
export const ThemedTokensAndRefresh: Story = {
  render: () => {
    const boxes: LyraBoxPlotSeries[] = [
      { label: 'Latency', data: [{ min: 100, q1: 180, median: 240, q3: 330, max: 510 }] },
    ];
    return html`
      <div>
        <lr-box-plot
          height="16rem"
          style="inline-size: 22rem; --lr-chart-grid-color: var(--lr-color-danger);"
          .labels=${['Production']}
          .datasets=${boxes}
        ></lr-box-plot>
        <button
          type="button"
          @click=${(event: Event) => {
            const chart = (event.currentTarget as HTMLElement).previousElementSibling as HTMLElement & {
              refreshTheme(): void;
            };
            chart.refreshTheme();
          }}
        >
          refreshTheme()
        </button>
      </div>
    `;
  },
};

/**
 * Individual boxes are addressable. Focus the plot and walk it with Arrow/Home/End, then press
 * Enter or Space — or click a box — to emit `lr-datum-activate` with that box's five-number summary.
 * Each keyboard move announces the box through the shared light-DOM polite live region.
 */
export const PerBoxInteractivity: Story = {
  render: () => {
    const boxes: LyraBoxPlotSeries[] = [
      {
        label: 'Production',
        data: [
          { min: 100, q1: 180, median: 240, q3: 330, max: 510 },
          { min: 120, q1: 200, median: 280, q3: 370, max: 560 },
        ],
      },
      {
        label: 'Candidate',
        data: [
          { min: 90, q1: 150, median: 210, q3: 300, max: 480 },
          { min: 95, q1: 160, median: 220, q3: 310, max: 495 },
        ],
      },
    ];
    return html`
      <lr-box-plot
        height="16rem"
        style="inline-size: 26rem; max-inline-size: 100%;"
        legend
        y-label="Latency (ms)"
        .labels=${['Week 1', 'Week 2']}
        .datasets=${boxes}
        @lr-datum-activate=${(event: CustomEvent) => console.info('Box activated', event.detail)}
      ></lr-box-plot>
    `;
  },
};

/**
 * Supplying the accessibility-table slot replaces the generated table. Use it for a complete,
 * paginated, or virtualized alternative when the built-in 1,000-record sample is insufficient.
 */
export const CustomDataTable: Story = {
  render: () => html`
    <lr-box-plot
      .labels=${['Production']}
      .datasets=${[
        { label: 'Latency', data: [{ min: 100, q1: 180, median: 240, q3: 330, max: 510 }] },
      ]}
    >
      <table slot="data-table">
        <caption>Latency distribution</caption>
        <thead><tr><th>Environment</th><th>Median</th></tr></thead>
        <tbody><tr><th>Production</th><td>240</td></tr></tbody>
      </table>
    </lr-box-plot>
  `,
};
