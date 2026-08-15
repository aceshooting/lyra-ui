import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './virtual-list.js';
import type { LyraVirtualList } from './virtual-list.js';
import type { VirtualListIndexedSource } from './virtual-list.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

interface DemoMessage {
  id: string;
  author: string;
  text: string;
}

function buildMessages(count: number): DemoMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    author: i % 2 === 0 ? 'Alex' : 'Assistant',
    text:
      i % 7 === 0
        ? `Message ${i} -- this one runs quite a bit longer than the others, wrapping across several lines so the auto row-height measurement path actually has varying heights to reconcile instead of every row being identical.`
        : `Message ${i}`,
  }));
}

const messages = buildMessages(2000);

const indexedMessages: VirtualListIndexedSource<DemoMessage> = {
  count: 100_000,
  itemAt(index) {
    return {
      id: `indexed-${index}`,
      author: index % 2 === 0 ? 'Alex' : 'Assistant',
      text: `Synthetic message ${index + 1}`,
    };
  },
  keyAt(index) {
    return `indexed-${index}`;
  },
  indexOfKey(key) {
    if (typeof key !== 'string') return -1;
    const match = /^indexed-(\d+)$/.exec(key);
    return match ? Number(match[1]) : -1;
  },
};

const narrowMessages: DemoMessage[] = [
  {
    id: 'narrow-long',
    author: 'Alex',
    text: `This deliberately unbroken value wraps in an ordinary auto-height row: ${'x'.repeat(160)}`,
  },
  {
    id: 'narrow-following',
    author: 'Assistant',
    text: 'The measured first row leaves this following item at its correct offset.',
  },
];

const renderMessage = (item: unknown, index: number) => {
  const m = item as DemoMessage;
  return html`
    <div style="display:flex; gap:0.5rem; padding:0.5rem 0.75rem; border-block-end:1px solid var(--lr-color-border);">
      <strong style="flex:0 0 auto; min-inline-size:5rem;">${m.author}</strong>
      <span>#${index} — ${m.text}</span>
    </div>
  `;
};

const keyFunction = (item: unknown) => (item as DemoMessage).id;

