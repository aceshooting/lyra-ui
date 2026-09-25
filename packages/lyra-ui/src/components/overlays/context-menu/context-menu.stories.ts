import type { Meta, StoryContext, StoryObj } from '@storybook/web-components-vite';
import { html, type TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import './context-menu.js';
import '../../layout/menu/menu-label.js';
import type { LyraContextMenu, LyraContextMenuShowDetail } from './context-menu.class.js';

const meta: Meta = {
  title: 'Overlay/Context Menu',
  component: 'lr-context-menu',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Turns any slotted region into a context-menu target: right-click, touch press-and-hold, or Shift+F10 / the ContextMenu key on a focused element opens the menu engine beside the pointer or below the element. `lr-show` is a real veto that leaves the platform menu in place.',
      },
    },
  },
};
export default meta;

const regionStyle =
  'display: grid; place-items: center; inline-size: var(--lr-size-24rem); max-inline-size: 100%; ' +
  'block-size: var(--lr-size-12rem); border: var(--lr-size-0-0625rem) dashed var(--lr-color-border); ' +
  'border-radius: var(--lr-radius);';

const rows = (): TemplateResult => html`
  <lr-menu-label>Edit</lr-menu-label>
  <lr-menu-item value="cut">Cut<span slot="details">Ctrl+X</span></lr-menu-item>
  <lr-menu-item value="copy">Copy<span slot="details">Ctrl+C</span></lr-menu-item>
  <lr-menu-item value="paste" disabled>Paste<span slot="details">Ctrl+V</span></lr-menu-item>
  <hr />
  <lr-menu-item value="wrap" type="checkbox" checked>Wrap lines</lr-menu-item>
  <lr-menu-item value="list" type="radio" group="view" checked>List view</lr-menu-item>
  <lr-menu-item value="grid" type="radio" group="view">Grid view</lr-menu-item>
  <hr />
  <lr-menu-item value="share">
    Share
    <lr-menu-item slot="submenu" value="email">Email</lr-menu-item>
    <lr-menu-item slot="submenu" value="link">Copy link</lr-menu-item>
  </lr-menu-item>
  <lr-menu-item value="delete" variant="danger">Delete</lr-menu-item>
`;

/** Opens the menu at the centre of its region once it has rendered -- only in the story canvas,
 *  never on the autodocs page, where an open menu would swallow the page's own interactions. */
function openAtRegionCentre(context: StoryContext) {
  return ref((element) => {
    if (!element || context.viewMode === 'docs') return;
    const menu = element as LyraContextMenu;
    void menu.updateComplete.then(() => {
      requestAnimationFrame(() => {
        const region = menu.querySelector('[slot="trigger"]');
        if (!region || menu.open) return;
        const rect = region.getBoundingClientRect();
        menu.showAt({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          contextElement: region,
        });
      });
    });
  });
}

/** Forced open in the canvas so the visual harness lands on the actual menu surface. */
export const Open: StoryObj = {
  render: (_args, context) => html`
    <div style="min-block-size: var(--lr-size-28rem);">
      <lr-context-menu label="File actions" ${openAtRegionCentre(context)}>
        <div slot="trigger" tabindex="0" style=${regionStyle}>Right-click or press and hold here</div>
        ${rows()}
      </lr-context-menu>
    </div>
  `,
};

export const Default: StoryObj = {
  render: () => html`
    <lr-context-menu label="File actions">
      <div slot="trigger" tabindex="0" style=${regionStyle}>Right-click, press and hold, or focus and press Shift+F10</div>
      ${rows()}
    </lr-context-menu>
  `,
};

/** Rows are filled synchronously in `lr-show` from the gesture's composed path. */
export const PerTargetItems: StoryObj = {
  name: 'Per-target items',
  render: () => {
    const onShow = (event: CustomEvent<LyraContextMenuShowDetail>): void => {
      const menu = event.currentTarget as LyraContextMenu;
      const row = event.detail.path.find((element) => element.matches('[data-name]'));
      if (!row) {
        event.preventDefault();
        return;
      }
      const name = row.getAttribute('data-name') ?? '';
      for (const item of [...menu.querySelectorAll('lr-menu-item')]) item.remove();
      for (const action of ['Open', 'Rename', 'Delete']) {
        const item = document.createElement('lr-menu-item');
        item.setAttribute('value', action.toLowerCase());
        if (action === 'Delete') item.setAttribute('variant', 'danger');
        item.textContent = `${action} ${name}`;
        menu.append(item);
      }
    };
    return html`
      <lr-context-menu label="File actions" @lr-show=${onShow}>
        <ul slot="trigger" style="display: grid; gap: var(--lr-space-xs); padding: 0; list-style: none;">
          <li data-name="report.pdf"><button type="button">report.pdf</button></li>
          <li data-name="budget.xlsx"><button type="button">budget.xlsx</button></li>
          <li data-name="notes.md"><button type="button">notes.md</button></li>
        </ul>
        <lr-menu-item value="open">Open</lr-menu-item>
      </lr-context-menu>
    `;
  },
};

