import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraDrawer } from './drawer.js';

const meta: Meta = {
  title: 'Drawer',
  component: 'lr-drawer',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const End: Story = {
  render: (_args, context) => html`<lr-drawer .open=${context.viewMode !== 'docs'} placement="end" heading="Filters" closable>
    <p>Use this panel for contextual controls without leaving the current page.</p>
    <div slot="footer"><button type="button">Apply</button></div>
  </lr-drawer>`,
};

export const Start: Story = {
  render: (_args, context) => html`<lr-drawer .open=${context.viewMode !== 'docs'} placement="start" aria-label="Navigation">
    <nav aria-label="Sections"><a href="#overview">Overview</a></nav>
  </lr-drawer>`,
};

export const NarrowLongContent: Story = {
  render: (_args, context) => html`<div style="inline-size: 20rem; min-block-size: 34rem;">
    <lr-drawer .open=${context.viewMode !== 'docs'} placement="end" heading="Filters and advanced options" closable>
      <p>Long drawer content wraps at a narrow allocation and continues below the viewport.</p>
      <p>Use the controls below to verify that the footer remains reachable and labels do not clip.</p>
      <div slot="footer"><button type="button">Reset all filters</button><button type="button">Apply filters</button></div>
    </lr-drawer>
  </div>`,
};

export const Lifecycle: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`show()`/`hide()` and the `lr-show`/`lr-after-show`/`lr-hide`/`lr-after-hide` lifecycle are inherited from `<lr-dialog>` unchanged; `lr-after-hide` fires once the panel has finished sliding out. An open drawer sits in the browser top layer, so no consumer stacking context can cover it.',
      },
    },
  },
  render: () => html`
    <div style="position: relative; z-index: 0; isolation: isolate;">
      <button
        @click=${(e: Event) =>
          ((e.currentTarget as HTMLElement).parentElement!.querySelector('lr-drawer') as LyraDrawer).show()}
      >
        Open drawer
      </button>
      <lr-drawer
        heading="Filters"
        closable
        @lr-after-show=${() => console.info('lr-after-show')}
        @lr-after-hide=${() => console.info('lr-after-hide')}
      >
        <p>Slides in from the end edge, and back out again on close.</p>
        <input autofocus placeholder="[autofocus] takes initial focus" />
      </lr-drawer>
    </div>
  `,
};
