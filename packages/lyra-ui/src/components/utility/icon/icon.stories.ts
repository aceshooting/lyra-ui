import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './icon.js';
import { registerIconLibrary } from './icon-library.js';

const meta: Meta = { title: 'Icon', component: 'lr-icon', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const CommonIcons: Story = { render: () => html`<div style="display:flex;gap:1rem;font-size:1.5rem"><lr-icon name="search"></lr-icon><lr-icon name="calendar"></lr-icon><lr-icon name="check"></lr-icon><lr-icon name="close"></lr-icon></div>` };

// A library is just a name-to-URL function. These demo glyphs are inlined as `data:` URLs so the
// story needs no network, but a real resolver returns a URL on your own icon host.
const DEMO_GLYPHS: Record<string, string> = {
  star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.6 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.3 2.8 1-6.1-4.4-4.3 6.1-.8Z"/></svg>',
  bolt: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6Z"/></svg>',
  heart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21S3 14.7 3 8.9A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 9 2.9C21 14.7 12 21 12 21Z"/></svg>',
};
registerIconLibrary('demo', {
  resolver: (name) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(DEMO_GLYPHS[name] ?? '')}`,
  mutator: (svg) => svg.setAttribute('fill', 'currentColor'),
});

export const RegisteredLibrary: Story = {
  render: () => html`<div style="display:flex;gap:1rem;font-size:1.5rem;color:var(--lr-color-brand)">
    <lr-icon library="demo" name="star" label="Star"></lr-icon>
    <lr-icon library="demo" name="bolt" label="Bolt"></lr-icon>
    <lr-icon library="demo" name="heart" label="Heart"></lr-icon>
  </div>`,
};

export const RotateAndFlip: Story = {
  render: () => html`<div style="display:flex;gap:1rem;font-size:1.5rem">
    <lr-icon name="chevron-right"></lr-icon>
    <lr-icon name="chevron-right" rotate="90"></lr-icon>
    <lr-icon name="chevron-right" flip="horizontal"></lr-icon>
    <lr-icon name="trash" flip="vertical"></lr-icon>
    <lr-icon name="trash" flip="both"></lr-icon>
  </div>`,
};

export const FixedWidth: Story = {
  render: () => html`<ul style="list-style:none;margin:0;padding:0;display:grid;gap:0.5rem;font-size:1.25rem">
    <li><lr-icon name="search" fixed-width></lr-icon> Search</li>
    <li><lr-icon name="calendar" fixed-width></lr-icon> Calendar</li>
    <li><lr-icon name="trash" fixed-width></lr-icon> Delete</li>
  </ul>`,
};
