import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraSize } from '../../../internal/variants.js';
import './menubar.js';
import '../menu/menu-label.js';
import '../../overlays/kbd/kbd.js';

const meta: Meta = {
  title: 'Layout/Menubar',
  component: 'lr-menubar',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An APG application menubar with roving title focus, RTL-aware traversal, typeahead, nested menus, and size/frame theme hooks. Keyboard focus opens a title menu; pointer activation remains available for mouse and touch users.',
      },
    },
  },
};
export default meta;

const titles = () => html`
  <lr-menubar-item>File<lr-menu slot="menu">
    <lr-menu-item value="new-tab" aria-keyshortcuts="Control+T Meta+T">New tab<lr-kbd slot="details" keys="mod+t"></lr-kbd></lr-menu-item>
    <lr-menu-item value="new-window">New window</lr-menu-item><hr />
    <lr-menu-item>Share<lr-menu slot="submenu"><lr-menu-item>Email link</lr-menu-item><lr-menu-item>Copy link</lr-menu-item></lr-menu></lr-menu-item>
    <lr-menu-item value="print">Print…</lr-menu-item>
  </lr-menu></lr-menubar-item>
  <lr-menubar-item>Edit<lr-menu slot="menu"><lr-menu-item>Undo</lr-menu-item><lr-menu-item>Redo</lr-menu-item><hr /><lr-menu-item>Cut</lr-menu-item><lr-menu-item>Copy</lr-menu-item><lr-menu-item>Paste</lr-menu-item></lr-menu></lr-menubar-item>
  <lr-menubar-item>View<lr-menu slot="menu"><lr-menu-item type="checkbox" checked>Show toolbar</lr-menu-item><lr-menu-item type="checkbox">Show bookmarks</lr-menu-item><hr /><lr-menu-item>Fullscreen</lr-menu-item></lr-menu></lr-menubar-item>
  <lr-menubar-item>Profiles<lr-menu slot="menu"><lr-menu-label>Switch profile</lr-menu-label><lr-menu-item type="radio" group="profile" checked>Personal</lr-menu-item><lr-menu-item type="radio" group="profile">Work</lr-menu-item></lr-menu></lr-menubar-item>`;

export const Default: StoryObj = {
  render: () => html`<div style="min-block-size:var(--lr-size-20rem)" @keydown=${(event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') {
      event.preventDefault();
      const output = (event.currentTarget as HTMLElement).querySelector('output');
      if (output) output.textContent = 'New tab requested';
    }
  }}><lr-menubar label="Application" @lr-select=${(event: CustomEvent<{ item: HTMLElement }>) => {
    const output = (event.currentTarget as HTMLElement).parentElement?.querySelector('output');
    if (output) output.textContent = `${event.detail.item.getAttribute('value') ?? event.detail.item.textContent?.trim()} selected`;
  }}>${titles()}</lr-menubar><output aria-live="polite"></output></div>`,
};
export const Rtl: StoryObj = { render: () => html`<div dir="rtl"><lr-menubar label="Application">${titles()}</lr-menubar></div>` };
export const Narrow: StoryObj = {
  render: () => html`<div style="inline-size:320px;max-inline-size:100%"><lr-menubar label="Application">${titles()}<lr-menubar-item>Window</lr-menubar-item><lr-menubar-item>A long application title that remains fully named</lr-menubar-item></lr-menubar></div>`,
};
export const Plain: StoryObj = { render: () => html`<lr-menubar label="Application" frame="plain">${titles()}</lr-menubar>` };
export const Sizes: StoryObj = {
  render: () => html`<div style="display:grid;gap:var(--lr-space-l)">${(['s', 'm', 'l'] as LyraSize[]).map(size => html`<lr-menubar label=${`Application ${size}`} size=${size}>${titles()}</lr-menubar>`)}</div>`,
};
export const DisabledAndAction: StoryObj = {
  render: () => html`<div><lr-menubar label="Application">${titles()}<lr-menubar-item disabled>Unavailable</lr-menubar-item><lr-menubar-item @click=${(event: Event) => {
    const output = (event.currentTarget as HTMLElement).closest('div')?.querySelector('output');
    if (output) output.textContent = 'Help requested';
  }}>Help</lr-menubar-item></lr-menubar><output aria-live="polite"></output></div>`,
};
