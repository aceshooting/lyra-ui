import { ref } from 'lit/directives/ref.js';
import '../page/page.js';
import '../../utility/divider/divider.js';
import type { LyraPage } from '../page/page.class.js';
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import "./app-rail.js";
import "../app-rail-group/app-rail-group.js";
import type { LyraAppRail } from "./app-rail.js";
import { storyColor } from "../../../../../../.storybook/theme-contract.js";

const meta: Meta = {
  title: "AppRail",
  component: "lr-app-rail",
  tags: ["autodocs"],
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
  <lr-app-rail-item href="#inbox" aria-label="Inbox" current
    ><span slot="icon">📥</span>Inbox</lr-app-rail-item
  >
  <lr-app-rail-item href="#chats" aria-label="Chats"
    ><span slot="icon">💬</span>Chats</lr-app-rail-item
  >
  <lr-app-rail-item href="#settings" aria-label="Settings"
    ><span slot="icon">⚙️</span>Settings</lr-app-rail-item
  >
`;

const page = (rail: ReturnType<typeof html>) => html`
  <div
    style="display:flex; block-size: 24rem; border: 1px solid var(--lr-color-border); border-radius: 0.5rem; overflow: hidden;"
  >
    ${rail}
    <div style="flex:1; padding: 1.5rem; overflow: auto;">
      <h2 style="margin-top:0;">Page content</h2>
      <p>
        Resize this preview's frame narrower to watch the rail switch from full
        -> icon-only -> mobile.
      </p>
    </div>
  </div>
`;

function capRailResizeRequest(event: Event): void {
  if ((event as CustomEvent<{ widthPx: number }>).detail.widthPx > 320)
    event.preventDefault();
}

export const Default: Story = {
  render: () =>
    page(html`
      <lr-app-rail label="Primary" style="block-size:100%;">
        <span
          slot="header"
          style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem; font-weight:600;"
        >
          <span aria-hidden="true">🌟</span><span>Acme</span>
        </span>
        ${navItems}
        <span
          slot="footer"
          style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem;"
        >
          <span aria-hidden="true">👤</span><span>Jordan Lee</span>
        </span>
      </lr-app-rail>
    `),
};

export const ForcedFull: Story = {
  name: "Forced: full",
  render: () =>
    page(html`
      <lr-app-rail label="Primary" force-mode="full" style="block-size:100%;">
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
      </lr-app-rail>
    `),
};

export const ForcedIconOnly: Story = {
  name: "Forced: icon-only",
  render: () =>
    page(html`
      <lr-app-rail label="Primary" force-mode="icon-only" style="block-size:100%;">
        <span slot="header" style="padding:0.5rem; font-weight:600;">A</span>
        ${navItems}
      </lr-app-rail>
    `),
};

export const ForcedMobile: Story = {
  name: "Forced: mobile (click the toggle)",
  render: () =>
    // 'mobile' can't be force-pinned via force-mode (the mobile breakpoint is always tracked
    // automatically -- see forceMode's own doc), so an oversized mobile-breakpoint keeps the
    // real breakpoint match true regardless of this preview frame's actual width instead.
    page(html`
      <lr-app-rail
        label="Primary"
        mobile-breakpoint="9999px"
        style="block-size:100%;"
      >
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
        <span slot="footer" style="padding:0.5rem;">Jordan Lee</span>
      </lr-app-rail>
    `),
};

function wireExternalTrigger(event: Event): void {
  const trigger = event.currentTarget as HTMLElement;
  const rail = trigger.parentElement!.querySelector(
    "lr-app-rail"
  ) as LyraAppRail;
  rail.trigger = trigger;
  rail.open = true;
}

export const ExternalMobileControl: Story = {
  name: "External mobile control (hide-toggle)",
  parameters: {
    docs: {
      description: {
        story:
          'Set `hide-toggle` when application-owned mobile navigation already has its own trigger, and assign that trigger to the rail\'s `trigger` property (or reference its id via `for`) so closing the overlay -- by any path, not just this button -- returns focus to it. If the trigger, opener, and built-in toggle are unavailable, focus returns to the rail host with a temporary tabindex that is removed on blur. The built-in `[part="toggle"]` stays hidden while closed, but survives `hide-toggle` once the overlay opens: reparented inside the trapped panel, it becomes the only in-panel dismiss control.',
      },
    },
  },
  render: () => html`
    <div>
      <button type="button" @click=${wireExternalTrigger}>
        Open navigation
      </button>
      ${page(html`
        <lr-app-rail
          hide-toggle
          label="Primary"
          mobile-breakpoint="9999px"
          style="block-size:100%;"
        >
          <span slot="header" style="padding:0.5rem; font-weight:600;"
            >Acme</span
          >
          ${navItems}
          <span slot="footer" style="padding:0.5rem;">Jordan Lee</span>
        </lr-app-rail>
      `)}
    </div>
  `,
};

export const NarrowRtlLongContent: Story = {
  name: "Narrow RTL long content (320px)",
  parameters: {
    docs: {
      description: {
        story:
          "An exact 320px allocation exercises the open mobile panel with RTL direction and long localized header, navigation, and footer content. The preview opens the drawer automatically; use its toggle in docs view.",
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
        mobile-breakpoint="9999px"
        .open=${context.viewMode !== "docs"}
        style="block-size: 100%; --lr-app-rail-mobile-width: 320px;"
      >
        <span slot="header"
          >عنوان-تطبيق-طويل-جداً-غير-قابل-للفصل-ويجب-أن-يلتف-داخل-اللوحة</span
        >
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

export const MobilePanelBelowAppBar: Story = {
  name: "Mobile panel below a fixed app bar",
  parameters: {
    docs: {
      description: {
        story:
          "--lr-app-rail-panel-inset-block-start leaves room above the drawer/scrim for a fixed app bar instead of the panel starting flush with the frame's top edge, and pairs naturally with --lr-app-rail-panel-radius to round the now-visible top corners.",
      },
    },
  },
  render: () => html`
    <div
      style="position: relative; block-size: var(--lr-size-22rem); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: 0.5rem; overflow: hidden;"
    >
      <div
        style="position: absolute; inset-block-start: 0; inset-inline: 0; block-size: 2.5rem; display: flex; align-items: center; padding-inline: 1rem; background: var(--lr-color-brand); color: var(--lr-color-on-brand); font-weight: 600; z-index: 1;"
      >
        Acme
      </div>
      <lr-app-rail
        label="Primary"
        open
        mobile-breakpoint="9999px"
        style="
          block-size: 100%;
          --lr-app-rail-panel-inset-block-start: 2.5rem;
          --lr-app-rail-panel-radius: var(--lr-radius);
        "
      >
        ${navItems}
        <span slot="footer" style="padding:0.5rem;">Jordan Lee</span>
      </lr-app-rail>
    </div>
  `,
};

export const FlushDrawerPerCornerRadius: Story = {
  name: "Flush drawer per-corner radius and nav spacing (cssprops)",
  parameters: {
    docs: {
      description: {
        story:
          "The mobile drawer sits flush against its own inline-start edge, so only the two corners away from it are rounded here via --lr-app-rail-panel-radius-start-end/-end-end -- the flush inline-start corners stay square. Both mirror automatically under dir=\"rtl\" with no second rule. --lr-app-rail-nav-padding/-gap retune [part=\"nav\"]'s own padding and inter-item gap.",
      },
    },
  },
  render: () => html`
    <lr-app-rail
      label="Primary"
      open
      mobile-breakpoint="9999px"
      style="
        block-size: var(--lr-size-22rem);
        --lr-app-rail-panel-radius-start-end: var(--lr-radius);
        --lr-app-rail-panel-radius-end-end: var(--lr-radius);
        --lr-app-rail-nav-padding: var(--lr-space-m);
        --lr-app-rail-nav-gap: var(--lr-space-m);
      "
    >
      ${navItems}
      <span slot="footer" style="padding:0.5rem;">Jordan Lee</span>
    </lr-app-rail>
  `,
};

export const ThemedInteractionStates: Story = {
  name: "Themed interaction states",
  parameters: {
    docs: {
      description: {
        story:
          "Hover/press the mobile toggle and full-mode resizer. Their scoped state hooks inherit from these wrappers without changing unrelated brand-colored components; inspect the accessibility tree to see localized pixel text alongside the resizer's numeric ARIA range.",
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-l);">
      <div
        style="
          --lr-app-rail-mobile-width: var(--lr-size-15rem);
          --lr-app-rail-overlay-color: ${storyColor("successQuiet")};
          --lr-app-rail-toggle-hover-bg: ${storyColor("successQuiet")};
          --lr-app-rail-toggle-hover-color: ${storyColor("success")};
          --lr-app-rail-toggle-active-bg: ${storyColor("warningQuiet")};
          --lr-app-rail-toggle-active-color: ${storyColor("warning")};
          font: 20px/1 monospace;
        "
      >
        <lr-app-rail mobile-breakpoint="9999px"></lr-app-rail>
      </div>
      <div
        style="
          --lr-app-rail-width: var(--lr-size-18rem);
          --lr-app-rail-resizer-hover-bg: ${storyColor("success")};
          --lr-app-rail-resizer-active-bg: ${storyColor("warning")};
        "
      >
        <lr-app-rail
          lang="ar-EG"
          force-mode="full"
          resizable
          .strings=${{ resizeValuePixels: 'العرض {value} بكسل' }}
          style="inline-size: var(--lr-app-rail-width); block-size: var(--lr-size-10rem);"
        ></lr-app-rail>
      </div>
    </div>
  `,
};

