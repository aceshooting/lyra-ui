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
      aria-label="Programmatic values from zero to one hundred"
      .values=${[20, 40, 30, 70]}
      min="0"
      max="100"
    ></lr-sparkline>
  `,
};
