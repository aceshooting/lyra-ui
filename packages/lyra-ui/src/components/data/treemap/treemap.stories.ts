import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraTreemapNode } from './treemap.class.js';
import '../../lr-treemap.js';

const meta: Meta = {
  title: 'Data Display/Treemap',
  component: 'lr-treemap',
  tags: ['autodocs'],
};

export default meta;

const USAGE: readonly LyraTreemapNode[] = [
  {
    id: 'compute',
    label: 'Compute',
    children: [
      { id: 'batch', label: 'Batch processing', value: 640 },
      { id: 'web', label: 'Web servers', value: 385 },
      { id: 'jobs', label: 'Background jobs', value: 190 },
    ],
  },
  {
    id: 'storage',
    label: 'Storage',
    children: [
      { id: 'objects', label: 'Object storage', value: 420 },
      { id: 'backups', label: 'Backups', value: 250 },
      { id: 'archives', label: 'Archives', value: 75 },
    ],
  },
  { id: 'network', label: 'Networking', value: 180 },
];

export const Default: StoryObj = {
  render: () => html`
    <lr-treemap
      label="Monthly infrastructure usage"
      description="Usage credits grouped by service"
      data-table-toggle
      .nodes=${USAGE}
    ></lr-treemap>
  `,
};

export const Narrow320: StoryObj = {
  render: () => html`
    <lr-treemap
      style="inline-size: 320px; max-inline-size: 100%"
      label="Usage in a narrow panel"
      data-table-toggle
      .nodes=${[
        USAGE[0],
        {
          id: 'storage',
          label: 'Regional object storage and policy-managed archival retention',
          value: 745,
        },
        USAGE[2],
      ]}
    ></lr-treemap>
  `,
};

export const CustomHeight: StoryObj = {
  render: () => html`
    <lr-treemap
      style="--lr-treemap-height: var(--lr-size-16rem)"
      label="Monthly infrastructure usage"
      .nodes=${USAGE}
    ></lr-treemap>
  `,
};

export const DataTable: StoryObj = {
  render: () => html`
    <lr-treemap
      label="Monthly infrastructure usage"
      with-data-table
      data-table-toggle
      .nodes=${USAGE}
      .valueFormatter=${(value: number) => `${value} credits`}
    ></lr-treemap>
  `,
};

export const RightToLeft: StoryObj = {
  render: () => html`
    <lr-treemap
      dir="rtl"
      locale="ar"
      label="استخدام البنية التحتية"
      data-table-toggle
      .nodes=${[
        {
          id: 'compute',
          label: 'الحوسبة',
          children: [
            { id: 'batch', label: 'معالجة الدفعات', value: 640 },
            { id: 'web', label: 'خوادم الويب', value: 385 },
          ],
        },
        { id: 'storage', label: 'التخزين', value: 745 },
        { id: 'network', label: 'الشبكات', value: 180 },
      ]}
    ></lr-treemap>
  `,
};

export const Loading: StoryObj = {
  render: () => html`<lr-treemap label="Monthly infrastructure usage" loading></lr-treemap>`,
};

export const Empty: StoryObj = {
  render: () => html`<lr-treemap label="Monthly infrastructure usage"></lr-treemap>`,
};
