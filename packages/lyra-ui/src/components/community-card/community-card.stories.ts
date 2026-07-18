import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './community-card.js';
import type { LyraCommunity } from './community-card.class.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';

const meta: Meta = {
  title: 'Community Card',
  component: 'lr-community-card',
};
export default meta;
type Story = StoryObj;

const community: LyraCommunity = {
  id: 'c1',
  label: 'Nobel laureates',
  summary: 'A cluster of physics and chemistry prize winners connected through shared research.',
  memberCount: 5,
};
const members: LyraEntity[] = [
  { id: 'e1', label: 'Marie Curie' },
  { id: 'e2', label: 'Pierre Curie' },
  { id: 'e3', label: 'Henri Becquerel' },
];

export const Default: Story = {
  render: () => html`<lr-community-card .community=${community} .members=${members}></lr-community-card>`,
};

export const WithOverflow: Story = {
  render: () => html`<lr-community-card .community=${community} .members=${members} max-members="2"></lr-community-card>`,
};

export const Compact: Story = {
  render: () => html`<lr-community-card .community=${community} .members=${members} compact></lr-community-card>`,
};

export const Empty: Story = {
  render: () => html`<lr-community-card></lr-community-card>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;"><lr-community-card .community=${community} .members=${members}></lr-community-card></div>`,
};
