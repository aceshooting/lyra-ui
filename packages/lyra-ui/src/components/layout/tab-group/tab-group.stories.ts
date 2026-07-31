import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tab-group.js';
import './tab.js';
import './tab-panel.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'Tabs',
  component: 'lr-tab-group',
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
    <lr-tab-group>
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lr-tab-group>
  `,
};

export const WithDisabledTab: Story = {
  render: () => html`
    <lr-tab-group>
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" disabled style="padding: 0.75rem 0;">
        Nothing to preview yet.
      </div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lr-tab-group>
  `,
};

export const InitiallyActive: Story = {
  render: () => html`
    <lr-tab-group active="preview">
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lr-tab-group>
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
    <lr-tab-group>
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" style="padding: 0.75rem 0;">This panel has no label, so it never gets a tab.</div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lr-tab-group>
  `,
};

export const ChangeEvent: Story = {
  render: () => html`
    <div>
      <lr-tab-group @lr-tab-show=${(e: CustomEvent<{ tabId: string }>) => {
        const out = document.getElementById('tabs-change-log');
        if (out) out.textContent = `Active tab: ${e.detail.tabId}`;
      }}>
        <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
        <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
        <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
      </lr-tab-group>
      <p id="tabs-change-log">Active tab: input</p>
    </div>
  `,
};

export const ScrollableOverflow: Story = {
  name: 'Scrollable overflow with edge fades',
  render: () => html`
    <div style="inline-size: 375px; max-inline-size: 100%;">
      <lr-tab-group>
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
      </lr-tab-group>
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
          'Set `--lr-tab-group-selected-color`, `--lr-tab-group-indicator-color` and `--lr-tab-group-hover-color` on the element or any ancestor — none are declared on `:host`, so an ancestor value is never shadowed. Hover the unselected tabs to see the hover color stay independent of the selected one.',
      },
    },
  },
  render: () => html`
    <div
      style="--lr-tab-group-selected-color: ${storyColor('success')}; --lr-tab-group-indicator-color: ${storyColor(
        'success',
      )}; --lr-tab-group-hover-color: ${storyColor('brand')};"
    >
      <lr-tab-group>
        <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
        <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
        <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
      </lr-tab-group>
    </div>
  `,
};

export const ElementModel: StoryObj = {
  name: 'Upstream child model (lr-tab / lr-tab-panel)',
  parameters: {
    docs: {
      description: {
        story:
          'The `<lr-tab>` + `<lr-tab-panel>` shape mirrors `wa-tab-group`/`sl-tab-group`, so that markup renames mechanically. The group assigns the `slot` attributes itself, and each tab\'s content is projected into the real `role="tab"` button — so a tab can carry an icon or badge while its accessible name stays exactly that content\'s text.',
      },
    },
  },
  render: () => html`
    <lr-tab-group>
      <lr-tab panel="general">General</lr-tab>
      <lr-tab panel="advanced">Advanced</lr-tab>
      <lr-tab panel="danger" disabled>Danger zone</lr-tab>
      <lr-tab-panel name="general" style="padding: 0.75rem 0;">General settings go here.</lr-tab-panel>
      <lr-tab-panel name="advanced" style="padding: 0.75rem 0;">Advanced settings go here.</lr-tab-panel>
      <lr-tab-panel name="danger" style="padding: 0.75rem 0;">Danger zone.</lr-tab-panel>
    </lr-tab-group>
  `,
};

export const Placement: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          '`start` and `end` are logical, so they mirror under RTL. Either one turns the tablist vertical, which switches the navigation keys to Up/Down per the WAI-ARIA APG.',
      },
    },
  },
  render: () => html`
    ${(['top', 'bottom', 'start', 'end'] as const).map(
      (placement) => html`
        <p style="margin-block: 1rem 0.25rem; font-weight: 600;">placement="${placement}"</p>
        <lr-tab-group placement=${placement}>
          <lr-tab panel="one-${placement}">First</lr-tab>
          <lr-tab panel="two-${placement}">Second</lr-tab>
          <lr-tab-panel name="one-${placement}" style="padding: 0.75rem;">First panel.</lr-tab-panel>
          <lr-tab-panel name="two-${placement}" style="padding: 0.75rem;">Second panel.</lr-tab-panel>
        </lr-tab-group>
      `,
    )}
  `,
};

export const ManualActivation: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'With `activation="manual"` the arrow keys move focus only and Enter or Space commits. The APG requires this whenever revealing a panel is expensive — automatic activation would load every panel the user arrows past.',
      },
    },
  },
  render: () => html`
    <lr-tab-group activation="manual">
      <lr-tab panel="cheap">Cheap</lr-tab>
      <lr-tab panel="expensive">Expensive</lr-tab>
      <lr-tab panel="also-expensive">Also expensive</lr-tab>
      <lr-tab-panel name="cheap" style="padding: 0.75rem 0;">Already loaded.</lr-tab-panel>
      <lr-tab-panel name="expensive" style="padding: 0.75rem 0;">Fetched on demand.</lr-tab-panel>
      <lr-tab-panel name="also-expensive" style="padding: 0.75rem 0;">Also fetched on demand.</lr-tab-panel>
    </lr-tab-group>
  `,
};