/** Editable targets keep the platform menu (paste, spelling) by vetoing `lr-show`. */
export const NativeFallbackForInputs: StoryObj = {
  name: 'Native fallback for inputs',
  render: () => {
    const onShow = (event: CustomEvent<LyraContextMenuShowDetail>): void => {
      const target = event.detail.target;
      if (target?.matches('input, textarea')) event.preventDefault();
    };
    return html`
      <lr-context-menu label="Card actions" @lr-show=${onShow}>
        <div slot="trigger" style=${regionStyle}>
          <label>Title <input value="Right-click me for the native menu" /></label>
        </div>
        ${rows()}
      </lr-context-menu>
    `;
  },
};

export const NestedRegions: StoryObj = {
  name: 'Nested regions',
  render: () => html`
    <lr-context-menu label="Board actions">
      <div slot="trigger" tabindex="0" style="${regionStyle} block-size: var(--lr-size-16rem);">
        Board
        <lr-context-menu label="Card actions">
          <div slot="trigger" tabindex="0" style="padding: var(--lr-space-l); border: var(--lr-size-0-0625rem) solid var(--lr-color-border); border-radius: var(--lr-radius);">
            Card (the innermost region wins)
          </div>
          <lr-menu-item value="edit-card">Edit card</lr-menu-item>
          <lr-menu-item value="archive-card">Archive card</lr-menu-item>
        </lr-context-menu>
      </div>
      <lr-menu-item value="new-card">New card</lr-menu-item>
      <lr-menu-item value="rename-board">Rename board</lr-menu-item>
    </lr-context-menu>
  `,
};

export const Rtl: StoryObj = {
  name: 'RTL',
  render: () => html`
    <div dir="rtl" lang="ar">
      <lr-context-menu label="إجراءات الملف">
        <div slot="trigger" tabindex="0" style=${regionStyle}>انقر بزر الفأرة الأيمن هنا</div>
        <lr-menu-item value="copy">نسخ<span slot="details">Ctrl+C</span></lr-menu-item>
        <lr-menu-item value="share">
          مشاركة
          <lr-menu-item slot="submenu" value="email">بريد إلكتروني</lr-menu-item>
        </lr-menu-item>
        <lr-menu-item value="delete" variant="danger">حذف</lr-menu-item>
      </lr-context-menu>
    </div>
  `,
};

export const Disabled: StoryObj = {
  render: () => html`
    <lr-context-menu label="File actions" disabled>
      <div slot="trigger" tabindex="0" style=${regionStyle}>Disabled: the platform menu appears</div>
      ${rows()}
    </lr-context-menu>
  `,
};

/** Scrolling the container moves the anchor, which closes the menu. */
export const InAScrollContainer: StoryObj = {
  name: 'In a scroll container',
  render: () => html`
    <div style="block-size: var(--lr-size-16rem); overflow: auto; border: var(--lr-size-0-0625rem) solid var(--lr-color-border);">
      <lr-context-menu label="File actions">
        <div slot="trigger" tabindex="0" style=${regionStyle}>Open the menu, then scroll</div>
        ${rows()}
      </lr-context-menu>
      <div style="block-size: var(--lr-size-48rem);"></div>
    </div>
  `,
};

/** A canvas owns its own `contextmenu` handling, so it opens the menu through `showAt()`. */
export const MapOrCanvas: StoryObj = {
  name: 'Map / canvas',
  render: () => {
    const onCanvasContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
      const canvas = event.currentTarget as HTMLCanvasElement;
      const menu = canvas.nextElementSibling as LyraContextMenu;
      menu.showAt(
        { x: event.clientX, y: event.clientY, contextElement: canvas },
        { returnFocusTo: canvas },
      );
    };
    return html`
      <canvas
        tabindex="0"
        aria-label="Drawing surface"
        style="inline-size: var(--lr-size-24rem); block-size: var(--lr-size-12rem); border: var(--lr-size-0-0625rem) solid var(--lr-color-border);"
        @contextmenu=${onCanvasContextMenu}
      ></canvas>
      <lr-context-menu label="Canvas actions">
        <lr-menu-item value="add-point">Add point here</lr-menu-item>
        <lr-menu-item value="clear" variant="danger">Clear</lr-menu-item>
      </lr-context-menu>
    `;
  },
};