export const MobileOpenInitially: Story = {
  render: (_args, context) =>
    page(html`
      <lr-app-rail
        label="Primary"
        mobile-breakpoint="9999px"
        .open=${context.viewMode !== "docs"}
        style="block-size:100%;"
      >
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
  name: "Layout-only persistence",
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

export const CancelableResize: Story = {
  name: "Cancelable resize",
  parameters: {
    docs: {
      description: {
        story:
          "The `lr-rail-resize-request` event proposes each drag or keyboard width before the rail commits it. This example vetoes widths above 320px, so dragging past that limit leaves the current width in place.",
      },
    },
  },
  render: () =>
    page(html`
      <lr-app-rail
        label="Primary"
        force-mode="full"
        resizable
        rail-width-px="280"
        @lr-rail-resize-request=${capRailResizeRequest}
        style="block-size:100%;"
      >
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
      </lr-app-rail>
    `),
};

export const StopResizingOnRequest: Story = {
  name: 'Stop resizing from a request listener',
  parameters: {
    docs: {
      description: {
        story: 'The first resize request disables resizing and sets a final width of 300px. The pending proposal preserves that listener state and emits no committed resize event.',
      },
    },
  },
  render: () => page(html`
    <lr-app-rail label="Primary" force-mode="full" resizable rail-width-px="240"
      style="block-size: 100%;"
      @lr-rail-resize-request=${(event: Event) => {
        const rail = event.currentTarget as LyraAppRail;
        rail.resizable = false;
        rail.railWidthPx = 300;
      }}>
      ${navItems}
    </lr-app-rail>
  `),
};

export const CollapsibleDesktopRail: Story = {
  name: "Desktop collapse control",
  parameters: {
    docs: {
      description: {
        story:
          "`collapsible` renders a collapse control in the header that flips the rail between its full and icon-only presentations. It writes `preferred-mode`, so pairing it with `storage-key` and `persist=\"width preferred-mode\"` remembers the choice across reloads; the control is not rendered at all in mobile mode.",
      },
    },
  },
  render: () =>
    page(html`
      <lr-app-rail
        label="Primary"
        collapsible
        storage-key="storybook-collapse"
        persist="width preferred-mode"
        style="block-size:100%;"
      >
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
      </lr-app-rail>
    `),
};

