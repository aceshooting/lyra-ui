import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './card.js';

const meta: Meta = {
  title: 'Card',
  component: 'lr-card',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A generic content surface that mirrors the public card contracts under the `lr-` prefix. `orientation` switches between vertical sections and horizontal media/body/actions, `image` aliases `media`, dedicated header/footer action slots preserve native controls, and `with-*` hints make those wrappers available during SSR. `appearance`, `interactive`, and `href` retain Lyra\'s stronger surface and activation APIs.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Outlined: Story = {
  render: () => html`
    <lr-card style="max-inline-size:20rem;">
      A bordered surface with padding — the default <code>appearance="outlined"</code>.
    </lr-card>
  `,
};

export const ShoelaceThemeHooks: Story = {
  name: 'Shoelace-compatible theme hooks',
  render: () => html`
    <lr-card
      style="max-inline-size:20rem;--border-color:var(--lr-color-brand);--border-radius:var(--lr-radius-pill);--border-width:var(--lr-border-width-medium);--padding:var(--lr-space-l)"
    >
      Border and padding styled through the upstream hooks.
    </lr-card>
  `,
};

export const Filled: Story = {
  render: () => html`
    <lr-card appearance="filled" style="max-inline-size:20rem;"> A quiet-brand filled surface, no border. </lr-card>
  `,
};

export const FilledOutlined: Story = {
  name: 'Filled + outlined',
  render: () => html`
    <lr-card appearance="filled-outlined" style="max-inline-size:20rem;">
      A quiet-brand filled surface that keeps its border.
    </lr-card>
  `,
};

export const Accent: Story = {
  render: () => html`
    <lr-card appearance="accent" style="max-inline-size:20rem;">
      A brand-colored accent stripe on the leading edge instead of a full border.
    </lr-card>
  `,
};

export const Plain: Story = {
  render: () => html`
    <lr-card appearance="plain" style="max-inline-size:20rem;"> No border, no background — layout only. </lr-card>
  `,
};

export const Interactive: Story = {
  render: () => html`
    <lr-card interactive style="max-inline-size:20rem;">
      Hover or focus this card to see the border-color and cursor affordance for a clickable tile.
    </lr-card>
  `,
};

/** `interactive` **without** `href` makes the whole card activatable: `[part="base"]` becomes
 *  focusable, Enter/Space activate it, and `lr-card-activate` fires. A click that originates in a
 *  slotted control (the Edit button, the Details link) is left to that control — the card
 *  deliberately carries no `role="button"`, so its own buttons and links stay real, focusable
 *  controls rather than an axe `nested-interactive` violation. */
export const ActivateWithoutHref: Story = {
  name: 'interactive (no href) — lr-card-activate',
  render: () => html`
    <div>
      <lr-card
        interactive
        style="max-inline-size:20rem;"
        @lr-card-activate=${() => {
          const out = document.getElementById('card-activate-log');
          if (out) out.textContent = `Card activated at ${new Date().toLocaleTimeString()}`;
        }}
      >
        <span slot="header" style="font-weight:600;">Rooftop install No. 4021</span>
        <button
          slot="actions"
          type="button"
          style="border:none;background:none;color:var(--lr-color-brand);font:inherit;font-size:0.75rem;font-weight:600;cursor:pointer;padding:0;"
          @click=${() => {
            const out = document.getElementById('card-activate-log');
            if (out) out.textContent = 'Edit button clicked — the card did NOT activate.';
          }}
        >
          Edit
        </button>
        Click anywhere on the body, or focus the card and press Enter or Space.
        <span slot="footer" style="font-size:0.75rem;"><a href="#details">Details</a></span>
      </lr-card>
      <p id="card-activate-log">Nothing activated yet.</p>
    </div>
  `,
};

export const AsLink: Story = {
  name: 'href (renders as <a>)',
  render: () => html`
    <lr-card href="https://example.com" interactive style="max-inline-size:20rem;">
      The whole card is a real link — inspect the shadow root to see the <code>&lt;a part="base"&gt;</code> root.
    </lr-card>
  `,
};

