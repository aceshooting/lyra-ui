import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './slider.js';
import type { LyraSlider } from './slider.js';

const meta: Meta = {
  title: 'Slider',
  component: 'lyra-slider',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A numeric range control (e.g. an LLM "temperature" setting), form-associated via `FormAssociated`. Mirrors native `<input type="range">`: `value` is the form-submitted string, `valueAsNumber` is the ergonomic numeric accessor kept in sync with it.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-slider aria-label="Volume" style="max-inline-size: 20rem;"></lyra-slider>`,
};

export const Temperature: Story = {
  name: 'Temperature (fractional step)',
  render: () => html`
    <lyra-slider
      label="Temperature"
      min="0"
      max="1"
      step="0.1"
      value="0.7"
      style="max-inline-size: 20rem;"
    ></lyra-slider>
  `,
};

export const WithoutValueReadout: Story = {
  name: 'Without the value readout (show-value off)',
  render: () => html`
    <lyra-slider
      label="Opacity"
      min="0"
      max="100"
      value="60"
      .showValue=${false}
      style="max-inline-size: 20rem;"
    ></lyra-slider>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <lyra-slider
      label="Temperature"
      min="0"
      max="1"
      step="0.1"
      value="0.7"
      disabled
      style="max-inline-size: 20rem;"
    ></lyra-slider>
  `,
};

export const RightToLeft: Story = {
  name: 'Right-to-left',
  render: () => html`
    <lyra-slider
      dir="rtl"
      label="درجة الحرارة"
      min="0"
      max="1"
      step="0.1"
      value="0.7"
      style="max-inline-size: 20rem;"
    ></lyra-slider>
  `,
};

export const InAForm: Story = {
  name: 'In a form',
  render: () => html`
    <form
      style="display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start; max-inline-size: 20rem;"
      @submit=${(e: Event) => {
        e.preventDefault();
        const data = new FormData(e.target as HTMLFormElement);
        alert(`temperature: ${data.get('temperature')}`);
      }}
    >
      <lyra-slider name="temperature" label="Temperature" min="0" max="1" step="0.1" value="0.7"></lyra-slider>
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
    </form>
  `,
};

export const Interactive: Story = {
  render: () => html`
    <lyra-slider
      label="Temperature"
      min="0"
      max="1"
      step="0.1"
      value="0.7"
      style="max-inline-size: 20rem;"
      @lyra-input=${(e: CustomEvent<{ value: number }>) => {
        const out = document.getElementById('slider-log');
        if (out) out.textContent = `input: ${e.detail.value}`;
      }}
      @lyra-change=${(e: CustomEvent<{ value: number }>) => {
        const out = document.getElementById('slider-log');
        if (out) out.textContent = `change (committed): ${e.detail.value}`;
      }}
    ></lyra-slider>
    <p id="slider-log" style="font-family: monospace; margin-top: 0.5rem;">input: 0.7</p>
  `,
};

export const ProgrammaticValueAsNumber: Story = {
  name: 'Programmatic valueAsNumber',
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem; max-inline-size: 20rem;">
      <lyra-slider id="programmatic-slider" label="Temperature" min="0" max="1" step="0.1" value="0.2"></lyra-slider>
      <button
        @click=${(e: Event) => {
          const slider = (e.target as HTMLElement).parentElement!.querySelector(
            '#programmatic-slider',
          ) as LyraSlider;
          slider.valueAsNumber = Math.round(Math.random() * 10) / 10;
        }}
      >
        Randomize
      </button>
    </div>
  `,
};
