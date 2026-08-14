import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './app-rail-item.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = { title: 'Navigation/App rail item', component: 'lr-app-rail-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-app-rail-item href="/home">Home</lr-app-rail-item>` };

export const ProgrammaticActivation: StoryObj = {
  name: 'Programmatic click()',
  parameters: {
    docs: {
      description: {
        story:
          'Calling `click()` on the custom-element host forwards to its native link or button. Disabled items remain inert.',
      },
    },
  },
  render: () => html`
    <div>
      <lr-app-rail-item id="programmatic-app-rail-item">Open settings</lr-app-rail-item>
      <button
        type="button"
        @click=${() => document.getElementById('programmatic-app-rail-item')?.click()}
      >
        Call host click()
      </button>
    </div>
  `,
};

export const IconOnlyTooltip: StoryObj = {
  name: 'Icon-only tooltip',
  parameters: {
    docs: {
      description: {
        story:
          'With both `icon-only` and `tooltip`, hover or focus the named item to reveal its label flyout. The visible icon subtree remains inert and aria-hidden while the native link keeps the supplied accessible name and action.',
      },
    },
  },
  render: () => html`
    <div style="inline-size:var(--lr-icon-button-size);">
      <lr-app-rail-item href="#inbox" aria-label="Inbox" icon-only tooltip>
        <span slot="icon" aria-hidden="true">📥</span>Inbox
      </lr-app-rail-item>
    </div>
  `,
};

/** The `active`/`aria-current="page"` treatment is themeable through `--lr-app-rail-item-current-bg`
 *  and `--lr-app-rail-item-current-color`. Neither is declared on `:host`, so setting them on an
 *  ancestor is never shadowed, and they recolor only the current item — not everything else that
 *  reads `--lr-color-brand-quiet`/`--lr-color-brand`. */
export const ThemedCurrent: StoryObj = {
  name: 'Themed current item (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set the scoped current, hover, and active hooks on the element or any ancestor to recolor each state without hijacking the library-wide brand tokens.',
      },
    },
  },
  render: () => html`
    <div
      style="
        display: flex;
        flex-direction: column;
        gap: var(--lr-space-xs);
        inline-size: var(--lr-size-12rem);
        --lr-app-rail-item-current-bg: ${storyColor('successQuiet')};
        --lr-app-rail-item-current-color: ${storyColor(
        'success',
      )};
        --lr-app-rail-item-hover-bg: ${storyColor(
        'warningQuiet',
      )};
        --lr-app-rail-item-hover-color: ${storyColor(
        'warning',
      )};
        --lr-app-rail-item-active-bg: ${storyColor(
        'dangerQuiet',
      )};
        --lr-app-rail-item-active-color: ${storyColor('danger')};
      "
    >
      <lr-app-rail-item href="/home" active>Home</lr-app-rail-item>
      <lr-app-rail-item href="/inbox">Inbox</lr-app-rail-item>
      <lr-app-rail-item href="/settings">Settings</lr-app-rail-item>
    </div>
  `,
};
