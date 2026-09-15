import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, render } from 'lit';
import './reorder-list.js';
import './reorder-item.js';
import type { LyraReorderList } from './reorder-list.js';

const meta: Meta = {
  title: 'Primitives/Reorder List',
  component: 'lr-reorder-list',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A generic flat-list reorder primitive: per-row move-up/move-down buttons, plus Ctrl/Cmd+ArrowUp/ArrowDown from focus inside a row. Emits `lr-reorder` with the full new order so the host can persist it without hand-rolled splice/resort logic.',
      },
    },
  },
};
export default meta;

export const CorrectedIdentity: StoryObj = {
  parameters: { docs: { description: { story: 'The middle row begins with a duplicate value. Correcting its value enables its movement buttons; making it duplicate again disables them without reordering any row.' } } },
  render: () => html`<section>
    <button @click=${(event: Event) => {
      const item = (event.currentTarget as HTMLElement).parentElement!.querySelector('lr-reorder-item[data-middle]')!;
      item.setAttribute('value', item.getAttribute('value') === 'b' ? 'a' : 'b');
    }}>Toggle duplicate identity</button>
    <lr-reorder-list><lr-reorder-item value="a">A</lr-reorder-item><lr-reorder-item data-middle value="a">B</lr-reorder-item><lr-reorder-item value="c">C</lr-reorder-item></lr-reorder-list>
  </section>`,
};

export const Default: StoryObj = {
  render: () => html`
    <lr-reorder-list
      label="Form fields"
      style="max-width: 20rem;"
      @lr-reorder=${(e: CustomEvent) => console.log('lr-reorder', e.detail)}
    >
      <lr-reorder-item value="name">Name</lr-reorder-item>
      <lr-reorder-item value="email">Email</lr-reorder-item>
      <lr-reorder-item value="phone">Phone</lr-reorder-item>
      <lr-reorder-item value="address">Address</lr-reorder-item>
    </lr-reorder-list>
  `,
};

export const WithADisabledRow: StoryObj = {
  render: () => html`
    <lr-reorder-list label="Form fields" style="max-width: 20rem;">
      <lr-reorder-item value="name">Name</lr-reorder-item>
      <lr-reorder-item value="email" disabled>Email (locked)</lr-reorder-item>
      <lr-reorder-item value="phone">Phone</lr-reorder-item>
    </lr-reorder-list>
  `,
};

export const ListDisabled: StoryObj = {
  render: () => html`
    <lr-reorder-list label="Form fields" disabled style="max-width: 20rem;">
      <lr-reorder-item value="name">Name</lr-reorder-item>
      <lr-reorder-item value="email">Email</lr-reorder-item>
    </lr-reorder-list>
  `,
};

export const CancelableMove: StoryObj = {
  name: 'Cancelable move (async persistence)',
  render: () => html`
    <lr-reorder-list
      label="Steps (async persist)"
      style="max-width: 20rem;"
      @lr-reorder=${(e: CustomEvent) => {
        e.preventDefault();
        const list = e.target as LyraReorderList;
        // Simulate a network round trip: 50% chance of failure, so the story demonstrates both
        // finalizePendingMove() and revertPendingMove().
        setTimeout(() => {
          if (Math.random() < 0.5) list.finalizePendingMove();
          else list.revertPendingMove();
        }, 800);
      }}
    >
      <lr-reorder-item value="name">Name</lr-reorder-item>
      <lr-reorder-item value="email">Email</lr-reorder-item>
      <lr-reorder-item value="phone">Phone</lr-reorder-item>
    </lr-reorder-list>
  `,
};

export const Controlled: StoryObj = {
  name: 'Controlled (host-owned order)',
  parameters: {
    docs: {
      description: {
        story:
          'Setting `controlled` stops the list from moving its own slotted rows itself: the host reorders its own backing array and re-renders, and the list reconciles the completed move by each row\'s `value` once that render lands -- the same request/reconcile-later contract `<lr-tree>`\'s `reorderable` establishes for its own `data`-driven children. This story\'s host re-render is deliberately a plain non-keyed `Array.map()`, which reuses each POSITION\'s existing `<lr-reorder-item>` and just rewrites its `value` property rather than moving any node -- reconciliation still finds the moved row by that value.',
      },
    },
  },
  render: () => {
    let order = ['name', 'email', 'phone', 'address'];
    const labels: Record<string, string> = {
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
    };
    const template = (): unknown => html`
      <lr-reorder-list
        controlled
        label="Form fields (controlled)"
        style="max-width: 20rem;"
        @lr-reorder=${(e: Event) => {
          order = (e as CustomEvent<{ order: readonly string[] }>).detail.order.slice();
          const root = (e.currentTarget as HTMLElement).parentElement;
          // Storybook's `render()` return value isn't reactive on its own -- force a re-render
          // of this story's own root the same way the table stories do.
          if (root) render(template(), root);
        }}
      >
        ${order.map((value) => html`<lr-reorder-item .value=${value}>${labels[value]}</lr-reorder-item>`)}
      </lr-reorder-list>
    `;
    return template();
  },
};

export const NarrowLongContent: StoryObj = {
  name: 'Narrow long content LTR/RTL (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'Exact 320px LTR and RTL allocations keep long localized rows and both movement controls visible. Reordering remains a block-direction action, so the same controls apply in either direction.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m);">
      ${(['ltr', 'rtl'] as const).map(
        (direction) => html`
          <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
            <lr-reorder-list label=${direction === 'rtl' ? 'حقول النموذج' : 'Form fields'} style="inline-size: 100%;">
              <lr-reorder-item value="first"
                >${direction === 'rtl'
                  ? 'حقلنموذجمحليطويلجداًبدونأيفرصةللفصلالتلقائي'
                  : 'InternationalizedReorderListRowWithoutAnyNaturalBreakOpportunity'}</lr-reorder-item
              >
              <lr-reorder-item value="second"
                >${direction === 'rtl'
                  ? 'حقلنموذجثانيمحليطويلجداًبدونأيفرصةللفصلالتلقائي'
                  : 'InternationalizedSecondaryReorderListRowWithoutAnyNaturalBreakOpportunity'}</lr-reorder-item
              >
            </lr-reorder-list>
          </div>
        `,
      )}
    </div>
  `,
};
