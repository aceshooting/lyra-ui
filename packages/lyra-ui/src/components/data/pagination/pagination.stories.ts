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

function controlledPagination(total = 237) {
  return html`<lr-pagination
    total=${total}
    page-size="20"
    @lr-page-change=${(event: CustomEvent<{ page: number }>) => {
      (event.currentTarget as LyraPagination).page = event.detail.page;
    }}
  ></lr-pagination>`;
}

function controlled(template: (apply: (event: Event) => void) => unknown) {
  return template((event: Event) => {
    const detail = (event as CustomEvent<{ page: number }>).detail;
    (event.currentTarget as LyraPagination).page = detail.page;
  });
}

export const Default: Story = {
  render: () => controlledPagination(),
};

/** `focus()` and `blur()` target the editable page-jump input of the compact layout, and surface
 *  host focus events. */
/** The default `standard` layout: every page is its own control, with elided runs collapsed into a
 *  decorative gap so the control keeps a constant width as the reader pages through. */
export const Elided: Story = {
  render: () =>
    controlled(
      (apply) => html`<lr-pagination
        total="4000"
        page-size="20"
        page="87"
        with-edges
        with-summary
        @lr-page-change=${apply}
      ></lr-pagination>`,
    ),
};

/** `sibling-count` widens the window around the current page; `boundary-count` pins more pages at
 *  each end. */
export const WindowSize: Story = {
  name: 'Window size (sibling-count / boundary-count)',
  render: () => html`
    <div style="display: grid; gap: 1rem; justify-items: start;">
      ${controlled(
        (apply) => html`<lr-pagination
          total="400"
          page-size="20"
          page="10"
          sibling-count="0"
          boundary-count="1"
          @lr-page-change=${apply}
        ></lr-pagination>`,
      )}
      ${controlled(
        (apply) => html`<lr-pagination
          total="400"
          page-size="20"
          page="10"
          sibling-count="3"
          boundary-count="2"
          @lr-page-change=${apply}
        ></lr-pagination>`,
      )}
    </div>
  `,
};

/** Every resting look. The applied page stays a solid brand chip in all of them. */
export const Appearance: Story = {
  render: () => html`
    <div style="display: grid; gap: 1rem; justify-items: start;">
      ${['accent', 'filled', 'outlined', 'filled-outlined', 'plain'].map((appearance) =>
        controlled(
          (apply) => html`<lr-pagination
            total="200"
            page-size="20"
            page="4"
            appearance=${appearance}
            @lr-page-change=${apply}
          ></lr-pagination>`,
        ),
      )}
    </div>
  `,
};

/** With `href-template`, each page renders as a real link, so the pager works before hydration and
 *  is crawlable. The current page deliberately has no `href` -- the reader is already there. */
export const Links: Story = {
  render: () => html`
    <lr-pagination
      total="200"
      page-size="20"
      page="3"
      with-edges
      href-template="#page/{page}"
    ></lr-pagination>
  `,
};

/** `format="compact"` swaps the page list for the editable page-jump field, for toolbars and card
 *  footers where a full list does not fit. */
export const Compact: Story = {
  render: () =>
    controlled(
      (apply) => html`<lr-pagination
        format="compact"
        total="237"
        page-size="20"
        with-summary
        @lr-page-change=${apply}
      ></lr-pagination>`,
    ),
};

export const ProgrammaticFocus: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; justify-items: start;">
      ${controlled(
        (apply) => html`<lr-pagination
          format="compact"
          total="237"
          page-size="20"
          @lr-page-change=${apply}
        ></lr-pagination>`,
      )}
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
      total="237"
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
    <lr-pagination total="237" page-size="20" page="4" loading></lr-pagination>
  `,
};

export const ControlPadding: Story = {
  name: 'Control padding (--lr-pagination-control-padding)',
  parameters: {
    docs: {
      description: {
        story:
          'The nav buttons and page input share `--lr-pagination-control-padding` for their inner inset. The control footprint stays fixed by `--lr-pagination-control-size`, so raising the padding tightens the icon/digit rather than growing the button.',
      },
    },
  },
  render: () => html`
    <lr-pagination
      format="compact"
      total="237"
      page-size="20"
      page="4"
      style="--lr-pagination-control-padding: 0.5rem"
    ></lr-pagination>
  `,
};
