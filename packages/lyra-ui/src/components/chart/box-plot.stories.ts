import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { BoxPlotSeries } from './box-plot.js';

const meta: Meta = {
  title: 'Charts/BoxPlot',
  component: 'lyra-box-plot',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const boxes: BoxPlotSeries[] = [
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
      <lyra-box-plot
        height="16rem"
        style="width: 22rem"
        .labels=${['K=2', 'K=3', 'K=4']}
        .boxes=${boxes}
      ></lyra-box-plot>
    `;
  },
};

/** Narrow-allocation and long-content evidence for box plots embedded in compact panels. */
export const NarrowLongContent: Story = {
  name: 'Narrow (320px) with long content',
  render: () => {
    const boxes: BoxPlotSeries[] = [
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
        <lyra-box-plot
          aria-label="Request latency distributions by deployment cohort"
          height="16rem"
          legend
          .labels=${['Current production cohort', 'Candidate deployment cohort']}
          .boxes=${boxes}
        ></lyra-box-plot>
      </div>
    `;
  },
};

/** Canvas chrome reads the shared chart tokens; `refreshTheme()` picks up out-of-band changes. */
export const ThemedTokensAndRefresh: Story = {
  render: () => {
    const boxes: BoxPlotSeries[] = [
      { label: 'Latency', data: [{ min: 100, q1: 180, median: 240, q3: 330, max: 510 }] },
    ];
    return html`
      <div>
        <lyra-box-plot
          height="16rem"
          style="inline-size: 22rem; --lyra-chart-grid-color: var(--lyra-color-danger);"
          .labels=${['Production']}
          .boxes=${boxes}
        ></lyra-box-plot>
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
