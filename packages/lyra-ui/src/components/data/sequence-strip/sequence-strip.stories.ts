import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './sequence-strip.js';
import type { SequenceStripCategory, SequenceStripItem } from './sequence-strip.class.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = {
  title: 'Sequence Strip',
  component: 'lr-sequence-strip',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Items and categories are copied into frozen canonical snapshots bounded to 10,000 entries, with at most 200 mounted at once. Empty and blank IDs are omitted and later duplicates are first-wins. Unnamed categories use a localized fallback, and hover/focus tooltips track their active cell. Reassign either collection after changing it.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const categories = (): SequenceStripCategory[] => [
  { id: 'text', color: storyColor('chart1'), label: 'Text' },
  { id: 'tool', color: storyColor('chart2'), label: 'Tool' },
  { id: 'mixed', color: storyColor('chart3'), label: 'Mixed' },
];

const items: SequenceStripItem[] = [
  { id: '1', categoryId: 'text', label: 'Turn 1: plain response' },
  { id: '2', categoryId: 'tool', marker: true, label: 'Turn 2: tool call (subagent)' },
  { id: '3', categoryId: 'tool', label: 'Turn 3: tool call' },
  { id: '4', categoryId: 'mixed', label: 'Turn 4: mixed' },
  { id: '5', categoryId: 'text', label: 'Turn 5: plain response' },
];

export const Default: Story = {
  render: () => html`<lr-sequence-strip .items=${items} .categories=${categories()}></lr-sequence-strip>`,
};

/** Neither an internal category id nor a blank label becomes user-facing text. Hover the first
 * cell or focus either cell to see the localized fallback tooltip positioned from that cell. */
export const LocalizedUnnamedCategory: Story = {
  render: () => html`
    <div style="inline-size: var(--lr-size-30rem); max-inline-size: 100%">
      <lr-sequence-strip
        .items=${[
          { id: 'first', categoryId: 'internal-unnamed' },
          { id: 'second', categoryId: 'internal-unnamed' },
        ] satisfies SequenceStripItem[]}
        .categories=${[
          { id: 'internal-unnamed', color: storyColor('chart1'), label: '   ' },
        ] satisfies SequenceStripCategory[]}
        .strings=${{ sequenceStripUnnamedCategory: 'Uncategorized' }}
      ></lr-sequence-strip>
    </div>
  `,
};

export const Empty: Story = {
  render: () => html`<lr-sequence-strip></lr-sequence-strip>`,
};

/** A per-turn conversation timeline with a persistent key of the category colors, so the mapping
 *  stays readable without hovering each cell. The legend is static: it lists every entry of
 *  `categories` (whether or not any item uses it) and toggles nothing. */
export const WithLegend: Story = {
  render: () => html`<lr-sequence-strip show-legend .items=${items} .categories=${categories()}></lr-sequence-strip>`,
};

/** `marker-label` names what a cell's `marker` means. With the legend shown it adds one trailing
 *  row whose chip reproduces the cell's own marker treatment (a neutral chip with the bottom bar in
 *  `--lr-sequence-strip-marker-color`), and the marker's count joins the strip's spoken summary —
 *  so the legend keeps no entry that assistive technology never hears. */
export const WithMarkerLegend: Story = {
  render: () =>
    html`<lr-sequence-strip
      show-legend
      marker-label="Dispatched to a subagent"
      .items=${items}
      .categories=${categories()}
    ></lr-sequence-strip>`,
};

/** The same legend in a 320px allocation with long, translation-length labels — it wraps onto
 *  further rows instead of overflowing the strip's own width. */
export const LegendNarrowAllocation: Story = {
  render: () => html`
    <div style="inline-size: 320px">
      <lr-sequence-strip
        show-legend
        .items=${items}
        .categories=${[
          ...categories(),
          { id: 'sub', color: storyColor('chart4'), label: 'Dispatched to a subagent' },
          { id: 'err', color: storyColor('danger'), label: 'Errored tool invocation' },
        ] as SequenceStripCategory[]}
      ></lr-sequence-strip>
    </div>
  `,
};

/** High-cardinality strips mount a bounded 200-cell window at 320px. End shifts the projection to
 *  the final global item while `aria-posinset`/`aria-setsize` retain the complete model. */
export const HighCardinalityNarrow: Story = {
  name: 'Windowed high cardinality (200 / 500 at 320px, LTR / RTL)',
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-l); justify-items: start">
      ${([200, 500] as const).flatMap((count) =>
        (['ltr', 'rtl'] as const).map((direction) => {
          const denseItems: SequenceStripItem[] = Array.from({ length: count }, (_, index) => ({
            id: `${count}-${index}`,
            categoryId: index % 3 === 0 ? 'tool' : index % 3 === 1 ? 'mixed' : 'text',
            marker: index % 17 === 0,
            label: `Item ${index + 1} of ${count}`,
          }));
          return html`
            <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%">
              <p style="margin: 0 0 var(--lr-space-2xs)">${count} items · ${direction.toUpperCase()}</p>
              <lr-sequence-strip .items=${denseItems} .categories=${categories()}></lr-sequence-strip>
            </div>
          `;
        }),
      )}
    </div>
  `,
};

export const CustomAccessibleLabel: Story = {
  render: () =>
    html`<lr-sequence-strip
      .items=${items}
      .categories=${categories()}
      accessible-label="Component alias"
      aria-label="Conversation turn history: 2 text, 2 tool, 1 mixed"
    ></lr-sequence-strip>`,
};

/** Focus a cell and press R. The story replaces every item object without changing its ids; real
 * focus and the sole roving stop remain on that id instead of resetting to the first cell. */
export const ControlledRefreshFocus: Story = {
  render: () => html`
    <lr-sequence-strip
      .items=${items}
      .categories=${categories()}
      @keydown=${(event: KeyboardEvent) => {
        if (event.key.toLocaleLowerCase() !== 'r') return;
        const strip = event.currentTarget as HTMLElement & { items: SequenceStripItem[] };
        strip.items = strip.items.map((item) => ({ ...item }));
      }}
    ></lr-sequence-strip>
  `,
};

/** Focus the first cell and press ArrowRight. The host replaces the complete controlled model in
 * that same key event; focus clamps from the previously focused first item to Replacement A rather
 * than letting the obsolete ArrowRight continuation land on Replacement B by numeric index. */
export const ControlledReplacementDuringArrow: Story = {
  render: () => html`
    <lr-sequence-strip
      .items=${items}
      .categories=${categories()}
      @keydown=${(event: KeyboardEvent) => {
        if (event.key !== 'ArrowRight') return;
        const strip = event.currentTarget as HTMLElement & { items: SequenceStripItem[] };
        strip.items = [
          { id: 'replacement-a', categoryId: 'text', label: 'Replacement A' },
          { id: 'replacement-b', categoryId: 'tool', label: 'Replacement B' },
        ];
      }}
    ></lr-sequence-strip>
  `,
};
