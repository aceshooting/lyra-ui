import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraOption } from './option.js';
import './option.js';

const meta: Meta = { title: 'Combobox/Option', component: 'lr-option', tags: ['autodocs'], parameters: { docs: { description: { component: 'The selected property changes live state. When mounted in a select or combobox it immediately updates the owner and submission while preserving the selected attribute and reset default. Named adornment content changes refresh combobox proxy rows.' } } } };
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <div
      role="listbox"
      aria-label="Example options"
      style="display: grid; gap: var(--lr-space-xs); max-inline-size: var(--lr-size-20rem);"
    >
      <lr-option role="option" value="alpha" selected>Alpha</lr-option>
      <lr-option role="option" value="beta">Beta</lr-option>
      <lr-option role="option" value="gamma" disabled>Gamma (disabled)</lr-option>
    </div>
  `,
};

export const AdornmentAliases: StoryObj = {
  render: () => html`
    <div
      role="listbox"
      aria-label="Contact methods"
      style="display: grid; gap: var(--lr-space-xs); max-inline-size: var(--lr-size-20rem);"
    >
      <lr-option role="option" value="email">
        <span slot="start">@</span>
        Email
        <span slot="end">Primary</span>
      </lr-option>
      <lr-option role="option" value="phone">
        <span slot="prefix">#</span>
        Phone
        <span slot="suffix">Backup</span>
      </lr-option>
    </div>
  `,
};

/**
 * The `selected` attribute initializes `defaultSelected`/the reset default but property writes do
 * not reflect; `selected` is independent property-only live state.
 */
export const LiveAndDefaultSelection: StoryObj = {
  render: () => {
    const update = (event: Event, target: 'live' | 'default') => {
      const root = (event.currentTarget as HTMLElement).closest('[data-selection-story]')!;
      const option = root.querySelector('lr-option') as LyraOption;
      if (target === 'live') option.selected = !option.selected;
      else option.defaultSelected = !option.defaultSelected;
      const output = root.querySelector('output')!;
      output.textContent = [
        `selected: ${String(option.selected)}`,
        `defaultSelected: ${String(option.defaultSelected)}`,
        `selected attribute: ${String(option.hasAttribute('selected'))}`,
      ].join('; ');
    };

    return html`
      <div
        data-selection-story
        style="display: grid; gap: var(--lr-space-s); max-inline-size: var(--lr-size-20rem);"
      >
        <lr-option value="alpha" selected>Alpha</lr-option>
        <div style="display: flex; gap: var(--lr-space-xs); flex-wrap: wrap;">
          <button type="button" @click=${(event: Event) => update(event, 'live')}>
            Toggle live selected
          </button>
          <button type="button" @click=${(event: Event) => update(event, 'default')}>
            Toggle defaultSelected
          </button>
        </div>
        <output aria-live="polite">
          selected: true; defaultSelected: true; selected attribute: true
        </output>
      </div>
    `;
  },
};

export const ScopedStateTheme: StoryObj = {
  name: 'Scoped current / selected theme',
  parameters: { docs: { description: { story: 'Focus, hover, and press the standalone options to exercise their independent state hooks.' } } },
  render: () => html`
    <div role="listbox" aria-label="Themed options" style="display:grid;gap:var(--lr-space-xs);max-inline-size:var(--lr-size-20rem)">
      <lr-option
        role="option"
        value="alpha"
        selected
        tabindex="0"
        style="--lr-option-hover-bg: var(--lr-color-warning-quiet); --lr-option-current-bg: var(--lr-color-success-quiet); --lr-option-current-color: var(--lr-color-text); --lr-option-selected-font-weight: var(--lr-font-weight-bold); --lr-option-checked-icon-color: var(--lr-color-danger)"
      >Alpha</lr-option>
      <lr-option role="option" value="beta" tabindex="-1">Beta</lr-option>
    </div>
  `,
};

export const NarrowLongContent: StoryObj = {
  name: 'Narrow RTL long content (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'The label ellipsizes and trailing metadata stays capped inside an exact 320px RTL option row.',
      },
    },
  },
  render: () => html`
    <div dir="rtl" role="listbox" aria-label="Narrow options" style="inline-size:320px;max-inline-size:100%;overflow:hidden">
      <lr-option role="option" value="narrow">
        ${'LocalizedUnbrokenOptionLabel'.repeat(16)}
        <span slot="end">${'UnbrokenMetadata'.repeat(16)}</span>
      </lr-option>
    </div>
  `,
};
