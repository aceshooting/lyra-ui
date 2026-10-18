import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

const DATA = "3 1 4 1 5 9 2 6 5 3 5";

const meta: Meta = {
  title: "Data/Sparkline",
  component: "lr-sparkline",
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj;

export const Solid: Story = {
  render: () =>
    html`<lr-sparkline
      data=${DATA}
      label="Solid revenue trend"
    ></lr-sparkline>`,
};

export const Gradient: Story = {
  render: () => html`
    <lr-sparkline
      appearance="gradient"
      data=${DATA}
      label="Gradient revenue trend"
    ></lr-sparkline>
  `,
};

export const Line: Story = {
  render: () => html`
    <lr-sparkline
      appearance="line"
      data=${DATA}
      label="Line-only revenue trend"
    ></lr-sparkline>
  `,
};

export const Curves: Story = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); max-inline-size: 20rem;">
      <span
        >Linear
        <lr-sparkline
          curve="linear"
          data=${DATA}
          label="Linear curve"
        ></lr-sparkline
      ></span>
      <span
        >Natural
        <lr-sparkline
          curve="natural"
          data=${DATA}
          label="Natural curve"
        ></lr-sparkline
      ></span>
      <span
        >Step
        <lr-sparkline
          curve="step"
          data=${DATA}
          label="Step curve"
        ></lr-sparkline
      ></span>
    </div>
  `,
};

export const Trends: Story = {
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); max-inline-size: 20rem;">
      <span
        >Positive
        <lr-sparkline
          trend="positive"
          data="1 2 3 5"
          label="Revenue increased"
        ></lr-sparkline
      ></span>
      <span
        >Negative
        <lr-sparkline
          trend="negative"
          data="5 4 2 1"
          label="Churn decreased"
        ></lr-sparkline
      ></span>
      <span
        >Neutral
        <lr-sparkline
          trend="neutral"
          data="3 3 4 3"
          label="Demand stayed stable"
        ></lr-sparkline
      ></span>
    </div>
  `,
};

export const PublicCssHooks: Story = {
  render: () => html`
    <lr-sparkline
      appearance="gradient"
      data=${DATA}
      label="Custom purple trend"
      style="
        block-size: var(--lr-size-1-5em);
        --line-color: var(--lr-color-brand);
        --fill-color: var(--lr-color-brand-quiet);
        --line-width: var(--lr-border-width-thick);
      "
    ></lr-sparkline>
  `,
};

export const NarrowRtl: Story = {
  name: "Narrow RTL allocation",
  render: () => html`
    <div
      dir="rtl"
      style="inline-size: 10rem; max-inline-size: 100%; overflow-wrap: anywhere;"
    >
      اتجاه الإيرادات خلال سبعة أيام
      <lr-sparkline data="5 4 4 3 4 2 3" label="اتجاه الإيرادات"></lr-sparkline>
    </div>
  `,
};

/** The additive Lyra surface retains property-only array input, explicit ranges, and bar marks. */
export const ProgrammaticBarExtension: Story = {
  render: () => html`
    <lr-sparkline
      mark="bar"
      .accessibleLabel=${'Programmatic values from zero to one hundred'}
      .values=${[20, 40, 30, 70]}
      min="0"
      max="100"
    ></lr-sparkline>
  `,
};

export const DataRemovalUsesValues: Story = {
  render: () => html`<div>
    <button type="button" @click=${(event: Event) => (event.currentTarget as HTMLElement).parentElement!.querySelector('lr-sparkline')!.removeAttribute('data')}>Use fallback values</button>
    <lr-sparkline label="Trend" data="1 2 3" .values=${[3, 1, 2]}></lr-sparkline>
  </div>`,
};

export const LateExtrema: Story = {
  parameters: { docs: { description: { story: 'A bounded endpoint and bucket-extrema sample preserves the late spike while the accessible summary counts the complete finite input.' } } },
  render: () => html`<lr-sparkline label="Late peak in a long series" .values=${Array.from({ length: 2_000 }, (_, index) => index === 1_998 ? 100 : 0)}></lr-sparkline>`,
};

/** A prepared overview preserves whole-source counts while rendering bounded original coordinates. */
export const PreparedOverview: Story = {
  render: () => {
    const prepared: import('../../../utilities/data-preparation.js').LyraPreparedSeriesData = {
      kind: 'series', revision: 'overview', getPoint: ref => ({ x: ref.sourceIndex, y: ref.sourceIndex % 100 }),
      series: [{ id: 'signal', label: 'Signal', counts: { sourceCount: 1000000, validCount: 1000000, invalidCount: 0 },
        xDomain: { min: 0, max: 999999 }, yDomain: { min: 0, max: 99 },
        samples: [0,99,500000,999999].map(sourceIndex => ({ x: sourceIndex, y: sourceIndex % 100, sourceIndex, breakBefore: sourceIndex === 0 })),
      }],
    };
    return html`<lr-sparkline style="width:16rem;height:4rem" .preparedData=${prepared}></lr-sparkline>`;
  },
};
