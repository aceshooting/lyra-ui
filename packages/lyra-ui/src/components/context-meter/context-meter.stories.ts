import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './context-meter.js';
import type { LyraContextMeter, ContextMeterSegment } from './context-meter.js';

const meta: Meta = {
  title: 'ContextMeter',
  component: 'lr-context-meter',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const CONTEXT_SEGMENTS: ContextMeterSegment[] = [
  { label: 'System prompt', value: 1_800, tone: 'neutral' },
  { label: 'Conversation history', value: 42_000, tone: 'brand' },
  { label: 'Tool results', value: 18_500, tone: 'warning' },
  { label: 'Retrieved sources', value: 6_200, tone: 'success' },
];

function withSegments(el: HTMLElement, segments: ContextMeterSegment[]): void {
  (el as LyraContextMeter).segments = segments;
}

export const Bar: Story = {
  render: () => html`<lr-context-meter total="131072" label="128K context window"></lr-context-meter>`,
  play: async ({ canvasElement }) => {
    withSegments(canvasElement.querySelector('lr-context-meter')!, CONTEXT_SEGMENTS);
  },
};

export const ArbitraryCategoryColors: Story = {
  render: () => html`<lr-context-meter total="100" label="Release categories"></lr-context-meter>`,
  play: async ({ canvasElement }) => {
    withSegments(canvasElement.querySelector('lr-context-meter')!, [
      { label: 'Features', value: 28, color: 'var(--lr-color-brand)' },
      { label: 'Bug fixes', value: 20, color: 'var(--lr-color-danger)' },
      { label: 'Tests', value: 12, color: 'oklch(60% 0.18 145)' },
    ]);
  },
};

export const Ring: Story = {
  render: () => html`
    <lr-context-meter variant="ring" total="131072" label="Context"></lr-context-meter>
  `,
  play: async ({ canvasElement }) => {
    withSegments(canvasElement.querySelector('lr-context-meter')!, CONTEXT_SEGMENTS);
  },
};

/** Narrow-allocation and long-content evidence for meters embedded in compact panels. */
export const NarrowLongContent: Story = {
  name: 'Narrow (320px) with long content',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-context-meter
        aria-label="Occupancy of the shared multilingual conversation context window"
        total="131072"
        label="Shared multilingual conversation context-window occupancy"
      ></lr-context-meter>
    </div>
  `,
  play: async ({ canvasElement }) => {
    withSegments(canvasElement.querySelector('lr-context-meter')!, CONTEXT_SEGMENTS);
  },
};

export const NearCapacity: Story = {
  name: 'Near capacity (danger tone)',
  render: () => html`<lr-context-meter total="8000" label="8K context window"></lr-context-meter>`,
  play: async ({ canvasElement }) => {
    withSegments(canvasElement.querySelector('lr-context-meter')!, [
      { label: 'System prompt', value: 400, tone: 'neutral' },
      { label: 'Conversation history', value: 6_900, tone: 'danger' },
      { label: 'Tools', value: 500, tone: 'warning' },
    ]);
  },
};

export const EmptyState: Story = {
  name: 'Empty (no segments)',
  render: () => html`
    <div class="flex flex-wrap items-center gap-8">
      <lr-context-meter total="131072" label="128K context window"></lr-context-meter>
      <lr-context-meter variant="ring" total="131072" label="Context"></lr-context-meter>
    </div>
  `,
};

export const ZeroTotal: Story = {
  name: 'Zero/unset total',
  render: () => html`<lr-context-meter label="Unknown budget"></lr-context-meter>`,
};

export const TokenBudgetGallery: Story = {
  name: 'Token-budget reuse (generic viz, not model-specific)',
  render: () => html`
    <div class="flex flex-col gap-4" style="max-inline-size: 24rem;">
      <lr-context-meter total="100" label="Daily API token budget"></lr-context-meter>
      <lr-context-meter total="100" label="Per-request budget"></lr-context-meter>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const meters = canvasElement.querySelectorAll('lr-context-meter');
    withSegments(meters[0], [
      { label: 'Used today', value: 62, tone: 'brand' },
      { label: 'Reserved', value: 18, tone: 'neutral' },
    ]);
    withSegments(meters[1], [{ label: 'Used', value: 95, tone: 'danger' }]);
  },
};