export const WithAllSlots: Story = {
  name: 'header / media / footer / action slots',
  render: () => html`
    <lr-card style="max-inline-size:20rem;">
      <img
        slot="media"
        src="https://picsum.photos/seed/lr-card/400/200"
        alt=""
        style="inline-size:100%; display:block;"
      />
      <span slot="header" style="font-weight:600;">Rooftop install No. 4021</span>
      <button
        slot="header-actions"
        type="button"
        style="border:none;background:none;color:var(--lr-color-brand);font:inherit;font-size:0.75rem;font-weight:600;cursor:pointer;padding:0;"
        @click=${() => alert('Edit (demo only)')}
      >
        Edit
      </button>
      Body content describing the card in more detail — any content is accepted here.
      <span slot="footer" style="font-size:0.75rem; color:var(--lr-color-text-quiet);">Updated 2 days ago</span>
      <button slot="footer-actions" type="button">Open report</button>
    </lr-card>
  `,
};

export const Horizontal: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Horizontal cards arrange `image`/`media`, the default body, and `actions` in logical order. Their own 30rem container query stacks those sections when the card—not the viewport—gets narrow.',
      },
    },
  },
  render: () => html`
    <lr-card
      orientation="horizontal"
      style="inline-size:42rem; max-inline-size:100%; --spacing:var(--lr-space-s);"
    >
      <div
        slot="image"
        role="img"
        aria-label="Solar panels on a roof"
        style="inline-size:12rem; min-block-size:8rem; background:linear-gradient(135deg, var(--lr-color-brand-quiet), var(--lr-color-surface-raised));"
      ></div>
      <div>
        <strong>Rooftop generation report</strong>
        <p>Review production, storage, and export totals for this installation.</p>
      </div>
      <button slot="actions" type="button">Open</button>
    </lr-card>
  `,
};

export const SsrPresenceHints: Story = {
  name: 'SSR presence hints',
  parameters: {
    docs: {
      description: {
        story:
          '`with-header`, `with-header-actions`, `with-media`, `with-footer`, and `with-footer-actions` expose the corresponding wrappers before slot assignment is measurable. After hydration, populated slots are detected automatically, so the hints may remain in server-rendered markup.',
      },
    },
  },
  render: () => html`
    <lr-card
      with-header
      with-header-actions
      with-media
      with-footer
      with-footer-actions
      style="max-inline-size:24rem;"
    >
      <span slot="header"><strong>Server-rendered report</strong></span>
      <button slot="header-actions" type="button">Pin</button>
      <span slot="media" style="display:block; padding:var(--lr-space-m);">Media placeholder</span>
      The section wrappers are present before hydration and stay synchronized afterward.
      <span slot="footer">Updated just now</span>
      <button slot="footer-actions" type="button">Open</button>
    </lr-card>
  `,
};

export const HeaderOnly: Story = {
  name: 'header slot only (no media/footer)',
  render: () => html`
    <lr-card style="max-inline-size:20rem;">
      <span slot="header" style="font-weight:600;">Untitled document</span>
      Body content with just a header row above it — media and footer stay hidden since nothing is
      slotted into them.
    </lr-card>
  `,
};

export const NarrowHeaderActions: Story = {
  name: 'Narrow header with long content and actions',
  parameters: {
    docs: {
      description: {
        story:
          'At a 320px allocation, long or translated header content wraps and the actions group can move to another line without overflowing the card.',
      },
    },
  },
  render: () => html`
    <lr-card style="inline-size:320px; max-inline-size:100%;">
      <span slot="header" style="font-weight:600;">
        Vierteljährliche Energieerzeugungsprognose für die Dachanlage
      </span>
      <span slot="actions">
        <button type="button">Review</button>
        <button type="button">Share</button>
      </span>
      Body content remains within the same narrow allocation.
    </lr-card>
  `,
};
