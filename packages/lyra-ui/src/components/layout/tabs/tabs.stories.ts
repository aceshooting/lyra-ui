import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tabs.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'Tabs',
  component: 'lr-tabs',
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
    <lr-tabs>
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lr-tabs>
  `,
};

export const WithDisabledTab: Story = {
  render: () => html`
    <lr-tabs>
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" disabled style="padding: 0.75rem 0;">
        Nothing to preview yet.
      </div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lr-tabs>
  `,
};

export const InitiallyActive: Story = {
  render: () => html`
    <lr-tabs active="preview">
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lr-tabs>
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
    <lr-tabs>
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" style="padding: 0.75rem 0;">This panel has no label, so it never gets a tab.</div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lr-tabs>
  `,
};

export const ChangeEvent: Story = {
  render: () => html`
    <div>
      <lr-tabs @lr-tabs-change=${(e: CustomEvent<{ tabId: string }>) => {
        const out = document.getElementById('tabs-change-log');
        if (out) out.textContent = `Active tab: ${e.detail.tabId}`;
      }}>
        <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
        <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
        <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
      </lr-tabs>
      <p id="tabs-change-log">Active tab: input</p>
    </div>
  `,
};

export const ScrollableOverflow: Story = {
  name: 'Scrollable overflow with edge fades',
  render: () => html`
    <div style="inline-size: 375px; max-inline-size: 100%;">
      <lr-tabs>
        ${[
          ['overview', 'Overview'],
          ['activity', 'Activity history'],
          ['artifacts', 'Generated artifacts'],
          ['evaluations', 'Evaluations'],
          ['settings', 'Workspace settings'],
          ['permissions', 'Permissions and access'],
        ].map(
          ([id, label]) => html`<div slot=${id} label=${label} style="padding: 0.75rem 0;">${label} panel</div>`,
        )}
      </lr-tabs>
    </div>
  `,
};

/** The selected tab's text color, its underline color, and the hover color of an *unselected* tab
 *  are three independent hooks. Before them, recoloring the selection meant hijacking library-wide
 *  `--lr-color-brand`/`--lr-color-text`, which repainted hovered-unselected tabs with it too. */
export const ThemedSelection: Story = {
  name: 'Themed selection (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `--lr-tabs-selected-color`, `--lr-tabs-indicator-color` and `--lr-tabs-hover-color` on the element or any ancestor — none are declared on `:host`, so an ancestor value is never shadowed. Hover the unselected tabs to see the hover color stay independent of the selected one.',
      },
    },
  },
  render: () => html`
    <div
      style="--lr-tabs-selected-color: ${storyColor('success')}; --lr-tabs-indicator-color: ${storyColor(
        'success',
      )}; --lr-tabs-hover-color: ${storyColor('brand')};"
    >
      <lr-tabs>
        <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
        <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
        <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
      </lr-tabs>
    </div>
  `,
};