export const ReservedHeaderHeight: Story = {
  name: "Reserved header height (cssprop)",
  parameters: {
    docs: {
      description: {
        story:
          "`--lr-app-rail-header-min-block-size` reserves room for header content that mounts or resizes asynchronously (e.g. an avatar image), so the nav below it doesn't jump once that content lands.",
      },
    },
  },
  render: () =>
    page(html`
      <lr-app-rail
        label="Primary"
        style="block-size:100%; --lr-app-rail-header-min-block-size: 96px;"
      >
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        ${navItems}
      </lr-app-rail>
    `),
};

export const GroupedSections: Story = {
  name: "Grouped sections",
  parameters: {
    docs: {
      description: {
        story:
          "`<lr-app-rail-group>` titles a section of items and can collapse it. A slotted group is marked icon-only by the rail exactly like a slotted item, and forwards that state to the items it owns.",
      },
    },
  },
  render: () =>
    page(html`
      <lr-app-rail label="Primary" collapsible style="block-size:100%;">
        <span slot="header" style="padding:0.5rem; font-weight:600;">Acme</span>
        <lr-app-rail-group collapsible heading="Workspaces">
          <lr-app-rail-item href="#atlas" current
            ><span slot="icon">🗂️</span>Atlas
            <span slot="meta">12</span></lr-app-rail-item
          >
          <lr-app-rail-item href="#beacon"
            ><span slot="icon">📡</span>Beacon</lr-app-rail-item
          >
        </lr-app-rail-group>
        <lr-app-rail-group heading="Support">
          <lr-app-rail-item href="#docs"
            ><span slot="icon">📚</span>Docs</lr-app-rail-item
          >
        </lr-app-rail-group>
      </lr-app-rail>
    `),
};

