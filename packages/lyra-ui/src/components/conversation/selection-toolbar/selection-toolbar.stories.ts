import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraSelectionToolbar, SelectionAction } from './selection-toolbar.class.js';
import './selection-toolbar.js';
import '../../forms/button/button.js';

const meta: Meta = {
  title: 'Selection Toolbar',
  component: 'lr-selection-toolbar',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const refreshActions: SelectionAction[] = ['ask', 'quote', 'cite', 'copy'];

export const Default: Story = {
  render: () => html`
    <div style="min-height: 12rem; max-width: 40rem;">
      <p>
        The highlighted passage can be sent to an assistant, quoted, cited, or copied. The toolbar
        carries the selected text and its document locator in each action event.
      </p>
      <lr-selection-toolbar
        open
        text="The highlighted passage can be sent to an assistant."
        .anchor=${{ kind: 'text-quote', quote: 'The highlighted passage can be sent to an assistant.' }}
        .rect=${new DOMRect(60, 150, 280, 28)}
      ></lr-selection-toolbar>
    </div>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px), long selection',
  render: () => html`
    <div style="position: relative; inline-size: 320px; max-inline-size: 100%; min-block-size: 12rem;">
      <p>
        A deliberately long selected passage keeps all toolbar actions reachable when its preferred
        viewport position collides with both inline edges.
      </p>
      <lr-selection-toolbar
        open
        text="A deliberately long selected passage with an unbroken locator abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        .anchor=${{
          kind: 'text-quote',
          quote: 'A deliberately long selected passage with an unbroken locator',
        }}
        .rect=${new DOMRect(300, 150, 80, 28)}
      ></lr-selection-toolbar>
    </div>
  `,
};

export const ThemedPlacementGap: Story = {
  name: 'Themed placement gap',
  parameters: {
    docs: {
      description: {
        story:
          'The placement gap controls both the selection-anchor distance and the viewport collision inset. It accepts a CSS length and defaults to `var(--lr-space-s)`.',
      },
    },
  },
  render: () => html`
    <div style="min-block-size: var(--lr-size-15rem); max-inline-size: var(--lr-size-20rem);">
      <p>The toolbar stays farther from this selection and from the viewport edges.</p>
      <lr-selection-toolbar
        open
        text="A themed selection toolbar"
        style="--lr-selection-toolbar-placement-gap: var(--lr-size-2rem)"
        .rect=${new DOMRect(24, 160, 180, 24)}
      ></lr-selection-toolbar>
    </div>
  `,
};

export const ControlledActionRefreshFocus: Story = {
  name: 'Controlled action refresh focus',
  render: () => html`
    <div style="min-block-size: 12rem; max-inline-size: 40rem;">
      <p>Focus Quote, then press R. The controlled refresh keeps keyboard focus on Ask.</p>
      <lr-selection-toolbar
        open
        text="A controlled action refresh removes the focused action."
        .actions=${refreshActions}
        .rect=${new DOMRect(60, 150, 280, 28)}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key.toLocaleLowerCase() !== 'r') return;
          (event.currentTarget as LyraSelectionToolbar).actions = ['ask'];
        }}
      ></lr-selection-toolbar>
    </div>
  `,
};

export const SlottedExtraAction: Story = {
  name: 'Slotted extra action',
  parameters: {
    docs: {
      description: {
        story:
          'The `actions` slot renders after the four built-ins, inside the same `role="toolbar"` element and roving-tabindex group — so a product-specific action such as "Translate" joins Home/End/Arrow navigation without reimplementing the toolbar.',
      },
    },
  },
  render: () => html`
    <div style="min-block-size: 12rem; max-inline-size: 40rem;">
      <p>Tab into the toolbar, then use Arrow/Home/End: Translate is the last stop.</p>
      <lr-selection-toolbar
        open
        text="A selection with one product-specific extra action."
        .rect=${new DOMRect(60, 150, 280, 28)}
      >
        <lr-button slot="actions" size="xs" appearance="plain">Translate</lr-button>
      </lr-selection-toolbar>
    </div>
  `,
};
