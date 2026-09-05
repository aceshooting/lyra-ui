import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './slider.js';
import type { LyraSlider, SliderValueFormatter } from './slider.js';

const LEVELS = ['Cold', 'Warm', 'Hot'];
const formatLevel: SliderValueFormatter = (value) => LEVELS[value];

const meta: Meta = {
  title: 'Slider',
  component: 'lr-slider',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A form-associated numeric slider. `value`, `defaultValue`, and `valueAsNumber` are numbers; range mode submits two same-name entries and pushes the sibling handle when crossed. Host `aria-label` wins on the role owner by attribute presence, including an explicitly empty override.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-slider label="Volume" style="max-inline-size: 20rem;"></lr-slider>`,
};

export const IndependentThumbStateTheme: Story = {
  name: 'Independent thumb state theme',
  render: () => html`
    <lr-slider
      label="Hover and drag the thumb"
      value="50"
      style="max-inline-size: var(--lr-size-20rem); --lr-slider-gap: var(--lr-space-l); --lr-slider-thumb-bg: var(--lr-color-success); --lr-slider-thumb-border-color: var(--lr-color-success-quiet); --lr-slider-thumb-hover-ring-color: var(--lr-color-warning-quiet); --lr-slider-thumb-active-ring-color: var(--lr-color-danger-quiet);"
    ></lr-slider>
  `,
};

export const Temperature: Story = {
  name: 'Temperature (fractional step)',
  render: () => html`
    <lr-slider
      label="Temperature"
      min="0"
      max="1"
      step="0.1"
      value="0.7"
      style="max-inline-size: 20rem;"
    >
      <span slot="reference">Deterministic — Creative</span>
    </lr-slider>
  `,
};

export const HumanReadableValueText: Story = {
  name: 'Human-readable value text',
  parameters: {
    docs: {
      description: {
        story:
          'A property-only `valueFormatter(value)` maps the numeric domain to the thumb’s `aria-valuetext` without changing `aria-valuenow`, the visible numeric readout, geometry, or emitted values.',
      },
    },
  },
  render: () => html`
    <lr-slider
      show-value
      label="Temperature level"
      min="0"
      max="2"
      value="1"
      .valueFormatter=${formatLevel}
      style="max-inline-size: 20rem;"
    ></lr-slider>
  `,
};

export const WithoutValueReadout: Story = {
  name: 'Without the value readout (default)',
  render: () => html`
    <lr-slider
      label="Opacity"
      min="0"
      max="100"
      value="60"
      style="max-inline-size: 20rem;"
    ></lr-slider>
  `,
};

export const WithValueReadout: Story = {
  name: 'With the value readout (show-value on)',
  render: () => html`
    <lr-slider label="Opacity" min="0" max="100" value="60" show-value style="max-inline-size: 20rem;"></lr-slider>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <lr-slider
      label="Temperature"
      min="0"
      max="1"
      step="0.1"
      value="0.7"
      disabled
      style="max-inline-size: 20rem;"
    ></lr-slider>
  `,
};

export const RightToLeft: Story = {
  name: 'Right-to-left',
  render: () => html`
    <lr-slider
      dir="rtl"
      label="درجة الحرارة"
      min="0"
      max="1"
      step="0.1"
      value="0.7"
      style="max-inline-size: 20rem;"
    ></lr-slider>
  `,
};

/** Exact-320px standalone sliders contain unbroken label/reference/hint text in both directions. */
export const StandaloneNarrow: Story = {
  name: 'Standalone narrow LTR/RTL (320px)',
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m)">
      ${(['ltr', 'rtl'] as const).map(
        (direction) => html`
          <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%">
            <lr-slider
              label="InternationalizedSliderLabelWithoutAnyNaturalBreakOpportunity"
              hint="InternationalizedSliderHintWithoutAnyNaturalBreakOpportunity"
              show-value
            >
              <span slot="reference">ReferenceUnitWithoutAnyNaturalBreakOpportunity</span>
            </lr-slider>
          </div>
        `,
      )}
    </div>
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
      <lr-slider name="temperature" label="Temperature" min="0" max="1" step="0.1" value="0.7"></lr-slider>
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
    </form>
  `,
};

export const ErrorChrome: Story = {
  name: 'Error and hint chrome',
  parameters: {
    docs: {
      description: {
        story:
          'Error content is announced before supporting hint text by every handle. Use `error-text` for plain copy or the `error` slot for rich markup.',
      },
    },
  },
  render: () => html`
    <lr-slider
      range
      label="Budget"
      min="0"
      max="1000"
      min-value="300"
      max-value="700"
      error-text="Choose a valid budget window."
      hint="Move either handle to update the submitted range."
      style="max-inline-size: 20rem;"
    ></lr-slider>
  `,
};

