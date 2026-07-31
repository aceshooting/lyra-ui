import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './radio-button.js';
import './radio-group.js';

const meta: Meta = { title: 'Forms/Radio button', component: 'lr-radio-button', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <lr-radio-group name="view" label="View">
      <lr-radio-button value="day" checked>Day</lr-radio-button>
      <lr-radio-button value="week">Week</lr-radio-button>
      <lr-radio-button value="month">Month</lr-radio-button>
    </lr-radio-group>
  `,
};

export const Disabled: StoryObj = {
  render: () => html`
    <lr-radio-group name="tier" label="Tier">
      <lr-radio-button value="free" checked>Free</lr-radio-button>
      <lr-radio-button value="pro" disabled>Pro</lr-radio-button>
    </lr-radio-group>
  `,
};

export const RightToLeft: StoryObj = {
  name: 'RTL',
  render: () => html`
    <div dir="rtl">
      <lr-radio-group name="view-rtl" label="عرض">
        <lr-radio-button value="day" checked>يوم</lr-radio-button>
        <lr-radio-button value="week">أسبوع</lr-radio-button>
      </lr-radio-group>
    </div>
  `,
};
