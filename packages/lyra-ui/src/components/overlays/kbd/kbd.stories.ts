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
          'A small platform-aware chip for a keyboard shortcut. `keys` is a `+`-separated token sequence (`"mod+k"`, `"mod+shift+p"`); `mod` resolves to ⌘ on macOS and "Ctrl" everywhere else. `platform="auto"` detects the browser platform, while `mac`, `windows`, and `linux` make rendering deterministic. The rendered `aria-label` always spells the shortcut out in words. Removing keys safely clears the shortcut. Unknown tokens, including constructor and __proto__, render and name themselves verbatim; recognized modifiers keep their localized labels.',
      },
    },
  },
  argTypes: {
    keys: { control: 'text' },
    platform: { control: 'select', options: ['auto', 'mac', 'windows', 'linux'] },
  },
};
export default meta;
type Story = StoryObj;

export const Basic: Story = {
  args: { keys: 'mod+k', platform: 'auto' },
  render: (args) => html`<lr-kbd keys=${args.keys} platform=${args.platform}></lr-kbd>`,
};

export const DeterministicPlatforms: Story = {
  render: () => html`
    <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
      <lr-kbd keys="mod+alt+k" platform="mac"></lr-kbd>
      <lr-kbd keys="mod+alt+k" platform="windows"></lr-kbd>
      <lr-kbd keys="mod+alt+k" platform="linux"></lr-kbd>
    </div>
  `,
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
          'Slotting content bypasses `keys` entirely. Without a host name the slotted content keeps its own semantics; with the `aria-label` shown here, the wrapper exposes `role="img"` and forwards that name.',
      },
    },
  },
  render: () => html`<lr-kbd aria-label="Custom shortcut"><em>fn</em>+F5</lr-kbd>`,
};

export const EmptyState: Story = {
  name: 'No keys set (renders nothing, aria-hidden)',
  render: () => html`<lr-kbd></lr-kbd>`,
};
