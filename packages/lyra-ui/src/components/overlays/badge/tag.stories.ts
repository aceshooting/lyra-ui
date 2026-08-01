import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tag.js';

const meta: Meta = { title: 'Display/Tag', component: 'lr-tag', tags: ['autodocs'] };
export default meta;

const row = 'display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center';

export const Default: StoryObj = { render: () => html`<lr-tag variant="brand">Example tag</lr-tag>` };

export const Removable: StoryObj = {
  name: 'Removable (self-removes unless vetoed)',
  render: () => html`<div style=${row}>
    <lr-tag variant="brand" with-remove>status:open</lr-tag>
    <lr-tag variant="success" with-remove pill>label:ready</lr-tag>
    <lr-tag variant="danger" with-remove appearance="accent">severity:high</lr-tag>
  </div>`,
};

export const RemovalVetoed: StoryObj = {
  name: 'Removal vetoed by the consumer',
  render: () => html`<div
    style=${row}
    @lr-remove=${(event: Event) => {
      // preventDefault() keeps the tag mounted so the consumer's own state owns the removal.
      event.preventDefault();
      (event.target as HTMLElement).setAttribute('variant', 'warning');
    }}
  >
    <lr-tag with-remove>Try removing me</lr-tag>
  </div>`,
};

export const WithIcons: StoryObj = {
  name: 'Start and end slots',
  render: () => html`<div style=${row}>
    <lr-tag variant="brand" with-remove><span slot="start" aria-hidden="true">#</span>topic</lr-tag>
    <lr-tag variant="neutral">draft<span slot="end" aria-hidden="true">&#8230;</span></lr-tag>
  </div>`,
};

export const RightToLeft: StoryObj = {
  name: 'RTL',
  render: () => html`<div dir="rtl" style=${row}>
    <lr-tag variant="brand" with-remove>وسم</lr-tag>
    <lr-tag variant="success" with-remove pill>جاهز</lr-tag>
  </div>`,
};
