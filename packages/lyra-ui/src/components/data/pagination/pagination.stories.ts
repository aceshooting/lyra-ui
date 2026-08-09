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
    @lr-page-change=${(event: CustomEvent<{ page: number; pageSize: number }>) => {
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
/** The default `standard` layout: every page is its own control, with elided runs collapsed into an
 *  interactive jump so the control keeps a constant width as the reader pages through. */
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
      ></lr-pagination>`
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
        ></lr-pagination>`
      )}
      ${controlled(
        (apply) => html`<lr-pagination
          total="400"
          page-size="20"
          page="10"
          sibling-count="3"
          boundary-count="2"
          @lr-page-change=${apply}
        ></lr-pagination>`
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
          ></lr-pagination>`
        )
      )}
    </div>
  `,
};

/** `size` runs the library-wide six-step ladder. Web Awesome's and Shoelace's
 *  `small`/`medium`/`large` are accepted as exact synonyms of `s`/`m`/`l`, so a migrated pager
 *  needs no attribute rewrite. Every control still clears the shared 40px hit-area floor at the
 *  smallest tiers -- only the type scale tightens. */
export const Sizes: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; justify-items: start;">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`<lr-pagination size=${size} total="200" page-size="20" page="3"></lr-pagination>`
      )}
      ${(['small', 'medium', 'large'] as const).map(
        (size) => html`<lr-pagination size=${size} total="200" page-size="20" page="3"></lr-pagination>`
      )}
    </div>
  `,
};

/** With `href-template`, page, ellipsis, previous/next, and first/last controls render as real
 *  links, so the whole pager works before hydration and is crawlable. The current and unavailable
 *  controls deliberately have no `href`. */
export const Links: Story = {
  render: () => html`
    <lr-pagination total="200" page-size="20" page="3" with-edges href-template="#page/{page}"></lr-pagination>
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
      ></lr-pagination>`
    ),
};

export const CancelableRequest: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`lr-before-page-change` carries `{ page, pageSize }` and can veto a request before the ordinary controlled `lr-page-change` intent fires. This example refuses even-numbered pages.',
      },
    },
  },
  render: () => html`
    <div>
      <lr-pagination
        total="237"
        @lr-before-page-change=${(event: CustomEvent<{ page: number; pageSize: number }>) => {
          if (event.detail.page % 2 === 0) event.preventDefault();
        }}
        @lr-page-change=${(event: CustomEvent<{ page: number; pageSize: number }>) => {
          (event.currentTarget as LyraPagination).page = event.detail.page;
        }}
      ></lr-pagination>
      <p>Even page requests are vetoed; odd pages remain controlled by the listener.</p>
    </div>
  `,
};

export const CustomNavigationIcons: Story = {
  render: () => html`
    <lr-pagination total="237" page="4" with-edges>
      <span slot="first-icon" aria-hidden="true">⇤</span>
      <span slot="previous-icon" aria-hidden="true">←</span>
      <span slot="next-icon" aria-hidden="true">→</span>
      <span slot="last-icon" aria-hidden="true">⇥</span>
    </lr-pagination>
  `,
};

export const VisibilityFlags: Story = {
  render: () => html`
    <div style="display:grid; gap:var(--lr-space-m); justify-items:start;">
      <lr-pagination total="237" page="4" without-nav with-edges></lr-pagination>
      <lr-pagination total="5" hide-single-page></lr-pagination>
      <p>The second pager renders nothing because its default page size yields one page.</p>
    </div>
  `,
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
        ></lr-pagination>`
      )}
      <button
        type="button"
        @click=${(event: Event) => {
          const pagination = (event.currentTarget as HTMLElement).parentElement!.querySelector(
            'lr-pagination'
          ) as LyraPagination;
          pagination.focus();
        }}
      >
        Focus the page field
      </button>
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
  render: () => html` <lr-pagination total="237" page-size="20" page="4" loading></lr-pagination> `,
};

/** The public `disabled` property also publishes `:state(disabled)` for host-level theming. The
 * separate loading and empty-data conditions disable the controls without claiming that state. */
export const Disabled: Story = {
  render: () => html` <lr-pagination total="237" page-size="20" page="4" disabled></lr-pagination> `,
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

export const RetunedLayoutGaps: Story = {
  name: 'Retuned layout gaps',
  parameters: {
    docs: {
      description: {
        story:
          'The summary-to-controls, control-group, and numbered-page gaps are independently inheritable. The same hooks remain active when the exact 320px container layout wraps.',
      },
    },
  },
  render: () => html`
    <div
      style="
        inline-size: 320px;
        max-inline-size: 100%;
        --lr-pagination-base-gap: var(--lr-space-2xl);
        --lr-pagination-controls-gap: var(--lr-space-l);
        --lr-pagination-pages-gap: var(--lr-space-s);
      "
    >
      <lr-pagination total="237" page-size="20" page="4" with-summary></lr-pagination>
    </div>
  `,
};

export const RetintedControlStates: Story = {
  name: 'Retinted control states',
  parameters: {
    docs: {
      description: {
        story:
          'Resting, current, hover, and pressed longhands inherit independent pagination hooks. Hover and press ordinary and current page controls to inspect each state.',
      },
    },
  },
  render: () => html`
    <div
      style="
        --lr-pagination-control-bg: var(--lr-color-surface-raised);
        --lr-pagination-control-border-color: var(--lr-color-success);
        --lr-pagination-control-color: var(--lr-color-success);
        --lr-pagination-current-bg: var(--lr-color-success);
        --lr-pagination-current-border-color: var(--lr-color-success);
        --lr-pagination-current-color: var(--lr-color-on-success);
        --lr-pagination-hover-bg: var(--lr-color-success-quiet);
        --lr-pagination-hover-border-color: var(--lr-color-success);
        --lr-pagination-active-bg: var(--lr-color-warning-quiet);
        --lr-pagination-active-border-color: var(--lr-color-warning);
        --lr-pagination-current-hover-bg: var(--lr-color-warning);
        --lr-pagination-current-hover-border-color: var(--lr-color-warning);
        --lr-pagination-current-active-bg: var(--lr-color-danger);
        --lr-pagination-current-active-border-color: var(--lr-color-danger);
      "
    >
      <lr-pagination total="237" page-size="20" page="4" with-summary></lr-pagination>
    </div>
  `,
};
