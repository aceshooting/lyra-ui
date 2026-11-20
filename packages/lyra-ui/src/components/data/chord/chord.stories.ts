import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraChordEntity } from './chord.class.js';
import '../../lr-chord.js';

const meta: Meta = {
  title: 'Data Display/Chord',
  component: 'lr-chord',
  tags: ['autodocs'],
};

export default meta;

const ENTITIES: readonly LyraChordEntity[] = [
  { id: 'sales', label: 'Sales' },
  { id: 'support', label: 'Support' },
  { id: 'product', label: 'Product' },
  { id: 'design', label: 'Design' },
  { id: 'research', label: 'Research' },
];

const MATRIX = [
  [4, 20, 15, 0, 5],
  [20, 0, 30, 10, 4],
  [15, 30, 0, 25, 18],
  [0, 10, 25, 0, 16],
  [5, 4, 18, 16, 0],
] as const;

export const Default: StoryObj = {
  render: () => html`
    <lr-chord
      label="Requests shared between teams"
      description="Monthly request counts grouped by team pair"
      data-table-toggle
      .entities=${ENTITIES}
      .matrix=${MATRIX}
    ></lr-chord>
  `,
};

export const Narrow320: StoryObj = {
  render: () => html`
    <lr-chord
      label="Requests between teams in a narrow panel"
      style="inline-size: 320px; max-inline-size: 100%"
      data-table-toggle
      .entities=${[
        { id: 'sales', label: 'Sales for the northern territories and major accounts' },
        ...ENTITIES.slice(1),
      ]}
      .matrix=${MATRIX}
    ></lr-chord>
  `,
};

export const DataTable: StoryObj = {
  render: () => html`
    <lr-chord
      label="Requests shared between teams"
      with-data-table
      data-table-toggle
      .entities=${ENTITIES}
      .matrix=${MATRIX}
      .valueFormatter=${(value: number) => `${value} requests`}
    ></lr-chord>
  `,
};

export const RightToLeft: StoryObj = {
  render: () => html`
    <lr-chord dir="rtl" locale="ar" label="الطلبات المشتركة بين الفرق" data-table-toggle
      .entities=${[
        { id: 'sales', label: 'المبيعات' },
        { id: 'support', label: 'الدعم' },
        { id: 'product', label: 'المنتج' },
        { id: 'design', label: 'التصميم' },
        { id: 'research', label: 'البحث' },
      ]}
      .matrix=${MATRIX}
    ></lr-chord>
  `,
};

export const InvalidMatrix: StoryObj = {
  render: () => html`
    <lr-chord
      label="Requests shared between teams"
      .entities=${ENTITIES.slice(0, 2)}
      .matrix=${[[4, 20], [15, 0]]}
    ></lr-chord>
  `,
};

export const Loading: StoryObj = {
  render: () => html`<lr-chord label="Requests shared between teams" loading></lr-chord>`,
};

export const Empty: StoryObj = {
  render: () => html`<lr-chord label="Requests shared between teams"></lr-chord>`,
};
