import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraPagination } from './pagination.js';

const meta: Meta = {
  title: 'Pagination',
  component: 'lr-pagination',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

function controlledPagination(totalItems = 237) {
  return html`<lr-pagination
    total-items=${totalItems}
    page-size="20"
    @lr-page-change=${(event: CustomEvent<{ page: number }>) => {
      (event.currentTarget as LyraPagination).page = event.detail.page;
    }}
  ></lr-pagination>`;
}

export const Default: Story = {
  render: () => controlledPagination(),
};

/** `focus()` and `blur()` target the editable page-jump input and surface host focus events. */
export const ProgrammaticFocus: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; justify-items: start;">
      ${controlledPagination()}
      <button
        type="button"
        @click=${(event: Event) => {
          const pagination = (event.currentTarget as HTMLElement).parentElement!.querySelector(
            'lr-pagination',
          ) as LyraPagination;
          pagination.focus();
        }}
      >Focus the page field</button>
    </div>
  `,
};

export const NarrowAllocation: Story = {
  render: () => html`<div style="inline-size: 18rem">
    <lr-pagination
      total-items="237"
      page-size="20"
      previous-label="Zur vorherigen Ergebnisseite wechseln"
      next-label="Zur nächsten Ergebnisseite wechseln"
      .strings=${{
        paginationSummary: '{start}–{end} von insgesamt {total} {itemLabel}',
      }}
      @lr-page-change=${(event: CustomEvent<{ page: number }>) => {
        (event.currentTarget as LyraPagination).page = event.detail.page;
      }}
    ></lr-pagination>
  </div>`,
};

export const Empty: Story = {
  render: () => html`<lr-pagination></lr-pagination>`,
};

export const Loading: Story = {
  render: () => html`
    <lr-pagination total-items="237" page-size="20" page="4" loading></lr-pagination>
  `,
};
