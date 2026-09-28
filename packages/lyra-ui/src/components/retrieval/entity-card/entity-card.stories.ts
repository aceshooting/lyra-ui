import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './entity-card.js';
import type { LyraEntity } from './entity-card.class.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = {
  title: 'Entity Card',
  component: 'lr-entity-card',
};
export default meta;
type Story = StoryObj;

const entity: LyraEntity = {
  id: 'e1',
  label: 'Marie Curie',
  type: 'person',
  description: 'Physicist and chemist, two-time Nobel laureate.',
  properties: { born: 1867, field: 'Physics/Chemistry' },
  degree: 5,
  communityId: 'c1',
};

const types = () => [{ id: 'person', label: 'Person', color: storyColor('chart1') }];

export const Default: Story = {
  render: () => html`<lr-entity-card .entity=${entity} .types=${types()} community-label="Nobel laureates"></lr-entity-card>`,
};

export const Empty: Story = {
  render: () => html`<lr-entity-card></lr-entity-card>`,
};

export const LiveHeadingLevel: Story = {
  render: () => html`
    <div>
      <button @click=${(event: Event) => {
        const card = (event.currentTarget as HTMLElement).nextElementSibling!;
        if (card.hasAttribute('aria-level')) card.removeAttribute('aria-level');
        else card.setAttribute('aria-level', '2');
      }}>Toggle heading level 2 / default 3</button>
      <lr-entity-card .entity=${entity} .types=${types()}></lr-entity-card>
    </div>
  `,
};

export const NoFocusButton: Story = {
  render: () => html`<lr-entity-card .entity=${entity} .types=${types()} without-focus-button></lr-entity-card>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;"><lr-entity-card .entity=${entity} .types=${types()}></lr-entity-card></div>`,
};

export const DensityAndChrome: Story = {
  name: 'size="s" + frame="plain"',
  render: () => html`
    <div style="display:grid; gap:1rem; max-width:28rem;">
      <lr-entity-card .entity=${entity} .types=${types()} community-label="Nobel laureates"></lr-entity-card>
      <lr-entity-card size="s" .entity=${entity} .types=${types()} community-label="Nobel laureates"></lr-entity-card>
      <div style="border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); padding:0.75rem;">
        <lr-entity-card
          frame="plain"
          .entity=${entity}
          .types=${types()}
          community-label="Nobel laureates"
        ></lr-entity-card>
      </div>
    </div>
  `,
};

export const RestingBackgroundToken: Story = {
  name: 'Retinting the resting frame',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-entity-card-bg` is the resting companion to the dense `size` tier\'s existing padding/gap levers, so a themed dossier list no longer needs a `::part(base)` rule or an app-wide `--lr-color-surface` change. `frame="plain"` still drops the fill entirely.',
      },
    },
  },
  render: () => html`
    <lr-entity-card
      .entity=${entity}
      .types=${types()}
      community-label="Nobel laureates"
      style="max-width: 28rem; --lr-entity-card-bg: var(--lr-color-brand-quiet)"
    ></lr-entity-card>
  `,
};
