import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './dock-panel.js';

const meta: Meta = {
  title: 'DockPanel',
  component: 'lyra-dock-panel',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const mainContent = html`
  <div style="padding: 1rem;">
    <h3 style="margin-top: 0;">Main content</h3>
    <p>The dock panel drops in next to this content with no layout restructuring — no shared
    parent needs to become an <code>&lt;lyra-split&gt;</code> child list.</p>
  </div>
`;

export const DockedEnd: Story = {
  render: () => html`
    <div style="position: relative; height: 20rem; border: 1px solid #ddd; display: flex;">
      <div style="flex: 1; overflow: auto;">${mainContent}</div>
      <lyra-dock-panel edge="end" size="280px" min-size="180px" max-size="480px">
        <div style="padding: 1rem;">
          <strong>Docked to the end edge</strong>
          <p>Drag the left edge (in LTR) to resize, or focus it and press ArrowLeft/ArrowRight.</p>
        </div>
      </lyra-dock-panel>
    </div>
  `,
};

export const DockedStart: Story = {
  render: () => html`
    <div style="position: relative; height: 20rem; border: 1px solid #ddd; display: flex;">
      <lyra-dock-panel edge="start" size="240px" min-size="160px" max-size="400px">
        <div style="padding: 1rem;">
          <strong>Docked to the start edge</strong>
          <p>Drag the right edge (in LTR) to resize.</p>
        </div>
      </lyra-dock-panel>
      <div style="flex: 1; overflow: auto;">${mainContent}</div>
    </div>
  `,
};

export const CollapsibleSidebar: Story = {
  render: () => html`
    <div style="position: relative; height: 20rem; border: 1px solid #ddd; display: flex;">
      <div style="flex: 1; overflow: auto;">${mainContent}</div>
      <lyra-dock-panel edge="end" size="280px" collapsible>
        <div style="padding: 1rem;">
          <strong>Collapsible</strong>
          <p>The chevron button collapses this panel to a persistent rail without losing its
          restored size.</p>
        </div>
      </lyra-dock-panel>
    </div>
  `,
};

export const DockedBottom: Story = {
  render: () => html`
    <div style="position: relative; height: 20rem; border: 1px solid #ddd; display: flex; flex-direction: column;">
      <div style="flex: 1; overflow: auto;">${mainContent}</div>
      <lyra-dock-panel edge="bottom" size="140px" min-size="80px" max-size="320px" collapsible>
        <div style="padding: 1rem;">
          <strong>Docked to the bottom edge</strong>
          <p>Drag the top edge, or use ArrowUp/ArrowDown while the handle is focused.</p>
        </div>
      </lyra-dock-panel>
    </div>
  `,
};

export const RtlDockedEnd: Story = {
  render: () => html`
    <div dir="rtl" style="position: relative; height: 20rem; border: 1px solid #ddd; display: flex;">
      <div style="flex: 1; overflow: auto;">${mainContent}</div>
      <lyra-dock-panel edge="end" size="280px" min-size="180px" max-size="480px">
        <div style="padding: 1rem;">
          <strong>RTL, docked to the end edge</strong>
          <p>"end" now renders on the physical left; the draggable inner edge and arrow-key
          directions both mirror to match.</p>
        </div>
      </lyra-dock-panel>
    </div>
  `,
};

export const NotResizable: Story = {
  render: () => html`
    <div style="position: relative; height: 12rem; border: 1px solid #ddd; display: flex;">
      <div style="flex: 1; overflow: auto;">${mainContent}</div>
      <lyra-dock-panel edge="end" size="220px" .resizable=${false} collapsible>
        <div style="padding: 1rem;">Fixed-size panel — no drag handle renders at all.</div>
      </lyra-dock-panel>
    </div>
  `,
};
