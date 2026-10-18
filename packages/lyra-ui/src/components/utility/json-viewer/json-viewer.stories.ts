import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './json-viewer.js';
import type { JsonViewerTreeSource } from './json-viewer.class.js';
import type { LyraJsonViewer } from './json-viewer.js';
import type { LyraClipboardWriteSuccess } from '../copy-button/copy-button.js';

const sample = {
  id: 'call_9f2e1',
  name: 'get_weather',
  arguments: {
    location: 'Brussels, BE',
    unit: 'celsius',
    days: 3,
    includeAlerts: true,
    tags: ['storm-watch', 'coastal'],
  },
  result: {
    forecast: [
      { day: 'Mon', high: 19, low: 12, conditions: 'Cloudy' },
      { day: 'Tue', high: 21, low: 13, conditions: 'Sunny' },
      { day: 'Wed', high: 17, low: 10, conditions: 'Rain' },
    ],
    warning: null,
    source: undefined,
  },
};

const meta: Meta = {
  title: 'JsonViewer',
  component: 'lr-json-viewer',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A collapsible, copyable tree view for an arbitrary JSON-serializable value. The fallback renderer for anywhere a raw payload (tool call arguments, a tool result, an API response) needs inspecting without a bespoke view.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-json-viewer .data=${sample} style="max-width: 32rem;"></lr-json-viewer>`,
};

export const CollapsedDepth: Story = {
  render: () => html`
    <lr-json-viewer .data=${sample} expand-depth="1" style="max-width: 32rem;"></lr-json-viewer>
  `,
};

export const CollapsedImmediately: Story = {
  name: 'expand-depth="0" (top-level starts collapsed)',
  render: () => html`
    <lr-json-viewer .data=${sample} expand-depth="0" style="max-width: 32rem;"></lr-json-viewer>
  `,
};

export const Copyable: Story = {
  render: () => html`
    <lr-json-viewer
      .data=${sample}
      copyable
      style="max-width: 32rem;"
      @lr-copy=${(e: CustomEvent<LyraClipboardWriteSuccess>) => console.log('lr-copy', e.detail.text)}
    ></lr-json-viewer>
  `,
};

export const Search: Story = {
  render: () => html`
    <lr-json-viewer .data=${sample} query="storm" expand-depth="1" style="max-width: 32rem;"></lr-json-viewer>
  `,
};

export const RowTheming: Story = {
  render: () => html`
    <style>
      .json-row-theme::part(row) {
        box-shadow: inset 0 0 0 var(--lr-border-width-thin) var(--lr-color-border);
      }
    </style>
    <lr-json-viewer
      class="json-row-theme"
      .data=${sample}
      style="max-width: 32rem; --lr-json-viewer-row-hover-bg: var(--lr-color-warning-quiet);"
    ></lr-json-viewer>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'Every structural row exposes `part="row"`; its hover fill can be scoped with `--lr-json-viewer-row-hover-bg`.',
      },
    },
  },
};

export const MaxHeightScrolling: Story = {
  render: () => html`
    <lr-json-viewer .data=${sample} max-height="10rem" style="max-width: 32rem;"></lr-json-viewer>
  `,
};

