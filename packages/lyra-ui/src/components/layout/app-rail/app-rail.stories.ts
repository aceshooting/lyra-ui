import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './app-rail.js';
import type { LyraAppRail } from './app-rail.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = {
  title: 'AppRail',
  component: 'lr-app-rail',
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
  <lr-app-rail-item href="#inbox" aria-label="Inbox" active><span slot="icon">📥</span>Inbox</lr-app-rail-item>
  <lr-app-rail-item href="#chats" aria-label="Chats"><span slot="icon">💬</span>Chats</lr-app-rail-item>
  <lr-app-rail-item href="#settings" aria-label="Settings"><span slot="icon">⚙️</span>Settings</lr-app-rail-item>
`;

const page = (rail: ReturnType<typeof html>) => html`
  <div style="display:flex; block-size: 24rem; border: 1px solid var(--lr-color-border); border-radius: 0.5rem; overflow: hidden;">
    ${rail}
    <div style="flex:1; padding: 1.5rem; overflow: auto;">
      <h2 style="margin-top:0;">Page content</h2>
      <p>Resize this preview's frame narrower to watch the rail switch from full -> icon-only -> mobile.</p>
    </div>
  </div>
`;

function openExternalRail(event: Event): void {
  const trigger = event.currentTarget as HTMLElement;
  const rail = trigger.parentElement!.querySelector('lr-app-rail') as LyraAppRail;
  rail.open = true;
}

export const Default: Story = {
  render: () =>
    page(html`
      <lr-app-rail label="Primary" style="block-size:100%;">
        <span slot="header" style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem; font-weight:600;">
          <span aria-hidden="true">🌟</span><span>Acme</span>
        </span>
        ${navItems}
        <span slot="footer" style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem;">
          <span aria-hidden="true">👤</span><span>Jordan Lee</span>
        </span>
      </lr-app-rail>
    `),
};

export const ForcedFull: Story = {
  name: 'Forced: full',
  render: () =>
    page(html`
      <lr-app-rail label="Primary" mode="full" style="block-size:100%;">
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
      </lr-app-rail>
    `),
};

export const ForcedIconOnly: Story = {
  name: 'Forced: icon-only',
  render: () =>
    page(html`
      <lr-app-rail label="Primary" mode="icon-only" style="block-size:100%;">
        <span slot="header" style="padding:0.5rem; font-weight:600;">A</span>
        ${navItems}
      </lr-app-rail>
    `),
};

export const ForcedMobile: Story = {
  name: 'Forced: mobile (click the toggle)',
  render: () =>
    page(html`
      <lr-app-rail label="Primary" mode="mobile" style="block-size:100%;">
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
        <span slot="footer" style="padding:0.5rem;">Jordan Lee</span>
      </lr-app-rail>
    `),
};

export const ExternalMobileControl: Story = {
  name: 'External mobile control (hide-toggle)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `hide-toggle` when application-owned mobile navigation already has its own trigger. This native control opens the rail through its public `open` property while the built-in `[part="toggle"]` stays hidden.',
      },
    },
  },
  render: () => html`
    <div>
      <button type="button" @click=${openExternalRail}>Open navigation</button>
      ${page(html`
        <lr-app-rail hide-toggle label="Primary" mode="mobile" style="block-size:100%;">
          <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
          ${navItems}
          <span slot="footer" style="padding:0.5rem;">Jordan Lee</span>
        </lr-app-rail>
      `)}
    </div>
  `,
};

export const NarrowRtlLongContent: Story = {
  name: 'Narrow RTL long content (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'An exact 320px allocation exercises the open mobile panel with RTL direction and long localized header, navigation, and footer content. The preview opens the drawer automatically; use its toggle in docs view.',
      },
    },
  },
  render: (_args, context) => html`
    <div
      dir="rtl"
      style="inline-size: 320px; max-inline-size: 100%; block-size: var(--lr-size-22rem); border: var(--lr-border-width-thin) solid var(--lr-color-border); overflow: hidden;"
    >
      <lr-app-rail
        label="التنقل الرئيسي"
        mode="mobile"
        .open=${context.viewMode !== 'docs'}
        style="block-size: 100%; --lr-app-rail-mobile-width: 320px;"
      >
        <span slot="header">عنوان-تطبيق-طويل-جداً-غير-قابل-للفصل-ويجب-أن-يلتف-داخل-اللوحة</span>
        <lr-app-rail-item href="#reports">
          <span slot="icon" aria-hidden="true">📊</span>
          تقرير-تحليلي-طويل-جداً-غير-قابل-للفصل
        </lr-app-rail-item>
        <lr-app-rail-item href="#archive">
          <span slot="icon" aria-hidden="true">🗂️</span>
          أرشيف-المستندات-ذات-الأسماء-الطويلة-جداً
        </lr-app-rail-item>
        <span slot="footer">حساب-مستخدم-طويل-جداً-غير-قابل-للفصل</span>
      </lr-app-rail>
    </div>
  `,
};

export const ThemedInteractionStates: Story = {
  name: 'Themed interaction states',
  parameters: {
    docs: {
      description: {
        story:
          'Hover/press the mobile toggle and full-mode resizer. Their scoped state hooks inherit from these wrappers without changing unrelated brand-colored components.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-l);">
      <lr-app-rail
        mode="mobile"
        style="
          --lr-app-rail-toggle-hover-bg: ${storyColor('successQuiet')};
          --lr-app-rail-toggle-hover-color: ${storyColor('success')};
          --lr-app-rail-toggle-active-bg: ${storyColor('warningQuiet')};
          --lr-app-rail-toggle-active-color: ${storyColor('warning')};
        "
      ></lr-app-rail>
      <lr-app-rail
        mode="full"
        resizable
        style="
          inline-size: var(--lr-app-rail-width);
          block-size: var(--lr-size-10rem);
          --lr-app-rail-resizer-hover-bg: ${storyColor('success')};
          --lr-app-rail-resizer-active-bg: ${storyColor('warning')};
        "
      ></lr-app-rail>
    </div>
  `,
};

export const MobileOpenInitially: Story = {
  render: (_args, context) =>
    page(html`
      <lr-app-rail label="Primary" mode="mobile" .open=${context.viewMode !== 'docs'} style="block-size:100%;">
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
      </lr-app-rail>
    `),
};

export const CustomBreakpoints: Story = {
  render: () =>
    page(html`
      <lr-app-rail
        label="Primary"
        icon-only-breakpoint="1400px"
        mobile-breakpoint="1000px"
        style="block-size:100%;"
      >
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
      </lr-app-rail>
    `),
};

export const LayoutOnlyPersistence: Story = {
  name: 'Layout-only persistence',
  parameters: {
    docs: {
      description: {
        story:
          '`persist="width preferred-mode"` restores the user’s rail width and collapse preference without restoring the transient mobile overlay open.',
      },
    },
  },
  render: () =>
    page(html`
      <lr-app-rail
        label="Primary"
        resizable
        storage-key="storybook-layout-only"
        persist="width preferred-mode"
        preferred-mode="full"
        style="block-size:100%;"
      >
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
      </lr-app-rail>
    `),
};
