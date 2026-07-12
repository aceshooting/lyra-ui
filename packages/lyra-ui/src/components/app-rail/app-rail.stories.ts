import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './app-rail.js';

const meta: Meta = {
  title: 'AppRail',
  component: 'lyra-app-rail',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Responsive nav rail: full (icon + label) -> icon-only (narrow rail) -> mobile (floating overlay behind a toggle button), driven by viewport-width matchMedia() breakpoints. Resize the preview frame to see it respond, or use the "Forced" stories below to pin a mode.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const navItems = html`
  <a href="#inbox" aria-label="Inbox" style="display:flex; align-items:center; gap:0.75rem; padding:0.5rem 0.75rem; border-radius:0.375rem; text-decoration:none; color:inherit;">
    <span aria-hidden="true">📥</span><span>Inbox</span>
  </a>
  <a href="#chats" aria-label="Chats" style="display:flex; align-items:center; gap:0.75rem; padding:0.5rem 0.75rem; border-radius:0.375rem; text-decoration:none; color:inherit;">
    <span aria-hidden="true">💬</span><span>Chats</span>
  </a>
  <a href="#settings" aria-label="Settings" style="display:flex; align-items:center; gap:0.75rem; padding:0.5rem 0.75rem; border-radius:0.375rem; text-decoration:none; color:inherit;">
    <span aria-hidden="true">⚙️</span><span>Settings</span>
  </a>
`;

const page = (rail: ReturnType<typeof html>) => html`
  <div style="display:flex; block-size: 24rem; border: 1px solid #d0d7de; border-radius: 0.5rem; overflow: hidden;">
    ${rail}
    <div style="flex:1; padding: 1.5rem; overflow: auto;">
      <h2 style="margin-top:0;">Page content</h2>
      <p>Resize this preview's frame narrower to watch the rail switch from full -> icon-only -> mobile.</p>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    page(html`
      <lyra-app-rail label="Primary" style="block-size:100%;">
        <span slot="header" style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem; font-weight:600;">
          <span aria-hidden="true">🌟</span><span>Acme</span>
        </span>
        ${navItems}
        <span slot="footer" style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem;">
          <span aria-hidden="true">👤</span><span>Jordan Lee</span>
        </span>
      </lyra-app-rail>
    `),
};

export const ForcedFull: Story = {
  name: 'Forced: full',
  render: () =>
    page(html`
      <lyra-app-rail label="Primary" mode="full" style="block-size:100%;">
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
      </lyra-app-rail>
    `),
};

export const ForcedIconOnly: Story = {
  name: 'Forced: icon-only',
  render: () =>
    page(html`
      <lyra-app-rail label="Primary" mode="icon-only" style="block-size:100%;">
        <span slot="header" style="padding:0.5rem; font-weight:600;">A</span>
        ${navItems}
      </lyra-app-rail>
    `),
};

export const ForcedMobile: Story = {
  name: 'Forced: mobile (click the toggle)',
  render: () =>
    page(html`
      <lyra-app-rail label="Primary" mode="mobile" style="block-size:100%;">
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
        <span slot="footer" style="padding:0.5rem;">Jordan Lee</span>
      </lyra-app-rail>
    `),
};

export const MobileOpenInitially: Story = {
  render: () =>
    page(html`
      <lyra-app-rail label="Primary" mode="mobile" open style="block-size:100%;">
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
      </lyra-app-rail>
    `),
};

export const CustomBreakpoints: Story = {
  render: () =>
    page(html`
      <lyra-app-rail
        label="Primary"
        icon-only-breakpoint="1400px"
        mobile-breakpoint="1000px"
        style="block-size:100%;"
      >
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
      </lyra-app-rail>
    `),
};
