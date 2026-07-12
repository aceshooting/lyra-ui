import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tabs.js';

const meta: Meta = {
  title: 'Tabs',
  component: 'lyra-tabs',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A tab strip whose panels are direct light-DOM children, each carrying `slot="<id>"` and `label="<text>"`. A child with no `label` never produces a tab; a `disabled` child renders its tab but skips it in keyboard nav and blocks activation.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-tabs>
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lyra-tabs>
  `,
};

export const WithDisabledTab: Story = {
  render: () => html`
    <lyra-tabs>
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" disabled style="padding: 0.75rem 0;">
        Nothing to preview yet.
      </div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lyra-tabs>
  `,
};

export const InitiallyActive: Story = {
  render: () => html`
    <lyra-tabs active="preview">
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lyra-tabs>
  `,
};

export const AutoHiddenPanel: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The "Preview" panel has no `label` attribute, so it never produces a tab -- no explicit hidden flag needed.',
      },
    },
  },
  render: () => html`
    <lyra-tabs>
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" style="padding: 0.75rem 0;">This panel has no label, so it never gets a tab.</div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lyra-tabs>
  `,
};

export const ChangeEvent: Story = {
  render: () => html`
    <div>
      <lyra-tabs @lyra-tabs-change=${(e: CustomEvent<{ tabId: string }>) => {
        const out = document.getElementById('tabs-change-log');
        if (out) out.textContent = `Active tab: ${e.detail.tabId}`;
      }}>
        <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
        <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
        <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
      </lyra-tabs>
      <p id="tabs-change-log">Active tab: input</p>
    </div>
  `,
};
