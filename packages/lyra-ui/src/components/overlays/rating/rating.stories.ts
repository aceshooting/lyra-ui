import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './rating.js';
const meta: Meta = { title: 'Form/Rating', component: 'lr-rating', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-rating value="3" label="Satisfaction"></lr-rating>` };
export const NativeChangeEvent: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'A user commit emits a bubbling native change Event before lr-change. Native events have no detail; read event.target.value.',
      },
    },
  },
  render: () => {
    const onChange = (event: Event) => {
      const rating = event.currentTarget as HTMLElement & { value: number };
      const output = rating.parentElement?.querySelector('output');
      if (output) output.textContent = `Native change: ${rating.value}`;
    };
    return html`
      <div style="display: flex; gap: var(--lr-space-m); align-items: center;">
        <lr-rating value="2" label="Satisfaction" @change=${onChange}></lr-rating>
        <output aria-live="polite">Choose a rating</output>
      </div>
    `;
  },
};
export const HalfStarPrecision: StoryObj = {
  parameters: {
    docs: {
      description: {
        story: 'Pointer selection uses the position within each symbol and snaps to the configured 0.5 precision.',
      },
    },
  },
  render: () => html`<lr-rating value="3.5" precision="0.5" max="5" label="Satisfaction"></lr-rating>`,
};
export const Sizes: StoryObj = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: start;">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`<lr-rating size=${size} value="3" label=${`Satisfaction (${size})`}></lr-rating>`,
      )}
    </div>
  `,
};
export const AliasSizes: StoryObj = {
  parameters: {
    docs: {
      description: {
        story: '`small`, `medium`, and `large` are accepted write aliases whose getters normalize to `s`, `m`, and `l`.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: var(--lr-space-s); align-items: start;">
      <lr-rating size="small" value="3" label="Small alias"></lr-rating>
      <lr-rating size="medium" value="3" label="Medium alias"></lr-rating>
      <lr-rating size="large" value="3" label="Large alias"></lr-rating>
    </div>
  `,
};
export const CustomSymbol: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'getSymbol renders any Lit-renderable value per position; it is called once for the empty backdrop and once for the clipped filled overlay, so fractional precision still works. Renderer output is decorative: pointer and keyboard selection remain on the rating control.',
      },
    },
  },
  render: () => {
    const hearts = (_value: number, selected: boolean) => html`<span>${selected ? '♥' : '♡'}</span>`;
    return html`<lr-rating
      value="3"
      max="5"
      label="Favourites"
      .getSymbol=${hearts}
      style="--lr-rating-fill: crimson;"
    ></lr-rating>`;
  },
};
export const HoverDescription: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'lr-hover reports the value the pointer is currently over (phase start/move/end), which is what a live "Good / Great / Excellent" readout is driven from.',
      },
    },
  },
  render: () => {
    const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
    const onHover = (event: Event) => {
      const { phase, value } = (event as CustomEvent<{ phase: string; value: number }>).detail;
      const readout = (event.currentTarget as HTMLElement).querySelector('[data-readout]');
      if (readout) readout.textContent = phase === 'end' ? '' : (labels[Math.ceil(value)] ?? '');
    };
    return html`<div @lr-hover=${onHover} style="display: flex; gap: 0.75rem; align-items: center;">
      <lr-rating value="0" max="5" label="Satisfaction"></lr-rating>
      <span data-readout></span>
    </div>`;
  },
};
export const InAForm: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'Form-associated: the rating submits under its name, blocks submission while required and unrated, and form.reset() restores the value attribute.',
      },
    },
  },
  render: () => html`
    <form
      @submit=${(event: Event) => {
        event.preventDefault();
        const data = new FormData(event.target as HTMLFormElement);
        (event.target as HTMLFormElement).querySelector('output')!.textContent = `score=${data.get('score')}`;
      }}
      style="display: flex; gap: 0.75rem; align-items: center;"
    >
      <lr-rating name="score" value="2" required label="Satisfaction"></lr-rating>
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
      <output></output>
    </form>
  `,
};
export const CustomTheming: StoryObj = {
  render: () => html`<lr-rating
    value="4"
    label="Satisfaction"
    style="--lr-rating-fill: seagreen; --lr-rating-empty-color: gainsboro; --lr-rating-size: 2rem;"
  ></lr-rating>`,
};
export const CompatibilityAliases: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'default-value targets the reset default, while --symbol-color, --symbol-color-active, --symbol-size, and --symbol-spacing theme the mapped symbol surface.',
      },
    },
  },
  render: () => html`<lr-rating
    default-value="3"
    label="Compatibility-themed satisfaction"
    style="--symbol-color: var(--lr-color-border-strong); --symbol-color-active: var(--lr-color-success); --symbol-size: var(--lr-font-size-2xl); --symbol-spacing: var(--lr-space-m);"
  ></lr-rating>`,
};
