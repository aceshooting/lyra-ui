import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './accordion.js';
import './accordion-item.js';

const meta: Meta = {
  title: 'Disclosure/Accordion',
  component: 'lr-accordion',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () => html`<lr-accordion>
    <lr-accordion-item label="Account" expanded>Profile and sign-in settings.</lr-accordion-item>
    <lr-accordion-item label="Notifications">Email and push notification settings.</lr-accordion-item>
    <lr-accordion-item label="Privacy">Visibility and data-sharing settings.</lr-accordion-item>
  </lr-accordion>`,
};

export const Modes: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          '`multiple` allows any number of panels; `single` keeps exactly the activated panel open; `single-collapsible` also allows zero open panels.',
      },
    },
  },
  render: () => html`<div style="display: grid; gap: var(--lr-space-l)">
    ${(['multiple', 'single', 'single-collapsible'] as const).map(
      (mode) => html`<section>
        <h3>${mode}</h3>
        <lr-accordion mode=${mode}>
          <lr-accordion-item label="First" expanded>First panel</lr-accordion-item>
          <lr-accordion-item label="Second">Second panel</lr-accordion-item>
        </lr-accordion>
      </section>`,
    )}
  </div>`,
};

export const Presentation: StoryObj = {
  render: () => html`<lr-accordion appearance="filled-outlined" icon-placement="start" heading-level="2">
    <lr-accordion-item label="Start icon">The group propagates presentation to direct items.</lr-accordion-item>
    <lr-accordion-item disabled label="Disabled">Disabled items are skipped by roving focus.</lr-accordion-item>
    <lr-accordion-item>
      <span slot="label">Rich <em>slotted</em> label</span>
      Labels can contain markup.
    </lr-accordion-item>
  </lr-accordion>`,
};

export const CancelableLifecycle: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'The first expansion is vetoed with `lr-expand`; accepted changes finish with `lr-after-expand` or `lr-after-collapse`.',
      },
    },
  },
  render: () => html`<lr-accordion
    @lr-expand=${(event: Event) => {
      const accordion = event.currentTarget as HTMLElement;
      if (accordion.dataset['vetoed']) return;
      accordion.dataset['vetoed'] = 'yes';
      event.preventDefault();
    }}
  >
    <lr-accordion-item label="Try twice">The first attempt is canceled; the second expands.</lr-accordion-item>
  </lr-accordion>`,
};
