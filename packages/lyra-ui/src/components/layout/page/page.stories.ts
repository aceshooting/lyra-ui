import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './page.js';

const meta: Meta = {
  title: 'Layout/Page',
  component: 'lr-page',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A semantic application shell whose navigation is a desktop column or a modal mobile drawer based on the Page\'s own allocated inline size. Navigation content is projected through one static slot, so breakpoint crossings preserve node identity, focus, form state, and scroll state.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const shell = () => html`
  <div slot="banner" style="padding: .5rem 1rem; background: var(--lr-color-brand-quiet);">
    Scheduled maintenance begins at 18:00.
  </div>
  <div slot="header" style="padding: .75rem 1rem; font-weight: 700;">Lyra Workspace</div>
  <div slot="subheader" style="padding: .5rem 1rem; border-block-end: 1px solid var(--lr-color-border);">
    Analytics / Overview
  </div>
  <button slot="menu" style="margin: .75rem;">Actions</button>
  <strong slot="navigation-header" style="padding: 1rem;">Sections</strong>
  <div slot="navigation" style="display:grid; gap:.25rem; padding:0 1rem;">
    <a href="#overview">Overview</a>
    <a href="#activity">Activity</a>
    <a href="#settings">Settings</a>
  </div>
  <small slot="navigation-footer" style="padding: 1rem;">Acme team</small>
  <h1 slot="main-header" id="overview" style="margin:0; padding:1rem;">Overview</h1>
  <section id="activity" style="padding:0 1rem;">
    <h2>Recent activity</h2>
    <p>The Page grows with main content, keeping its footer below the initial viewport.</p>
  </section>
  <div slot="main-footer" style="padding:1rem;"><button>Load more</button></div>
  <div slot="aside" style="padding:1rem;">Related reports</div>
  <small slot="footer" style="display:block; padding:1rem; border-block-start:1px solid var(--lr-color-border);">
    Workspace footer
  </small>
`;

export const Desktop: Story = {
  render: () => html`
    <lr-page
      style="
        inline-size: min(100%, 64rem);
        --lr-page-menu-width: auto;
        --lr-page-main-width: 1fr;
        --lr-page-aside-width: 10rem;
        --lr-page-banner-height: 2.5rem;
        --lr-page-header-height: 3rem;
        --lr-page-subheader-height: 2.5rem;
      "
    >
      ${shell()}
    </lr-page>
  `,
};

export const MobileDrawer: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'This Page is allocated 320px, so its same navigation subtree becomes a modal drawer. The default localized button exposes `aria-expanded` and `aria-controls`; Escape and backdrop clicks close the drawer and return focus.',
      },
    },
  },
  render: () => html`
    <lr-page style="inline-size:320px; min-block-size:34rem; --lr-page-header-height:3rem;">
      ${shell()}
    </lr-page>
  `,
};

export const LogicalEndNavigationRtl: Story = {
  render: () => html`
    <lr-page
      dir="rtl"
      navigation-placement="end"
      style="inline-size:min(100%, 58rem); --lr-page-main-width:1fr; --lr-page-aside-width:9rem;"
    >
      ${shell()}
    </lr-page>
  `,
};

export const CustomToggleAndSkipLink: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The assigned custom toggle receives synchronized `aria-expanded`; its `aria-controls` points to the Page host as a resolvable bridge to the private drawer. Removing or replacing the toggle restores attributes still owned by the component.',
      },
    },
  },
  render: () => html`
    <lr-page style="inline-size:320px; --lr-page-header-height:3rem;">
      <span slot="skip-to-content">Skip straight to the dashboard</span>
      <button slot="navigation-toggle">Browse sections</button>
      ${shell()}
    </lr-page>
  `,
};
