import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './menu-item.js';
import './menu.js';
import type { MenuItemSelectDetail } from './menu.js';

const meta: Meta = {
  title: 'Navigation/Menu item',
  component: 'lr-menu-item',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    html`<lr-menu label="File actions"
      ><lr-menu-item value="save">Save</lr-menu-item></lr-menu
    >`,
};

export const HostClick: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'Calling `click()` on the focusable host follows the same activation path as a pointer. Selection is published once by the owning menu.',
      },
    },
  },
  render: () => html`
    <div
      data-host-click-example
      style="display: grid; gap: var(--lr-space-s); inline-size: 18rem;"
    >
      <lr-menu
        label="Programmatic activation"
        @lr-select=${(event: CustomEvent<MenuItemSelectDetail>) => {
          const example = (
            event.currentTarget as HTMLElement
          ).closest<HTMLElement>('[data-host-click-example]');
          const status = example?.querySelector<HTMLOutputElement>(
            '[data-host-click-status]'
          );
          if (status)
            status.value = `${event.detail.item.textContent?.trim()} selected`;
        }}
      >
        <lr-menu-item value="archive">Archive</lr-menu-item>
      </lr-menu>
      <button
        type="button"
        @click=${(event: Event) => {
          const example = (
            event.currentTarget as HTMLElement
          ).closest<HTMLElement>('[data-host-click-example]');
          example?.querySelector<HTMLElement>('lr-menu-item')?.click();
        }}
      >
        Call item.click()
      </button>
      <output data-host-click-status aria-live="polite"
        >Waiting for selection</output
      >
    </div>
  `,
};

/** A listener can reject a proposed checkbox state while the canonical menu action still fires. */
export const CancelableCheckboxChange: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'Checkbox activation first emits cancelable `lr-menu-item-change`. Preventing it retains `checked`; the owning menu still emits its usual `lr-select` action.',
      },
    },
  },
  render: () => html`
    <div
      data-checkbox-change-example
      style="display: grid; gap: var(--lr-space-s); inline-size: 18rem;"
    >
      <lr-menu
        label="View options"
        @lr-select=${(event: CustomEvent<MenuItemSelectDetail>) => {
          const example = (
            event.currentTarget as HTMLElement
          ).closest<HTMLElement>('[data-checkbox-change-example]');
          const status = example?.querySelector<HTMLOutputElement>(
            '[data-checkbox-change-status]'
          );
          if (status)
            status.value = `${status.value} · ${event.detail.item.value} selected`;
        }}
      >
        <lr-menu-item
          type="checkbox"
          value="wrap"
          @lr-menu-item-change=${(event: Event) => {
            const example = (
              event.currentTarget as HTMLElement
            ).closest<HTMLElement>('[data-checkbox-change-example]');
            const status = example?.querySelector<HTMLOutputElement>(
              '[data-checkbox-change-status]'
            );
            const { checked } = (event as CustomEvent<{ checked: boolean }>)
              .detail;
            if (checked) event.preventDefault();
            if (status)
              status.value = checked
                ? 'Proposed checked state was prevented'
                : 'Unchecked state accepted';
          }}
          >Wrap text</lr-menu-item
        >
      </lr-menu>
      <output data-checkbox-change-status aria-live="polite"
        >Activate “Wrap text”</output
      >
    </div>
  `,
};

export const VisualSlots: StoryObj = {
  render: () => html`
    <lr-menu label="Document actions" style="inline-size: 18rem;">
      <lr-menu-item value="rename">
        <span slot="icon">✏️</span>
        <span slot="prefix">File</span>
        Rename
        <span slot="details">⌘R</span>
        <span slot="suffix">…</span>
      </lr-menu-item>
    </lr-menu>
  `,
};

export const Sizes: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'The shared six-step ladder scales row height, padding, and type together. Long aliases map to the corresponding short tier.',
      },
    },
  },
  render: () => html`
    <lr-menu label="Sizes" style="inline-size: 18rem;">
      <lr-menu-item size="2xs" value="a">2x extra small</lr-menu-item>
      <lr-menu-item size="xs" value="b">Extra small</lr-menu-item>
      <lr-menu-item size="s" value="c">Small</lr-menu-item>
      <lr-menu-item size="m" value="d">Medium (default)</lr-menu-item>
      <lr-menu-item size="l" value="e">Large</lr-menu-item>
      <lr-menu-item size="xl" value="f">Extra large</lr-menu-item>
    </lr-menu>
  `,
};

export const ThemedRowChrome: StoryObj = {
  name: 'Themed row chrome (cssprops)',
  render: () => html`
    <lr-menu
      label="Themed document actions"
      style="--lr-menu-item-gap: var(--lr-space-m); --lr-menu-item-radius: var(--lr-radius-pill); inline-size: 18rem;"
    >
      <lr-menu-item value="rename">
        <span slot="icon">✏️</span>
        Rename
        <span slot="details">⌘R</span>
      </lr-menu-item>
    </lr-menu>
  `,
};

export const ThemedDangerState: StoryObj = {
  name: 'Themed danger state (cssprops)',
  render: () => html`
    <lr-menu
      label="Themed dangerous actions"
      style="--lr-menu-item-danger-color: var(--lr-color-warning); --lr-menu-item-danger-hover-bg: var(--lr-color-warning-quiet); --lr-menu-item-danger-active-bg: var(--lr-color-brand-quiet); inline-size: 18rem;"
    >
      <lr-menu-item value="rename">Rename</lr-menu-item>
      <lr-menu-item variant="danger" value="delete">Delete</lr-menu-item>
    </lr-menu>
  `,
};

export const SubmenuOffset: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'Activate Share to inspect a submenu whose final logical separation uses a positive `--submenu-offset` override.',
      },
    },
  },
  render: () => html`
    <lr-menu
      label="Share actions"
      style="inline-size: 12rem; margin: var(--lr-space-2xl);"
    >
      <lr-menu-item value="share" style="--submenu-offset: var(--lr-space-l);">
        Share
        <lr-menu slot="submenu" label="Share options">
          <lr-menu-item value="email">Email</lr-menu-item>
          <lr-menu-item value="link">Copy link</lr-menu-item>
        </lr-menu>
      </lr-menu-item>
    </lr-menu>
  `,
};

export const NarrowLongContent: StoryObj = {
  name: 'Narrow long content LTR/RTL (320px)',
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m);">
      ${(['ltr', 'rtl'] as const).map(
        (direction) => html`
          <lr-menu
            dir=${direction}
            label="Document actions"
            style="inline-size: 320px; max-inline-size: 100%;"
          >
            <lr-menu-item value=${direction}>
              <span slot="icon" aria-hidden="true">✎</span>
              ${direction === 'rtl'
                ? 'عنوانإجراءقائمةمحليطويلجداًبدونأيفرصةللفصلالتلقائي'
                : 'InternationalizedMenuItemLabelWithoutAnyNaturalBreakOpportunity'}
              <span slot="details">⌘R</span>
            </lr-menu-item>
          </lr-menu>
        `
      )}
    </div>
  `,
};
