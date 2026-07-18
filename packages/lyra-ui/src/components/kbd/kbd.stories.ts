import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './kbd.js';

const meta: Meta = {
  title: 'Kbd',
  component: 'lr-kbd',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A small platform-aware chip for a keyboard shortcut. `keys` is a `+`-separated token sequence (`"mod+k"`, `"mod+shift+p"`); `mod` resolves to ⌘ on macOS and "Ctrl" everywhere else, computed once from `navigator.userAgentData`/`navigator.platform`/`navigator.userAgent` at module load. The rendered `aria-label` always spells the shortcut out in words (e.g. "Command+K") since the glyphs alone are not reliably announced by every screen reader.',
      },
    },
  },
  argTypes: {
    keys: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj;

export const Basic: Story = {
  args: { keys: 'mod+k' },
  render: (args) => html`<lr-kbd keys=${args.keys}></lr-kbd>`,
};

export const ModifierCombinations: Story = {
  name: 'Common modifier combinations',
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start;">
      <lr-kbd keys="mod+k"></lr-kbd>
      <lr-kbd keys="mod+shift+p"></lr-kbd>
      <lr-kbd keys="mod+alt+shift+n"></lr-kbd>
      <lr-kbd keys="ctrl+c"></lr-kbd>
      <lr-kbd keys="alt+enter"></lr-kbd>
    </div>
  `,
};

export const NamedKeys: Story = {
  name: 'Friendly labels for named keys',
  render: () => html`
    <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
      <lr-kbd keys="enter"></lr-kbd>
      <lr-kbd keys="esc"></lr-kbd>
      <lr-kbd keys="tab"></lr-kbd>
      <lr-kbd keys="space"></lr-kbd>
      <lr-kbd keys="backspace"></lr-kbd>
      <lr-kbd keys="delete"></lr-kbd>
      <lr-kbd keys="arrowup"></lr-kbd>
      <lr-kbd keys="arrowdown"></lr-kbd>
      <lr-kbd keys="arrowleft"></lr-kbd>
      <lr-kbd keys="arrowright"></lr-kbd>
    </div>
  `,
};

export const UnrecognizedTokensRenderAsTyped: Story = {
  name: 'Unrecognized tokens render as typed (single letters upper-cased)',
  render: () => html`
    <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
      <lr-kbd keys="k"></lr-kbd>
      <lr-kbd keys="f1"></lr-kbd>
      <lr-kbd keys="mod+/"></lr-kbd>
    </div>
  `,
};

export const InlineWithText: Story = {
  name: 'Inline alongside surrounding text',
  render: () => html`
    <p>
      Press <lr-kbd keys="mod+k"></lr-kbd> to open the command palette, or
      <lr-kbd keys="esc"></lr-kbd> to dismiss it.
    </p>
  `,
};

export const CustomSlotContent: Story = {
  name: 'Default slot overrides the keys-driven rendering',
  parameters: {
    docs: {
      description: {
        story:
          'Slotting content bypasses `keys` entirely (and the component stops asserting its own `aria-label` — the slotted content carries its own accessible name).',
      },
    },
  },
  render: () => html`<lr-kbd aria-label="Custom shortcut"><em>fn</em>+F5</lr-kbd>`,
};

export const EmptyState: Story = {
  name: 'No keys set (renders nothing, aria-hidden)',
  render: () => html`<lr-kbd></lr-kbd>`,
};
