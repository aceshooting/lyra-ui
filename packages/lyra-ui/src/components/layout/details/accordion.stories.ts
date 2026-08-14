import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './accordion.js';
import './accordion-item.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

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
          '`mode="multiple"` allows any number of panels; `single` keeps exactly the activated panel open; `single-collapsible` also allows zero open panels. In v9, `mode` is the sole expansion-policy property.',
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
      Labels can contain noninteractive markup while the trigger remains the sole action.
    </lr-accordion-item>
  </lr-accordion>`,
};

export const ThemedAppearancesAndStates: StoryObj = {
  name: 'Themed appearances and states',
  parameters: {
    docs: {
      description: {
        story:
          'The group chrome, item surfaces, and item trigger states each use inheritable family-scoped hooks while retaining the shared tokens as defaults.',
      },
    },
  },
  render: () => html`
    <div
      style="
        display: grid;
        gap: var(--lr-space-s);
        --lr-accordion-outlined-bg: ${storyColor('surface')};
        --lr-accordion-outlined-border-color: ${storyColor('border')};
        --lr-accordion-filled-bg: ${storyColor('successQuiet')};
        --lr-accordion-filled-border-color: ${storyColor('success')};
        --lr-accordion-filled-outlined-bg: ${storyColor('warningQuiet')};
        --lr-accordion-filled-outlined-border-color: ${storyColor('warning')};
        --lr-accordion-item-outlined-bg: ${storyColor('surface')};
        --lr-accordion-item-filled-bg: ${storyColor('successQuiet')};
        --lr-accordion-item-filled-outlined-bg: ${storyColor('warningQuiet')};
        --lr-accordion-item-button-hover-bg: ${storyColor('dangerQuiet')};
        --lr-accordion-item-button-active-bg: ${storyColor('danger')};
      "
    >
      ${(['outlined', 'filled', 'filled-outlined'] as const).map(
        (appearance) => html`
          <lr-accordion appearance=${appearance}>
            <lr-accordion-item label=${appearance} expanded>
              Hover and press this item trigger to exercise its independent state paint.
            </lr-accordion-item>
          </lr-accordion>
        `,
      )}
    </div>
  `,
};

export const NarrowRtlLongContent: StoryObj = {
  name: 'Narrow RTL long content (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'An exact 320px RTL accordion keeps expanded long localized item labels, content, and actions contained while retaining the complete group/item composition.',
      },
    },
  },
  render: () => html`
    <div
      dir="rtl"
      style="inline-size: 320px; max-inline-size: 100%; border: var(--lr-border-width-thin) dashed var(--lr-color-border);"
    >
      <lr-accordion>
        <lr-accordion-item label="عنوانقسممحليطويلجداًبدونأيفرصةللفصلالتلقائي" expanded>
          <p>محتوىقسممحليطويلجداًبدونأيفرصةللفصلالتلقائي</p>
          <button type="button">إجراءمحليطويلجداًبدونأيفرصةللفصلالتلقائي</button>
        </lr-accordion-item>
        <lr-accordion-item label="عنوانقسمثانطويلجداًبدونأيفرصةللفصلالتلقائي">
          محتوى القسم الثاني.
        </lr-accordion-item>
      </lr-accordion>
    </div>
  `,
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
