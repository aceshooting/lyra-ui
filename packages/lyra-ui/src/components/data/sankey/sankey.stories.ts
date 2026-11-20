import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraSankeyLink, LyraSankeyNode } from './sankey.class.js';
import '../../lr-sankey.js';

const meta: Meta = {
  title: 'Data Display/Sankey',
  component: 'lr-sankey',
  tags: ['autodocs'],
};

export default meta;

const NODES: readonly LyraSankeyNode[] = [
  { id: 'direct', label: 'Direct visits' },
  { id: 'referral', label: 'Referrals' },
  { id: 'organic', label: 'Organic search' },
  { id: 'self-serve', label: 'Self-serve trial' },
  { id: 'assisted', label: 'Sales-assisted trial' },
  { id: 'paid', label: 'Paid accounts' },
  { id: 'expired', label: 'Expired trials' },
];

const LINKS: readonly LyraSankeyLink[] = [
  { source: 'direct', target: 'self-serve', value: 420 },
  { source: 'referral', target: 'self-serve', value: 310 },
  { source: 'organic', target: 'self-serve', value: 180 },
  { source: 'direct', target: 'assisted', value: 90 },
  { source: 'referral', target: 'assisted', value: 110 },
  { source: 'self-serve', target: 'paid', value: 610, label: 'Self-serve conversions' },
  { source: 'self-serve', target: 'expired', value: 300 },
  { source: 'assisted', target: 'paid', value: 160, label: 'Sales-assisted conversions' },
  { source: 'assisted', target: 'expired', value: 40 },
];

export const Default: StoryObj = {
  render: () => html`
    <lr-sankey
      label="Trial conversions"
      description="Visitor acquisition through trial and conversion"
      .nodes=${NODES}
      .links=${LINKS}
      data-table-toggle
    ></lr-sankey>
  `,
};

export const Narrow320: StoryObj = {
  render: () => html`
    <lr-sankey
      label="Trial conversions in a narrow panel"
      style="inline-size: 320px; max-inline-size: 100%"
      .nodes=${[
        { id: 'direct', label: 'Direct campaign visits from regional landing pages' },
        ...NODES.slice(1),
      ]}
      .links=${LINKS}
      data-table-toggle
    ></lr-sankey>
  `,
};

export const DataTable: StoryObj = {
  render: () => html`
    <lr-sankey
      label="Trial conversions"
      with-data-table
      data-table-toggle
      .nodes=${NODES}
      .links=${LINKS}
      .valueFormatter=${(value: number) => `${value} people`}
    ></lr-sankey>
  `,
};

export const RightToLeft: StoryObj = {
  render: () => html`
    <lr-sankey dir="rtl" locale="ar" label="تحويلات التجربة" data-table-toggle
      .nodes=${[
        { id: 'direct', label: 'الزيارات المباشرة' },
        { id: 'referral', label: 'الإحالات' },
        { id: 'trial', label: 'التجربة' },
        { id: 'paid', label: 'الحسابات المدفوعة' },
        { id: 'expired', label: 'التجارب المنتهية' },
      ]}
      .links=${[
        { source: 'direct', target: 'trial', value: 60 },
        { source: 'referral', target: 'trial', value: 40 },
        { source: 'trial', target: 'paid', value: 75 },
        { source: 'trial', target: 'expired', value: 25 },
      ]}
    ></lr-sankey>
  `,
};

export const CyclicFlow: StoryObj = {
  render: () => html`
    <lr-sankey
      label="Trial conversions"
      .nodes=${NODES}
      .links=${[...LINKS, { source: 'paid', target: 'direct', value: 60 }]}
    ></lr-sankey>
  `,
};

export const RepeatedIds: StoryObj = {
  render: () => html`
    <lr-sankey
      label="Trial conversions with a repeated node"
      .nodes=${[...NODES, { id: 'paid', label: 'Paid again' }]}
      .links=${LINKS}
    ></lr-sankey>
  `,
};

export const Loading: StoryObj = {
  render: () => html`<lr-sankey label="Trial conversions" loading></lr-sankey>`,
};

export const Empty: StoryObj = {
  render: () => html`<lr-sankey label="Trial conversions"></lr-sankey>`,
};
