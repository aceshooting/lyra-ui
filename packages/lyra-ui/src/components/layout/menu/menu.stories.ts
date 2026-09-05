import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './menu.js';
import './menu-item.js';
import './menu-label.js';
import type { MenuItemSelectDetail } from './menu.js';

const meta: Meta = {
  title: 'Menu',
  component: 'lr-menu',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The inline semantic menu mapped from `sl-menu`: a named `role="menu"`, real roving focus, nested submenus, and one cancelable `lr-select` event. Omit `label` for the localized menu name; every supplied string, including an empty one, stays literal. Wrap it in `<lr-dropdown>` when the interaction needs a trigger, positioned popup, open state, or overlay lifecycle.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const BackgroundItemChange: Story = {
  parameters: { docs: { description: { story: 'Focus the middle item, then use the outside button to disable it. The roving stop repairs while focus remains on the button. Header/footer controls also keep their focus during item updates. Menu labels are sibling visual captions; selectable items stay directly enrolled.' } } },
  render: () => html`<section>
    <button @click=${(event: Event) => {
      const item = (event.currentTarget as HTMLElement).parentElement!.querySelector('lr-menu-item[value="middle"]')!;
      item.toggleAttribute('disabled');
    }}>Toggle middle availability</button>
    <lr-menu><button slot="header">Header action</button><lr-menu-label>Actions</lr-menu-label>
      <lr-menu-item>First</lr-menu-item><lr-menu-item value="middle">Middle</lr-menu-item><lr-menu-item>Last</lr-menu-item>
      <button slot="footer">Footer action</button></lr-menu>
  </section>`,
};

/** The exact Shoelace authoring shape after a mechanical `sl-` → `lr-` rename. */
export const StandaloneMappedMenu: Story = {
  render: () => html`
    <lr-menu label="File actions">
      <lr-menu-label>File</lr-menu-label>
      <lr-menu-item value="open">Open…</lr-menu-item>
      <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
      <lr-menu-item value="delete" variant="danger">Delete</lr-menu-item>
    </lr-menu>
  `,
};

/** Disabled and loading items remain visible but are skipped by navigation and activation. */
export const WithUnavailableItems: Story = {
  render: () => html`
    <lr-menu label="Document actions">
      <lr-menu-item value="download">Download</lr-menu-item>
      <lr-menu-item value="share" disabled>Share (requires admin)</lr-menu-item>
      <lr-menu-item value="export" loading>Preparing export</lr-menu-item>
      <lr-menu-item value="delete" variant="danger">Delete</lr-menu-item>
    </lr-menu>
  `,
};

/** Named regions keep composed controls outside the role=menu child list. */
export const HeaderFooterComposition: Story = {
  render: () => html`
    <lr-menu label="Filtered actions" style="inline-size: 18rem;">
      <label slot="header" style="display: grid; gap: var(--lr-space-xs);">
        Filter
        <input
          type="search"
          placeholder="Filter actions…"
          style="box-sizing: border-box; inline-size: 100%;"
        />
      </label>
      <lr-menu-item value="rename">Rename</lr-menu-item>
      <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
      <lr-menu-item value="delete" variant="danger">Delete</lr-menu-item>
      <small slot="footer">3 actions</small>
    </lr-menu>
  `,
};

/** Listen once on the menu. The complete selected item remains available in `detail.item`. */
export const SelectEvent: Story = {
  render: () => html`
    <div
      data-menu-select-example
      style="display: grid; gap: var(--lr-space-s); inline-size: 18rem;"
    >
      <lr-menu
        label="Row actions"
        @lr-select=${(event: CustomEvent<MenuItemSelectDetail>) => {
          const example = (
            event.currentTarget as HTMLElement
          ).closest<HTMLElement>('[data-menu-select-example]');
          const status = example?.querySelector<HTMLOutputElement>(
            '[data-menu-select-status]'
          );
          if (status) status.value = `Selected: ${event.detail.item.value}`;
        }}
      >
        <lr-menu-item value="rename">Rename</lr-menu-item>
        <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
        <lr-menu-item value="delete" variant="danger">Delete</lr-menu-item>
      </lr-menu>
      <output data-menu-select-status aria-live="polite"
        >Selected: (none yet)</output
      >
    </div>
  `,
};

/** Nested selections bubble as the same single event; submenus use logical-direction keys. */
export const NestedSubmenus: Story = {
  render: () => html`
    <lr-menu label="Row actions">
      <lr-menu-item value="rename">Rename</lr-menu-item>
      <lr-menu-item value="share">
        Share
        <lr-menu slot="submenu" label="Share options">
          <lr-menu-item value="share-email">Email</lr-menu-item>
          <lr-menu-item value="share-link">Copy link</lr-menu-item>
          <lr-menu-item value="share-more">
            More
            <lr-menu slot="submenu" label="More sharing options">
              <lr-menu-item value="share-teams">Teams</lr-menu-item>
              <lr-menu-item value="share-embed">Embed code</lr-menu-item>
            </lr-menu>
          </lr-menu-item>
        </lr-menu>
      </lr-menu-item>
      <lr-menu-item value="delete" variant="danger">Delete</lr-menu-item>
    </lr-menu>
  `,
};

export const NarrowLongContent: Story = {
  name: 'Narrow long content LTR/RTL (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'Paired 320px LTR and RTL allocations keep long localized rows inside the inline surface.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m);">
      ${(['ltr', 'rtl'] as const).map(
        (direction) => html`
          <div
            dir=${direction}
            style="inline-size: 320px; max-inline-size: 100%;"
          >
            <lr-menu
              label=${direction === 'rtl'
                ? 'إجراءات المستند'
                : 'Document actions'}
            >
              <lr-menu-item value="rename"
                >${direction === 'rtl'
                  ? 'عنوانإجراءمحليطويلجداًبدونأيفرصةللفصلالتلقائي'
                  : 'InternationalizedMenuItemWithoutAnyNaturalBreakOpportunity'}</lr-menu-item
              >
              <lr-menu-item value="archive"
                >${direction === 'rtl'
                  ? 'أرشفةالمستنداتذاتالعناوينالمحليةالطويلةجداً'
                  : 'InternationalizedSecondaryMenuItemWithoutAnyNaturalBreakOpportunity'}</lr-menu-item
              >
            </lr-menu>
          </div>
        `
      )}
    </div>
  `,
};