const meta: Meta = {
  title: 'VirtualList',
  component: 'lr-virtual-list',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A windowed/virtualized list host -- only the rows within the viewport (plus `overscan` padding) are ever real DOM, regardless of how large `items` is. Array-valued items/source sequences are copied, bounded, and frozen while retaining generic row identity; reassign a new array after sequence changes.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-virtual-list
      style="max-width: 32rem; --lr-virtual-list-height: 20rem;"
      .items=${messages}
      .renderItem=${renderMessage}
      .keyFunction=${keyFunction}
    ></lr-virtual-list>
  `,
};

export const FixedRowHeight: Story = {
  render: () => html`
    <lr-virtual-list
      style="max-width: 32rem; --lr-virtual-list-height: 20rem;"
      row-height="56"
      .items=${messages}
      .renderItem=${renderMessage}
      .keyFunction=${keyFunction}
    ></lr-virtual-list>
  `,
};

/** A count/index source renders 100,000 synthetic rows without first allocating 100,000 items. */
export const IndexedSource: Story = {
  render: () => html`
    <lr-virtual-list
      style="max-width: 32rem; --lr-virtual-list-height: 20rem;"
      row-height="56"
      active-id="indexed-90000"
      .source=${indexedMessages}
      .renderItem=${renderMessage}
    ></lr-virtual-list>
  `,
};

export const WideOverscan: Story = {
  render: () => html`
    <lr-virtual-list
      style="max-width: 32rem; --lr-virtual-list-height: 20rem;"
      overscan="20"
      .items=${messages}
      .renderItem=${renderMessage}
      .keyFunction=${keyFunction}
    ></lr-virtual-list>
  `,
};

export const Empty: Story = {
  render: () => html`
    <lr-virtual-list
      style="max-width: 32rem; --lr-virtual-list-height: 20rem;"
      .items=${[]}
      .renderItem=${renderMessage}
      .keyFunction=${keyFunction}
    ></lr-virtual-list>
  `,
};

/** The hover preview's width, style, color, and inward offset can be themed separately without
 *  changing the focus ring or adding a pressed state to the scrollport. */
export const ThemedHoverOutline: Story = {
  name: 'Themed hover outline (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Hover the scroll region to see `--lr-virtual-list-hover-outline-width`, `--lr-virtual-list-hover-outline-style`, `--lr-virtual-list-hover-outline-color`, and `--lr-virtual-list-hover-outline-offset` inherited from its ancestor. Pressing the scrollport intentionally keeps the same hover preview: it is a scroll region, not an action.',
      },
    },
  },
  render: () => html`
    <div
      style="max-inline-size: 32rem; --lr-virtual-list-hover-outline-width: var(--lr-border-width-thick); --lr-virtual-list-hover-outline-style: dashed; --lr-virtual-list-hover-outline-color: ${storyColor(
        'warning',
      )}; --lr-virtual-list-hover-outline-offset: calc(-1 * var(--lr-border-width-thick));"
    >
      <lr-virtual-list
        aria-label="Themed hover outline"
        style="--lr-virtual-list-height: 12rem;"
        .items=${messages.slice(0, 24)}
        .renderItem=${renderMessage}
        .keyFunction=${keyFunction}
      ></lr-virtual-list>
    </div>
  `,
};

/**
 * At a 320px allocation, ordinary long row content wraps and the default auto-height measurement
 * follows the resulting height in both text directions. Consumer content that intentionally sets
 * `white-space: nowrap` instead retains a horizontal scrollport on the list.
 */
export const NarrowLongRows: Story = {
  render: () => html`
    <div style="display:grid; gap:var(--lr-space-l);">
      <section>
        <h3>LTR</h3>
        <lr-virtual-list
          aria-label="Narrow long rows, left-to-right"
          style="inline-size:320px; max-inline-size:100%; --lr-virtual-list-height:12rem;"
          .items=${narrowMessages}
          .renderItem=${renderMessage}
          .keyFunction=${keyFunction}
        ></lr-virtual-list>
      </section>
      <section dir="rtl">
        <h3>RTL</h3>
        <lr-virtual-list
          aria-label="Narrow long rows, right-to-left"
          style="inline-size:320px; max-inline-size:100%; --lr-virtual-list-height:12rem;"
          .items=${narrowMessages}
          .renderItem=${renderMessage}
          .keyFunction=${keyFunction}
        ></lr-virtual-list>
      </section>
    </div>
  `,
};

/** A consumer can keep intentionally unbroken content on one horizontal scrollport. */
export const NarrowNoWrapOptOut: Story = {
  render: () => html`
    <lr-virtual-list
      aria-label="Narrow no-wrap row"
      style="inline-size:320px; max-inline-size:100%; --lr-virtual-list-height:8rem;"
      .items=${[narrowMessages[0]]}
      .renderItem=${(item: unknown) => html`
        <span style="white-space:nowrap">${(item as DemoMessage).text}</span>
      `}
      .keyFunction=${keyFunction}
    ></lr-virtual-list>
  `,
};

/** `active-id` smoothly scrolls the matching row into view -- click a button to jump. */
export const ScrollToActive: Story = {
  render: () => {
    const setActive = (id: string) => {
      const list = document.getElementById('active-demo-list') as LyraVirtualList;
      list.activeId = id;
    };
    return html`
      <div style="display:flex; flex-direction:column; gap:0.5rem; max-width:32rem;">
        <div style="display:flex; gap:0.5rem;">
          <button @click=${() => setActive('msg-5')}>Jump to #5</button>
          <button @click=${() => setActive('msg-950')}>Jump to #950</button>
          <button @click=${() => setActive('msg-1999')}>Jump to #1999</button>
        </div>
        <lr-virtual-list
          id="active-demo-list"
          style="--lr-virtual-list-height: 20rem;"
          .items=${messages}
          .renderItem=${renderMessage}
          .keyFunction=${keyFunction}
        ></lr-virtual-list>
      </div>
    `;
  },
};

/** Real group markers are measured entries, so even a wrapping label reserves space before its row. */
export const MeasuredGroupMarkers: Story = {
  render: () => {
    const rows = messages.slice(0, 36);
    return html`
      <lr-virtual-list
        aria-label="Messages with measured group markers"
        style="inline-size:320px; max-inline-size:100%; --lr-virtual-list-height:20rem;"
        row-height="56"
        .items=${rows}
        .groups=${[
          { key: 'recent', label: 'Recent messages', startIndex: 0 },
          {
            key: 'earlier',
            label: 'Earlier messages with a deliberately long marker that wraps at this allocation',
            startIndex: 18,
          },
        ]}
        .renderItem=${renderMessage}
        .keyFunction=${keyFunction}
      ></lr-virtual-list>
    `;
  },
};

/**
 * `renderStickyGroup` pins a copy of the current group's header to the top of the viewport, and
 * pushes it off as the next group arrives. The real header here is an ordinary row (that is why the
 * `groups` entries carry `label: ''` -- they are position anchors only, so no second marker
 * renders), and the pinned copy is `aria-hidden`, `inert`, and pointer-transparent. Interactive
 * actions belong to the real row so they retain one semantic and keyboard owner.
 */
export const StickyGroups: Story = {
  render: () => {
    const groupSize = 25;
    const rows = messages.slice(0, 200).map((m, i) => ({ ...m, group: `Batch ${Math.floor(i / groupSize) + 1}` }));
    type Row = (typeof rows)[number];
    const groupStarts = rows
      .map((row, index) => ({ row, index }))
      .filter(({ index }) => index % groupSize === 0)
      .map(({ row, index }) => ({ key: row.group, label: '', startIndex: index }));

    const header = (label: string) => html`
      <div
        style="padding:0.375rem 0.75rem; background:var(--lr-color-surface-raised); color:var(--lr-color-text-quiet); font-weight:600;"
      >
        ${label}
      </div>
    `;

    return html`
      <style>
        #sticky-demo-list::part(sticky-group) {
          box-shadow: var(--lr-shadow);
        }
      </style>
      <lr-virtual-list
        id="sticky-demo-list"
        style="max-width: 32rem; --lr-virtual-list-height: 20rem;"
        .items=${rows}
        .groups=${groupStarts}
        .renderItem=${(item: unknown, index: number) =>
          index % groupSize === 0 ? header((item as Row).group) : renderMessage(item, index)}
        .keyFunction=${keyFunction}
        .renderStickyGroup=${(group: { key: string | number }) => header(String(group.key))}
      ></lr-virtual-list>
    `;
  },
};

/** Demonstrates `has-more`/`loading` gating `lr-load-more` -- scroll near the bottom to trigger a simulated fetch. */
export const LoadMore: Story = {
  render: () => {
    let page = buildMessages(40);
    const onLoadMore = (e: Event) => {
      const list = e.target as LyraVirtualList;
      list.loading = true;
      list.items = page;
      setTimeout(() => {
        page = [
          ...page,
          ...buildMessages(20).map((m, i) => ({ ...m, id: `page2-${i}`, text: `Loaded more: ${m.text}` })),
        ];
        list.items = page;
        list.loading = false;
        if (page.length >= 100) list.hasMore = false;
      }, 600);
    };
    return html`
      <lr-virtual-list
        style="max-width: 32rem; --lr-virtual-list-height: 20rem;"
        .items=${page}
        .renderItem=${renderMessage}
        .keyFunction=${keyFunction}
        has-more
        @lr-load-more=${onLoadMore}
      ></lr-virtual-list>
    `;
  },
};
