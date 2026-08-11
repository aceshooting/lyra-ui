import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './drawer.js';
import type { LyraDrawer } from './drawer.js';

const meta: Meta = {
  title: 'Drawer',
  component: 'lr-drawer',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const End: Story = {
  render: (_args, context) => html`<lr-drawer .open=${context.viewMode !== 'docs'} placement="end" label="Filters">
    <p>Use this panel for contextual controls without leaving the current page.</p>
    <div slot="footer"><button type="button">Apply</button></div>
  </lr-drawer>`,
};

export const Contained: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`contained` positions the drawer inside this relative wrapper as a nonmodal panel: no backdrop, page inerting, scroll lock, focus trap, top layer, or global Escape ownership.',
      },
    },
  },
  render: (_args, context) => html`
    <div
      style="position: relative; overflow: hidden; min-block-size: 20rem; border: 1px dashed var(--lr-color-border);"
    >
      <lr-drawer
        contained
        .open=${context.viewMode !== 'docs'}
        placement="end"
        label="Inspector"
        style="--size: 18rem"
      >
        <p>The rest of the page remains interactive.</p>
      </lr-drawer>
    </div>
  `,
};

export const Start: Story = {
  render: (_args, context) => html`<lr-drawer .open=${context.viewMode !== 'docs'} placement="start" aria-label="Navigation">
    <nav aria-label="Sections"><a href="#overview">Overview</a></nav>
  </lr-drawer>`,
};

export const NarrowLongContent: Story = {
  name: 'Narrow RTL viewport with long content (320px)',
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    docs: {
      description: {
        story:
          'A real 320px Storybook viewport, rather than a narrow wrapper on a desktop canvas. RTL long content and footer actions stay in the edge-bound sheet while the body keeps its own scrolling surface.',
      },
    },
  },
  render: (_args, context) => html`
    <lr-drawer
      .open=${context.viewMode !== 'docs'}
      dir="rtl"
      placement="end"
      heading="تصفيةالإعداداتالدوليةالطويلةجداً"
      closable
    >
      <p>محتوىدرججانبيمحليطويلجداًبدونأيفرصةللفصلالتلقائي</p>
      <p>تبقى خيارات التصفية والرسائل الطويلة قابلة للقراءة والتمرير داخل مساحة الدرج الضيقة.</p>
      <p>تغطي هذه القصة عنوان الدرج والمحتوى وإجراءات التذييل عند أصغر عرض مدعوم للواجهة.</p>
      <div slot="footer">
        <button type="button">إعادةتعيينكلعواملالتصفية</button>
        <button type="button">تطبيقالتغييراتومتابعةالبحث</button>
      </div>
    </lr-drawer>
  `,
};

export const Lifecycle: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`show()`/`hide()` and the `lr-show`/`lr-after-show`/`lr-hide`/`lr-after-hide` lifecycle are inherited from `<lr-dialog>` unchanged; `lr-after-hide` fires once the panel has finished sliding out. An open drawer sits in the browser top layer, so no consumer stacking context can cover it.',
      },
    },
  },
  render: () => html`
    <div style="position: relative; z-index: 0; isolation: isolate;">
      <button
        @click=${(e: Event) =>
          ((e.currentTarget as HTMLElement).parentElement!.querySelector('lr-drawer') as LyraDrawer).show()}
      >
        Open drawer
      </button>
      <lr-drawer
        heading="Filters"
        closable
        @lr-after-show=${() => console.info('lr-after-show')}
        @lr-after-hide=${() => console.info('lr-after-hide')}
      >
        <p>Slides in from the end edge, and back out again on close.</p>
        <input autofocus placeholder="[autofocus] takes initial focus" />
      </lr-drawer>
    </div>
  `,
};
