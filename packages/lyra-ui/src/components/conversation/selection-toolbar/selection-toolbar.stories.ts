import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraSelectionToolbar, SelectionAction } from './selection-toolbar.class.js';
import './selection-toolbar.js';

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
