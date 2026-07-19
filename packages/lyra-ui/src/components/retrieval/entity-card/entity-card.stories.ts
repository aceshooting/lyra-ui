import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './entity-card.js';
import type { LyraEntity } from './entity-card.class.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

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

const types = [{ id: 'person', label: 'Person', color: storyColor('chart1') }];

export const Default: Story = {
  render: () => html`<lr-entity-card .entity=${entity} .types=${types} community-label="Nobel laureates"></lr-entity-card>`,
};

export const Empty: Story = {
  render: () => html`<lr-entity-card></lr-entity-card>`,
};

export const NoFocusButton: Story = {
  render: () => html`<lr-entity-card .entity=${entity} .types=${types} ?show-focus-button=${false}></lr-entity-card>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;"><lr-entity-card .entity=${entity} .types=${types}></lr-entity-card></div>`,
};
