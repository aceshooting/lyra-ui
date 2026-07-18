import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './community-card.js';
import type { LyraCommunity } from './community-card.class.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';

const meta: Meta = {
  title: 'Community Card',
  component: 'lyra-community-card',
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
  render: () => html`<lyra-community-card .community=${community} .members=${members}></lyra-community-card>`,
};

export const WithOverflow: Story = {
  render: () => html`<lyra-community-card .community=${community} .members=${members} max-members="2"></lyra-community-card>`,
};

export const Compact: Story = {
  render: () => html`<lyra-community-card .community=${community} .members=${members} compact></lyra-community-card>`,
};

export const Empty: Story = {
  render: () => html`<lyra-community-card></lyra-community-card>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;"><lyra-community-card .community=${community} .members=${members}></lyra-community-card></div>`,
};
