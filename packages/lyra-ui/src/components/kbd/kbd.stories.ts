import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './kbd.js';

const meta: Meta = {
  title: 'Kbd',
  component: 'lyra-kbd',
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
  render: (args) => html`<lyra-kbd keys=${args.keys}></lyra-kbd>`,
};

export const ModifierCombinations: Story = {
  name: 'Common modifier combinations',
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start;">
      <lyra-kbd keys="mod+k"></lyra-kbd>
      <lyra-kbd keys="mod+shift+p"></lyra-kbd>
      <lyra-kbd keys="mod+alt+shift+n"></lyra-kbd>
      <lyra-kbd keys="ctrl+c"></lyra-kbd>
      <lyra-kbd keys="alt+enter"></lyra-kbd>
    </div>
  `,
};

export const NamedKeys: Story = {
  name: 'Friendly labels for named keys',
  render: () => html`
    <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
      <lyra-kbd keys="enter"></lyra-kbd>
      <lyra-kbd keys="esc"></lyra-kbd>
      <lyra-kbd keys="tab"></lyra-kbd>
      <lyra-kbd keys="space"></lyra-kbd>
      <lyra-kbd keys="backspace"></lyra-kbd>
      <lyra-kbd keys="delete"></lyra-kbd>
      <lyra-kbd keys="arrowup"></lyra-kbd>
      <lyra-kbd keys="arrowdown"></lyra-kbd>
      <lyra-kbd keys="arrowleft"></lyra-kbd>
      <lyra-kbd keys="arrowright"></lyra-kbd>
    </div>
  `,
};

export const UnrecognizedTokensRenderAsTyped: Story = {
  name: 'Unrecognized tokens render as typed (single letters upper-cased)',
  render: () => html`
    <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
      <lyra-kbd keys="k"></lyra-kbd>
      <lyra-kbd keys="f1"></lyra-kbd>
      <lyra-kbd keys="mod+/"></lyra-kbd>
    </div>
  `,
};

export const InlineWithText: Story = {
  name: 'Inline alongside surrounding text',
  render: () => html`
    <p>
      Press <lyra-kbd keys="mod+k"></lyra-kbd> to open the command palette, or
      <lyra-kbd keys="esc"></lyra-kbd> to dismiss it.
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
  render: () => html`<lyra-kbd aria-label="Custom shortcut"><em>fn</em>+F5</lyra-kbd>`,
};

export const EmptyState: Story = {
  name: 'No keys set (renders nothing, aria-hidden)',
  render: () => html`<lyra-kbd></lyra-kbd>`,
};