const sidebarItems = () => html`
  <lr-app-rail-group heading="Platform">
    <lr-app-rail-item href="#projects" current tooltip><span slot="icon">▦</span>Projects<span slot="meta">3</span></lr-app-rail-item>
    <lr-app-rail-item href="#account" tooltip expanded><span slot="icon">○</span>Account<lr-app-rail-item slot="children" href="#profile">Profile</lr-app-rail-item><lr-app-rail-item slot="children" href="#security">Security</lr-app-rail-item></lr-app-rail-item>
  </lr-app-rail-group>
  <lr-divider style="align-self:stretch"></lr-divider>
  <lr-app-rail-item href="#settings" tooltip><span slot="icon">⚙</span>Settings</lr-app-rail-item>`;

export const SidebarFloating: Story = {
  parameters: { docs: { description: { story: 'A floating sidebar frame with grouped navigation. Collapse preserves nested expansion and exposes compact item tooltips.' } } },
  render: () => html`<div style="display:flex;block-size:28rem;background:var(--lr-color-surface-raised)"><lr-app-rail label="Workspace" frame="card" collapsible>${sidebarItems()}</lr-app-rail><main style="flex:1;padding:var(--lr-space-l)"><h2>Projects</h2><p>Use the rail collapse control or narrow the preview.</p></main></div>`,
};

export const SidebarInset: Story = {
  parameters: { docs: { description: { story: 'An edgeless rail beside a main content card. End actions stay visible, so this composition keeps the full-width rail.' } } },
  render: () => html`<div style="display:flex;block-size:28rem;background:var(--lr-color-surface-raised)"><lr-app-rail label="Workspace" frame="plain" icon-only-breakpoint="0px">${sidebarItems()}<lr-app-rail-item><span slot="icon">＋</span>Create project<button slot="end" aria-label="Project options">⋯</button></lr-app-rail-item></lr-app-rail><main style="flex:1;margin:var(--lr-space-s);padding:var(--lr-space-l);background:var(--lr-color-surface);border:var(--lr-border-width-thin) solid var(--lr-color-border-subtle);border-radius:var(--lr-radius);box-shadow:var(--lr-shadow-s)"><h2>Project overview</h2><p>The content owns its card presentation.</p></main></div>`,
};

export const SidebarTriggerAndShortcut: Story = {
  parameters: { docs: { description: { story: 'One external trigger calls toggle() in every mode. The rail manages its disclosure state and shortcut; Mod+B toggles unless focus is editing text. Offcanvas follows viewport breakpoints.' } } },
  render: () => html`<div style="display:flex;block-size:28rem"><lr-app-rail id="sidebar-nav" label="Workspace" frame="card" hide-toggle trigger-collapses for="sidebar-trigger" hotkey="mod+b" storage-key="sidebar-story" persist="preferred-mode">${sidebarItems()}</lr-app-rail><main style="flex:1;padding:var(--lr-space-l)"><button id="sidebar-trigger" type="button" @click=${(event: Event) => {
    (event.currentTarget as HTMLElement).closest('main')?.parentElement?.querySelector<LyraAppRail>('lr-app-rail')?.toggle();
  }}>Toggle sidebar</button><h2>Workspace</h2><p>Try Mod+B, or the same trigger at a mobile viewport width.</p></main></div>`,
};

export const SidebarInPage: Story = {
  parameters: { docs: { description: { story: 'The page owns an allocation-based drawer. Mobile uses its navigation toggle; desktop uses the rail collapse control. The rail is pinned full in mobile view, and its shortcut only acts on desktop.' } } },
  render: () => {
    let observer: MutationObserver | undefined;
    return html`<div style="inline-size:100%;block-size:30rem"><style>lr-page[view='mobile'] lr-app-rail::part(collapse-toggle) { display:none; }</style><lr-page ${ref(element => {
      observer?.disconnect();
      if (!element) return;
      const page = element as LyraPage;
      queueMicrotask(() => {
        if (!page.isConnected) return;
        const rail = page.querySelector<LyraAppRail>('lr-app-rail');
        if (!rail) return;
        const sync = () => { rail.forceMode = page.view === 'mobile' ? 'full' : 'auto'; };
        observer = new MutationObserver(sync); observer.observe(page, { attributes: true, attributeFilter: ['view'] }); sync();
      });
    })}><lr-app-rail slot="navigation" label="Workspace" frame="plain" mobile-breakpoint="0px" icon-only-breakpoint="0px" collapsible hotkey="mod+b">${sidebarItems()}</lr-app-rail><h2>Allocation-aware workspace</h2><p>Resize this story's container to reveal the page navigation toggle.</p></lr-page></div>`;
  },
};