export const Interactive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Primary mouse, touch and pen gestures publish live input followed by one change on release. A changed keyboard sequence commits on keyup or when focus leaves the handle. Disablement or readonly cancels unfinished gestures while keeping the live value. External descriptions precede the slider’s local hint and error guidance.',
      },
    },
  },
  render: () => html`
    <p id="slider-interaction-guidance">Choose a temperature between 0 and 1.</p>
    <lr-slider
      label="Temperature"
      aria-describedby="slider-interaction-guidance"
      min="0"
      max="1"
      step="0.1"
      value="0.7"
      style="max-inline-size: 20rem;"
      @lr-input=${(e: CustomEvent<{ value: number }>) => {
        const out = document.getElementById('slider-log');
        if (out) out.textContent = `input: ${e.detail.value}`;
      }}
      @lr-change=${(e: CustomEvent<{ value: number }>) => {
        const out = document.getElementById('slider-log');
        if (out) out.textContent = `change (committed): ${e.detail.value}`;
      }}
    ></lr-slider>
    <button type="button">Move focus here to finish a keyboard edit</button>
    <p id="slider-log" style="font-family: monospace; margin-top: 0.5rem;">input: 0.7</p>
  `,
};

export const Range: Story = {
  name: 'Range (two handles)',
  parameters: {
    docs: {
      description: {
        story:
          'Two independently focusable handles selecting the span between `min-value` and `max-value`. Crossing pushes the sibling. A `name` submits two same-name entries in lower/upper order; use `FormData#getAll()`.',
      },
    },
  },
  render: () => html`
    <lr-slider
      range
      name="price"
      label="Price range"
      min="0"
      max="1000"
      step="50"
      min-value="200"
      max-value="800"
      hint="Both ends move independently; crossing pushes the other end."
      style="max-inline-size: 20rem;"
    ></lr-slider>
  `,
};

export const WithMarkersAndTooltip: Story = {
  name: 'Markers and tooltip',
  parameters: {
    docs: {
      description: {
        story:
          '`with-markers` draws a tick at every `step` position; `with-tooltip` shows the live, locale-formatted value above a handle while it is focused or dragged.',
      },
    },
  },
  render: () => html`
    <lr-slider
      with-markers
      with-tooltip
      tooltip-placement="bottom"
      tooltip-distance="12"
      indicator-offset="5"
      label="Quality"
      min="0"
      max="10"
      step="1"
      value="7"
      style="max-inline-size: 20rem;"
    ></lr-slider>
  `,
};

export const Vertical: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The value axis moves to the block axis, with `min` at the bottom. ArrowUp/ArrowDown become the primary keys and every handle exposes `aria-orientation="vertical"`. Set `--lr-slider-track-length` to change the track length.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:2rem; align-items:flex-start;">
      <lr-slider orientation="vertical" label="Volume" value="70" with-tooltip></lr-slider>
      <lr-slider
        orientation="vertical"
        range
        label="Band"
        min-value="30"
        max-value="70"
        style="--lr-slider-track-length: 14rem;"
      ></lr-slider>
    </div>
  `,
};

export const ReadOnly: Story = {
  name: 'Read-only',
  parameters: {
    docs: {
      description: {
        story:
          'Unlike `disabled`, a read-only slider stays focusable, fully legible, and still submits its value — it just refuses every drag and keystroke, and announces `aria-readonly="true"`.',
      },
    },
  },
  render: () => html`
    <lr-slider
      readonly
      label="Sampled temperature"
      min="0"
      max="1"
      step="0.1"
      value="0.7"
      hint="Recorded at request time; not editable."
      style="max-inline-size: 20rem;"
    ></lr-slider>
  `,
};

export const RangeRightToLeft: Story = {
  name: 'Range, right-to-left',
  render: () => html`
    <lr-slider
      dir="rtl"
      range
      label="نطاق السعر"
      min="0"
      max="1000"
      step="50"
      min-value="200"
      max-value="800"
      hint="يتحرك كل طرف بشكل مستقل."
      style="max-inline-size: 20rem;"
    ></lr-slider>
  `,
};

export const ProgrammaticValueAsNumber: Story = {
  name: 'Programmatic valueAsNumber',
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem; max-inline-size: 20rem;">
      <lr-slider id="programmatic-slider" label="Temperature" min="0" max="1" step="0.1" value="0.2"></lr-slider>
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

export const Sizes: StoryObj = {
  name: 'Size ladder',
  parameters: {
    docs: {
      description: {
        story:
          '`size` is the library\'s shared ladder, so a `size` set here matches an `<lr-input>`, `<lr-select>` or `<lr-button>` of the same `size` in the same row. Both spellings of every tier are accepted — `s`/`m`/`l` and Web Awesome\'s `small`/`medium`/`large` — so a migration is a tag rename with no attribute rewrite.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m); justify-items: start;">
      <lr-slider size="2xs" label="Size 2xs" show-value style="inline-size: 18rem"></lr-slider>
      <lr-slider size="xs" label="Size xs" show-value style="inline-size: 18rem"></lr-slider>
      <lr-slider size="s" label="Size s" show-value style="inline-size: 18rem"></lr-slider>
      <lr-slider size="m" label="Size m" show-value style="inline-size: 18rem"></lr-slider>
      <lr-slider size="l" label="Size l" show-value style="inline-size: 18rem"></lr-slider>
      <lr-slider size="xl" label="Size xl" show-value style="inline-size: 18rem"></lr-slider>
    </div>
  `,
};
