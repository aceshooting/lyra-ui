import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './icon.js';
import { registerIconLibrary } from './icon-library.js';

const meta: Meta = { title: 'Icon', component: 'lr-icon', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

export const CommonIcons: Story = {
  render: () => html`
    <div style="display:flex;gap:1rem;font-size:1.5rem">
      <lr-icon name="search"></lr-icon>
      <lr-icon name="calendar"></lr-icon>
      <lr-icon name="check"></lr-icon>
      <lr-icon name="close"></lr-icon>
    </div>
  `,
};

export const MappedDefaults: Story = {
  name: 'Default library and zero rotation',
  parameters: {
    docs: {
      description: {
        story: '`library` defaults to `default`, `rotate` defaults to zero, and setting `name` reflects it.',
      },
    },
  },
  render: () => html`<lr-icon name="search" label="Search"></lr-icon>`,
};

// Demo glyphs are data URLs so the story has no network dependency. A production resolver can
// return a URL on an icon host, synchronously or asynchronously.
const DEMO_GLYPHS: Record<string, string> = {
  star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.6 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.3 2.8 1-6.1-4.4-4.3 6.1-.8Z"/></svg>',
  bolt: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6Z"/></svg>',
  heart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21S3 14.7 3 8.9A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 9 2.9C21 14.7 12 21 12 21Z"/></svg>',
};

const dataUrl = (name: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(DEMO_GLYPHS[name] ?? '')}`;

registerIconLibrary('demo', {
  resolver: (name) => dataUrl(name),
  mutator: (svg) => svg.setAttribute('fill', 'currentColor'),
});

registerIconLibrary('demo-async', {
  resolver: async (name, family, variant) => {
    await Promise.resolve();
    const resolvedName = family === 'symbols' && variant === 'filled' ? name : '';
    return dataUrl(resolvedName);
  },
  mutator: (svg) => svg.setAttribute('fill', 'currentColor'),
});

export const RegisteredLibrary: Story = {
  render: () => html`
    <div style="display:flex;gap:1rem;font-size:1.5rem;color:var(--lr-color-brand)">
      <lr-icon library="demo" name="star" label="Star"></lr-icon>
      <lr-icon library="demo" name="bolt" label="Bolt"></lr-icon>
      <lr-icon library="demo" name="heart" label="Heart"></lr-icon>
    </div>
  `,
};

export const AsyncFamilyAndVariant: Story = {
  render: () => html`
    <div style="display:flex;align-items:center;gap:0.75rem;font-size:1.5rem">
      <lr-icon
        library="demo-async"
        family="symbols"
        variant="filled"
        name="star"
        label="Star"
      ></lr-icon>
      <span style="font-size:1rem">Async symbols / filled resolver</span>
    </div>
  `,
};

export const CanvasSizes: Story = {
  render: () => html`
    <div style="display:flex;align-items:center;gap:1rem;font-size:2rem">
      <span><lr-icon name="search"></lr-icon> fixed</span>
      <span><lr-icon name="search" canvas="auto"></lr-icon> auto</span>
      <span><lr-icon name="search" canvas="square"></lr-icon> square</span>
      <span><lr-icon name="search" canvas="roomy"></lr-icon> roomy</span>
    </div>
  `,
};

export const Animations: Story = {
  render: () => html`
    <div style="display:flex;align-items:center;gap:1.5rem;font-size:2rem">
      <span><lr-icon name="check" animation="beat"></lr-icon> beat</span>
      <span><lr-icon name="search" animation="bounce"></lr-icon> bounce</span>
      <span><lr-icon name="command" animation="spin"></lr-icon> spin</span>
      <span><lr-icon name="trash" animation="shake"></lr-icon> shake</span>
      <span><lr-icon name="check" animation="float"></lr-icon> float</span>
    </div>
  `,
};

export const RotateAndFlip: Story = {
  render: () => html`
    <div style="display:flex;gap:1rem;font-size:1.5rem">
      <lr-icon name="chevron-right"></lr-icon>
      <lr-icon name="chevron-right" rotate="90"></lr-icon>
      <lr-icon name="chevron-right" flip="x"></lr-icon>
      <lr-icon name="trash" flip="y"></lr-icon>
      <lr-icon name="trash" flip="both"></lr-icon>
    </div>
  `,
};

export const FixedWidth: Story = {
  render: () => html`
    <ul
      style="list-style:none;margin:0;padding:0;display:grid;gap:0.5rem;font-size:1.25rem"
    >
      <li><lr-icon name="search" fixed-width></lr-icon> Search</li>
      <li><lr-icon name="calendar" fixed-width></lr-icon> Calendar</li>
      <li><lr-icon name="trash" fixed-width></lr-icon> Delete</li>
    </ul>
  `,
};
