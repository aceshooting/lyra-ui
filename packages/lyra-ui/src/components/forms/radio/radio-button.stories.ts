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

export const Sizes: StoryObj = {
  name: 'Size ladder',
  parameters: {
    docs: {
      description: {
        story:
          "`size` is the library's shared ladder, inherited from `<lr-radio>`, so a row of buttons at one `size` lines up with an `<lr-input>`, `<lr-select>` or `<lr-button>` of the same `size`. Both spellings of every tier are accepted — `s`/`m`/`l` and Web Awesome's `small`/`medium`/`large`.",
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m); justify-items: start;">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`<lr-radio-group name="view-${size}" label="Size ${size}" size=${size}>
          <lr-radio-button value="day" size=${size} checked>Day</lr-radio-button>
          <lr-radio-button value="week" size=${size}>Week</lr-radio-button>
        </lr-radio-group>`,
      )}
    </div>
  `,
};

export const Pill: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          '`pill` rounds the outer edges of the button row into a pill. It is declared on `<lr-radio>` so both tags carry one property with one meaning; a plain `<lr-radio>`\'s indicator is already a circle, so the setting is visible here.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m); justify-items: start;">
      <lr-radio-group name="pill-off" label="Default corners">
        <lr-radio-button value="day" checked>Day</lr-radio-button>
        <lr-radio-button value="week">Week</lr-radio-button>
        <lr-radio-button value="month">Month</lr-radio-button>
      </lr-radio-group>
      <lr-radio-group name="pill-on" label="Pill">
        <lr-radio-button value="day" pill checked>Day</lr-radio-button>
        <lr-radio-button value="week" pill>Week</lr-radio-button>
        <lr-radio-button value="month" pill>Month</lr-radio-button>
      </lr-radio-group>
    </div>
  `,
};