export const PrimitiveRoot: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 32rem;">
      <lr-json-viewer .data=${'a bare string value'}></lr-json-viewer>
      <lr-json-viewer .data=${42}></lr-json-viewer>
      <lr-json-viewer .data=${null}></lr-json-viewer>
      <lr-json-viewer .data=${undefined}></lr-json-viewer>
    </div>
  `,
};

export const EmptyContainers: Story = {
  render: () => html`
    <lr-json-viewer .data=${{ emptyObject: {}, emptyArray: [] }} style="max-width: 32rem;"></lr-json-viewer>
  `,
};

/** Baseline narrow-allocation coverage: a long, unbroken KEY name (no spaces to wrap on) at 320px. */
export const Narrow320: Story = {
  render: () => html`
    <div style="max-width:320px">
      <lr-json-viewer
        .data=${{ aVeryLongUnbrokenPropertyNameWithNoSpacesToWrapOn: 'x' }}
      ></lr-json-viewer>
    </div>
  `,
};


export const BackwardSearch: Story = {
  parameters: { docs: { description: { story: 'First Previous selects the last match. Subsequent navigation wraps and reveals only the selected result’s ancestors. Removing query clears matches.' } } },
  render: () => html`
    <div>
      <lr-json-viewer .data=${{ first: 'needle first', middle: 'needle middle', last: 'needle last' }} query="needle"></lr-json-viewer>
      <button @click=${(event: Event) => void (event.currentTarget as HTMLElement).parentElement!
        .querySelector<LyraJsonViewer>('lr-json-viewer')!.searchPrevious()}>Previous match</button>
    </div>
  `,
};

export const RaisedNodeLimit: Story = {
  render: () => html`<lr-json-viewer max-nodes="10000" expand-depth="1" .data=${Array.from({ length: 6000 }, (_, index) => ({ index }))}></lr-json-viewer>`,
};


function millionInspectionSource(deep = false): JsonViewerTreeSource {
  const count = 1_000_000;
  const indexOf = (key: string | number) => {
    const text = String(key);
    if (!/^n\d+$/.test(text)) return -1;
    const index = Number(text.slice(1));
    return Number.isSafeInteger(index) && index >= 0 && index < count ? index : -1;
  };
  return {
    revision: 1,
    async project(request) {
      const focusIndex = request.action.type === 'reveal' ? indexOf(request.action.key) : -1;
      let closed = deep && request.state !== null ? Number(request.state) : -1;
      if (request.action.type === 'reset' || focusIndex >= 0) closed = -1;
      if (deep && request.action.type === 'toggle') closed = request.action.expanded ? -1 : indexOf(request.action.key);
      const visible = closed < 0 ? count : closed + 1;
      return { state: String(closed), total: count, rows: { count: visible,
        keyAt: (index: number) => `n${index}`, indexOfKey: (key: string | number) => { const index = indexOf(key); return index < visible ? index : -1; },
        itemAt: (index: number) => ({ key: `n${index}`,
          value: { name: deep ? 'child' : String(index), path: `n${index}`, kind: deep && index < count - 1 ? 'object' as const : 'scalar' as const,
            value: String(index) },
          parentKey: deep && index > 0 ? `n${index - 1}` : null,
          level: deep ? index + 1 : 1, position: deep ? 1 : index + 1, setSize: deep ? 1 : count,
          childCount: deep && index < count - 1 ? 1 : 0, expanded: deep && index !== closed, selected: false,
        }),
      }, ...(focusIndex >= 0 ? { focusIndex } : {}) };
    },
    async search(request) {
      const index = /^\d+$/.test(request.query) ? Number(request.query) : -1;
      const hits = Number.isSafeInteger(index) && index >= 0 && index < count ? [{ key: `n${index}` }] : [];
      return { hits, total: hits.length, exhaustive: true };
    },
    async copy(request) {
      const index = request.key === null ? 0 : indexOf(request.key);
      if (index < 0) throw new RangeError('Unknown node');
      let text: string;
      if (deep) text = '{"child":'.repeat(count - index - 1) + String(count - 1) + '}'.repeat(count - index - 1);
      else if (request.scope === 'document') {
        text = '[';
        for (let current = 0; current < count; current++) text += `${current ? ',' : ''}${current}`;
        text += ']';
      } else text = String(index);
      if (text.length > request.maxBytes) throw new RangeError('Complete copy exceeds its budget');
      return text;
    },
  };
}

export const MillionNodeSource: Story = {
  parameters: { docs: { description: { story: 'A complete million-node indexed provider. Search a numeric node value globally; Next reveals its exact compact key. Copy requests complete provider text, never the mounted window.' } } },
  render: () => {
    const provider = millionInspectionSource();
    return html`<div style="max-width: 32rem">
      <lr-json-viewer .treeSource=${provider} copyable max-height="20rem" aria-label="Million JSON nodes"></lr-json-viewer>
      <button @click=${(event: Event) => void (event.currentTarget as HTMLElement).parentElement!.querySelector<LyraJsonViewer>('lr-json-viewer')!.revealSourceKey('n999999')}>Final node</button>
      <button @click=${async (event: Event) => {
        const viewer = (event.currentTarget as HTMLElement).parentElement!.querySelector<LyraJsonViewer>('lr-json-viewer')!;
        await viewer.runSearch('999999'); await viewer.searchNext();
      }}>Search final node</button>
    </div>`;
  },
};

export const MillionDeepSource: Story = {
  parameters: { docs: { description: { story: 'One million expanded logical levels use compact n-index keys. Logical aria-level remains exact while visual indentation is bounded; revealSourceKey does not build an ancestor-path array.' } } },
  render: () => html`<div style="max-width: 320px"><lr-json-viewer .treeSource=${millionInspectionSource(true)} max-height="16rem" aria-label="Deep JSON hierarchy"></lr-json-viewer>
    <button @click=${(event: Event) => void (event.currentTarget as HTMLElement).parentElement!.querySelector<LyraJsonViewer>('lr-json-viewer')!.revealSourceKey('n999999')}>Deepest node</button></div>`,
};
