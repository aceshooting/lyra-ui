import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './toggle-group.js';
import '../toggle/toggle.js';
import '../../overlays/overlay/tooltip.js';

const meta: Meta = {
  title: 'Forms & Inputs/Toggle Group',
  component: 'lr-toggle-group',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A set of `lr-toggle` children behind one tab stop. `selection-mode="multiple"` (the default) allows any number pressed; `single` allows zero or one, and pressing the pressed toggle clears the choice. A choice that must never be empty, such as text alignment or a view mode, is a radio choice: use `lr-radio-group` with `lr-radio-button`.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** Writes the group's committed value into the story's output line. */
const showValue = (event: CustomEvent<{ value: readonly string[] }>): void => {
  const output = (event.currentTarget as HTMLElement).parentElement?.querySelector('output');
  if (output) output.textContent = event.detail.value.length ? event.detail.value.join(', ') : 'none';
};

export const Multiple: Story = {
  render: () => html`
    <div style="display:grid;gap:var(--lr-space-s);justify-items:start">
      <lr-toggle-group label="Text formatting" @lr-change=${showValue}>
        <lr-toggle value="bold"><strong>B</strong> Bold</lr-toggle>
        <lr-toggle value="italic" pressed><em>I</em> Italic</lr-toggle>
        <lr-toggle value="underline"><u>U</u> Underline</lr-toggle>
      </lr-toggle-group>
      <p>Applied: <output>italic</output></p>
    </div>
  `,
};

export const Single: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'An optional highlight colour: zero or one. Pressing the active colour removes the highlight. Each toggle keeps its `aria-pressed` button semantics, which say nothing about exclusivity, so the group name states it.',
      },
    },
  },
  render: () => html`
    <div style="display:grid;gap:var(--lr-space-s);justify-items:start">
      <lr-toggle-group selection-mode="single" label="Highlight colour (optional, pick one)" @lr-change=${showValue}>
        <lr-toggle value="yellow" pressed>Yellow</lr-toggle>
        <lr-toggle value="green">Green</lr-toggle>
        <lr-toggle value="blue">Blue</lr-toggle>
        <lr-toggle value="pink">Pink</lr-toggle>
      </lr-toggle-group>
      <p>Highlight: <output>yellow</output></p>
    </div>
  `,
};

export const OutlinedJoined: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Adjacent toggles join into one bordered run. The run is measured from rendered geometry, so a real `--lr-toggle-group-gap`, a wrapped line or a hidden toggle keeps each toggle\'s corners.',
      },
    },
  },
  render: () => html`
    <lr-toggle-group label="Chart series" appearance="outlined">
      <lr-toggle value="revenue" pressed>Revenue</lr-toggle>
      <lr-toggle value="costs">Costs</lr-toggle>
      <lr-toggle value="margin" pressed>Margin</lr-toggle>
    </lr-toggle-group>
  `,
};

export const GroupSize: Story = {
  parameters: {
    docs: {
      description: {
        story: 'An opt-in group `size` overrides every owned toggle without rewriting the toggles\' own `size`.',
      },
    },
  },
  render: () => html`
    <div style="display:grid;gap:var(--lr-space-m);justify-items:start">
      ${(['s', 'm', 'l'] as const).map(
        (size) => html`
          <lr-toggle-group label=${`Text formatting (size ${size})`} size=${size} appearance="outlined">
            <lr-toggle value=${`${size}-bold`}>Bold</lr-toggle>
            <lr-toggle value=${`${size}-italic`} pressed>Italic</lr-toggle>
            <lr-toggle value=${`${size}-underline`}>Underline</lr-toggle>
          </lr-toggle-group>
        `,
      )}
    </div>
  `,
};

export const Vertical: Story = {
  render: () => html`
    <lr-toggle-group label="Layers" orientation="vertical" appearance="outlined">
      <lr-toggle value="roads" pressed>Roads</lr-toggle>
      <lr-toggle value="rivers">Rivers</lr-toggle>
      <lr-toggle value="borders" pressed>Borders</lr-toggle>
    </lr-toggle-group>
  `,
};

export const WithWrappers: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A toggle may sit inside a wrapper such as a tooltip and is still owned by the group. The tooltip opens on keyboard-modality focus, so it opens while arrow keys rove onto the wrapped toggle, matching its focus ring. Group `focus()` or focus repair that follows a pointer press does not open it, but the toggle is still described by the tooltip.',
      },
    },
  },
  render: () => html`
    <lr-toggle-group label="Text formatting">
      <lr-tooltip>
        <lr-toggle slot="trigger" value="bold"><strong>B</strong> Bold</lr-toggle>
        Bold (Ctrl+B)
      </lr-tooltip>
      <lr-tooltip>
        <lr-toggle slot="trigger" value="italic"><em>I</em> Italic</lr-toggle>
        Italic (Ctrl+I)
      </lr-tooltip>
      <lr-toggle value="underline"><u>U</u> Underline</lr-toggle>
    </lr-toggle-group>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <lr-toggle-group label="Text formatting" disabled>
      <lr-toggle value="bold" pressed>Bold</lr-toggle>
      <lr-toggle value="italic">Italic</lr-toggle>
    </lr-toggle-group>
  `,
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" lang="ar">
      <lr-toggle-group label="تنسيق النص" appearance="outlined">
        <lr-toggle value="bold" pressed>غامق</lr-toggle>
        <lr-toggle value="italic">مائل</lr-toggle>
        <lr-toggle value="underline">تسطير</lr-toggle>
      </lr-toggle-group>
    </div>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size:320px;border:1px dashed var(--lr-color-border);padding:var(--lr-space-s)">
      <lr-toggle-group label="Tags" appearance="outlined">
        ${['Design', 'Engineering', 'Research', 'Marketing', 'Support', 'Finance', 'Legal', 'Operations'].map(
          (tag) => html`<lr-toggle value=${tag.toLowerCase()}>${tag}</lr-toggle>`,
        )}
      </lr-toggle-group>
    </div>
  `,
};
