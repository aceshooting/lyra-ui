import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraAlert } from './alert.js';
import './alert.js';

const meta: Meta = {
  title: 'Feedback/Alert',
  component: 'lr-alert',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A closed-by-default inline alert whose host serializes `role="alert"` for SSR/no-JS output; an explicitly authored alternate role remains authoritative.',
      },
      source: {
        type: 'code',
      },
    },
  },
};

export default meta;

export const ClosedByDefault: StoryObj = {
  name: 'Closed by default',
  render: () => html`
    <button
      type="button"
      @click=${(event: Event) => {
        const alert = (event.currentTarget as HTMLElement).nextElementSibling as LyraAlert;
        void alert.show();
      }}
    >
      Show alert
    </button>
    <lr-alert closable>
      <span slot="icon" aria-hidden="true">ⓘ</span>
      This alert starts closed until its button calls <code>show()</code>.
    </lr-alert>
  `,
};

export const Variants: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'The icon slot is visible presentation content whose flattened subtree is inert and aria-hidden. The localized native close button remains the independent action.',
      },
    },
  },
  render: () => html`
    <div style="display:grid; gap:var(--lr-space-s);">
      ${(['primary', 'success', 'neutral', 'warning', 'danger'] as const).map(
        (variant) => html`
          <lr-alert open closable variant=${variant}>
            <span slot="icon" aria-hidden="true">●</span>
            <strong>${variant}</strong> — the alert remains an assertive message surface.
          </lr-alert>
        `,
      )}
    </div>
  `,
};

export const Countdown: StoryObj = {
  render: () => html`
    <lr-alert open closable variant="warning" duration="10000" countdown="rtl">
      <span slot="icon" aria-hidden="true">!</span>
      This alert restarts its ten-second countdown after hover or focus interaction.
    </lr-alert>
  `,
};

export const Toast: StoryObj = {
  render: () => html`
    <button
      type="button"
      @click=${(event: Event) => {
        const alert = (event.currentTarget as HTMLElement).nextElementSibling as LyraAlert;
        void alert.toast();
      }}
    >
      Show toast
    </button>
    <lr-alert closable duration="5000" variant="success">
      <span slot="icon" aria-hidden="true">✓</span>
      Changes saved.
    </lr-alert>
  `,
};

export const NarrowLongContent: StoryObj = {
  render: () => html`
    <div style="inline-size:20rem; max-inline-size:100%;">
      <lr-alert open closable variant="danger">
        <span slot="icon" aria-hidden="true">!</span>
        This_is_a_deliberately_long_unbroken_alert_message_that_must_wrap_inside_a_320px_allocation.
      </lr-alert>
    </div>
  `,
};
