import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './breadcrumb.js';
import './breadcrumb-item.js';
const meta: Meta = { title: 'Navigation/Breadcrumb', component: 'lr-breadcrumb', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-breadcrumb><lr-breadcrumb-item href="/">Home</lr-breadcrumb-item><lr-breadcrumb-item href="/reports">Reports</lr-breadcrumb-item><lr-breadcrumb-item current>Current</lr-breadcrumb-item></lr-breadcrumb>` };

export const SharedSeparator: StoryObj = {
  render: () => html`
    <lr-breadcrumb label="Project trail">
      <span slot="separator" aria-hidden="true">→</span>
      <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
      <lr-breadcrumb-item href="/reports">Reports</lr-breadcrumb-item>
      <lr-breadcrumb-item current>Current</lr-breadcrumb-item>
    </lr-breadcrumb>
  `,
};

export const NarrowRtlLongContent: StoryObj = {
  name: 'Narrow RTL long content (320px)',
  parameters: {
    docs: {
      description: {
        story: 'An exact 320px allocation verifies wrapping for long localized breadcrumb labels in RTL.',
      },
    },
  },
  render: () => html`
    <div
      dir="rtl"
      style="inline-size: 320px; max-inline-size: 100%; border: var(--lr-border-width-thin) solid var(--lr-color-border); padding: var(--lr-space-s);"
    >
      <lr-breadcrumb label="مسار المشروع">
        <lr-breadcrumb-item href="/">الصفحة-الرئيسية-ذات-العنوان-الطويل-جداً</lr-breadcrumb-item>
        <lr-breadcrumb-item href="/reports">التقارير-التحليلية-المفصلة-جداً</lr-breadcrumb-item>
        <lr-breadcrumb-item current>النتيجة-الحالية-ذات-العنوان-الطويل-جداً</lr-breadcrumb-item>
      </lr-breadcrumb>
    </div>
  `,
};
