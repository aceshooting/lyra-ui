import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './result-field.js';

const meta: Meta = { title: 'ResultCard/Result field', component: 'lr-result-field', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-result-field label="Status" value="200 OK"></lr-result-field>` };

/** A 320px RTL fixture with one deliberately unbroken result value. */
export const NarrowLongRtl: StoryObj = {
  name: 'Narrow long RTL',
  render: () => html`
    <div dir="rtl" lang="ar" style="inline-size: 320px; max-inline-size: 100%;">
      <lr-result-field
        label="معرّف نتيجة الاسترجاع المطوّل"
        value="معرفنتيجةالاسترجاعالموحد20260903A9F4E7B2C8D1"
      ></lr-result-field>
    </div>
  `,
};
