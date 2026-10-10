import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { applyLyraStyleScope } from './theme.js';
import { LYRA_SHAPE_PRESETS } from './options/shape.js';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import { confirm } from '../components/overlays/dialog/confirm.js';
import type { LyraDialog } from '../components/overlays/dialog/dialog.class.js';
import '../components/data/table/table.js';
import '../components/data/data-grid/data-grid.js';
import type { LyraTable } from '../components/data/table/table.class.js';
import type { LyraDataGrid } from '../components/data/data-grid/data-grid.class.js';
import { toast } from '../components/overlays/toast/toaster.js';
import { getLyraChartPaletteTokens } from './options/charts.js';
import { resolveLyraChartPalette } from './chart-palette.js';
import { contrastRatio, toRgba } from '../../test/color-contrast.js';

const paths = ['theme.css', 'looks/shadcn.css', 'looks/material.css', 'density.css', 'styles/native.css'];
let sources: string[];
let sheets: CSSStyleSheet[];
let previous: CSSStyleSheet[];

before(async () => {
  sources = await Promise.all(paths.map(async path => {
    const response = await fetch(new URL(`../${path}`, import.meta.url));
    if (!response.ok) throw new Error(`Missing foundation stylesheet: ${path}`);
    return response.text();
  }));
  sheets = sources.map(source => { const sheet = new CSSStyleSheet(); sheet.replaceSync(source); return sheet; });
});
beforeEach(() => { previous = document.adoptedStyleSheets; document.adoptedStyleSheets = [...previous, ...sheets]; });
afterEach(() => { document.adoptedStyleSheets = previous; });

it('applies distinct heading, body and code typography to native content and restores authored inputs', async () => {
  const scope = await fixture<HTMLElement>(html`<section data-lr-theme-scope class="lr-native" style="--lr-theme-font-family-body: serif">
    <h2>العربية · मराठी · English</h2><p>Body text</p><code>const value = 1;</code>
  </section>`);
  const heading = scope.querySelector('h2')!;
  const body = scope.querySelector('p')!;
  const code = scope.querySelector('code')!;
  const initial = getComputedStyle(heading).fontFamily;
  try {
    applyLyraStyleScope(scope, { overrides: {
      '--lr-theme-font-family-heading': '"Foundation Heading", serif',
      '--lr-theme-font-family-body': '"Foundation Body", sans-serif',
      '--lr-theme-font-family-mono': '"Foundation Code", monospace',
    } });
    expect(getComputedStyle(heading).fontFamily).to.include('Foundation Heading');
    expect(getComputedStyle(body).fontFamily).to.include('Foundation Body');
    expect(getComputedStyle(code).fontFamily).to.include('Foundation Code');
    heading.style.fontFamily = 'monospace';
    expect(getComputedStyle(heading).fontFamily).to.equal('monospace');
    heading.style.removeProperty('font-family');
  } finally { applyLyraStyleScope(scope, null); }
  expect(getComputedStyle(heading).fontFamily).to.equal(initial);
});

it('uses the button shape input on native buttons while retaining local styling and focus targets', async () => {
  const scope = await fixture<HTMLElement>(html`<section class="lr-native"><button>Action</button><button style="border-radius: 5px">Local</button></section>`);
  const buttons = [...scope.querySelectorAll('button')];
  const first = buttons[0]!;
  const initial = getComputedStyle(first).borderTopLeftRadius;
  try {
    applyLyraStyleScope(scope, { mode: 'light', density: 'compact', overrides: LYRA_SHAPE_PRESETS.rounded });
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(Number.parseFloat(getComputedStyle(first).borderTopLeftRadius)).to.equal(1.5 * rem);
    expect(getComputedStyle(buttons[1]!).borderTopLeftRadius).to.equal('5px');
    expect(first.getBoundingClientRect().height).to.be.at.least(24);
    expect(first.getBoundingClientRect().width).to.be.at.least(24);
    await focusByKeyboard(first);
    expect(first.matches(':focus-visible')).to.equal(true);
    expect(Number.parseFloat(getComputedStyle(first).outlineWidth)).to.be.greaterThan(0);
    applyLyraStyleScope(scope, { overrides: LYRA_SHAPE_PRESETS.square });
    expect(getComputedStyle(first).borderTopLeftRadius).to.equal('0px');
  } finally { applyLyraStyleScope(scope, null); }
  expect(getComputedStyle(first).borderTopLeftRadius).to.equal(initial);
});

it('inherits a look through nested application roots and keeps a top-layer island local', async () => {
  const scope = await fixture<HTMLElement>(html`<section><div></div></section>`);
  const first = scope.querySelector('div')!.attachShadow({ mode: 'open' });
  first.adoptedStyleSheets = sheets;
  const nestedHost = document.createElement('div');
  first.append(nestedHost);
  const nested = nestedHost.attachShadow({ mode: 'open' });
  nested.adoptedStyleSheets = sheets;
  const island = document.createElement('section');
  island.className = 'lr-native';
  const inherited = document.createElement('button');
  inherited.textContent = 'Inherited';
  const own = document.createElement('section');
  own.className = 'lr-native';
  own.popover = 'manual';
  const button = document.createElement('button');
  button.textContent = 'Local';
  own.append(button);
  island.append(inherited, own);
  nested.append(island);
  try {
    applyLyraStyleScope(scope, { look: 'shadcn', mode: 'dark' });
    const inheritedColor = getComputedStyle(inherited).backgroundColor;
    expect(inheritedColor).to.equal('rgb(10, 10, 10)');
    applyLyraStyleScope(own, { look: 'material', mode: 'light' });
    const ownColor = getComputedStyle(button).backgroundColor;
    expect(ownColor).not.to.equal(inheritedColor);
    own.showPopover();
    expect(own.matches(':popover-open')).to.equal(true);
    expect(getComputedStyle(button).backgroundColor).to.equal(ownColor);
    applyLyraStyleScope(scope, { mode: 'light' });
    expect(getComputedStyle(inherited).backgroundColor).to.equal('rgb(255, 255, 255)');
    expect(getComputedStyle(button).backgroundColor).to.equal(ownColor);
  } finally {
    own.hidePopover();
    applyLyraStyleScope(own, null);
    applyLyraStyleScope(scope, null);
  }
});

it('resolves iframe density and typography against its own document during text zoom', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Scoped controls"></iframe>`);
  const owner = frame.contentDocument!;
  const view = owner.defaultView!;
  owner.adoptedStyleSheets = sources.map(source => {
    const sheet = new view.CSSStyleSheet(); sheet.replaceSync(source); return sheet;
  });
  const scope = owner.createElement('section');
  scope.className = 'lr-native';
  scope.dir = 'rtl';
  scope.style.inlineSize = '320px';
  const heading = owner.createElement('h2');
  heading.textContent = 'العربية · मराठी · English';
  const button = owner.createElement('button');
  button.textContent = 'متابعة Continue';
  scope.append(heading, button);
  owner.body.append(scope);
  try {
    applyLyraStyleScope(scope, { look: 'material', density: 'touch', mode: 'dark', overrides: {
      '--lr-theme-font-family-heading': '"Foundation Heading", serif',
    } });
    owner.documentElement.style.fontSize = '20px';
    const before = button.getBoundingClientRect().height;
    expect(before).to.be.at.least(44);
    const headingSize = Number.parseFloat(view.getComputedStyle(heading).fontSize);
    owner.documentElement.style.fontSize = '40px';
    expect(Number.parseFloat(view.getComputedStyle(heading).fontSize)).to.equal(headingSize * 2);
    expect(view.getComputedStyle(heading).fontFamily).to.include('Foundation Heading');
    expect(button.getBoundingClientRect().height).to.be.greaterThan(before);
    expect(scope.scrollWidth).to.be.at.most(scope.clientWidth);
    expect(view.getComputedStyle(button).direction).to.equal('rtl');
  } finally { applyLyraStyleScope(scope, null); }
});

it('gives body-mounted confirmation actions the body scope shape and touch targets', async () => {
  const body = document.body;
  let dialog: LyraDialog | null = null;
  let result: Promise<boolean> | undefined;
  try {
    applyLyraStyleScope(body, { look: 'material', mode: 'dark', density: 'touch', overrides: LYRA_SHAPE_PRESETS.rounded });
    result = confirm({ title: 'Continue?', confirmLabel: 'Continue', cancelLabel: 'Cancel' });
    dialog = body.querySelector<LyraDialog>('lr-dialog')!;
    await dialog.updateComplete;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button[slot="footer"]')];
    expect(buttons.length).to.equal(2);
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    for (const button of buttons) {
      expect(Number.parseFloat(getComputedStyle(button).borderTopLeftRadius)).to.equal(1.5 * rem);
      expect(button.getBoundingClientRect().height).to.be.at.least(Math.max(44, 2.75 * rem));
    }
    expect(toRgba(getComputedStyle(dialog.shadowRoot!.querySelector('[part~="panel"]')!).backgroundColor)).to.deep.equal(toRgba('color-mix(in srgb, color-mix(in srgb, rgb(53 42 36) 20%, color-mix(in srgb, rgb(24 18 15) 10%, black)) 60%, transparent)'));
    buttons[0]!.click();
    expect(await result).to.equal(false);
  } finally {
    dialog?.remove();
    if (result) await result;
    applyLyraStyleScope(body, null);
  }
});

it('keeps virtual grid offsets and table rows aligned with scoped CSS math after rem changes', async () => {
  const columns = [{ field: 'name', key: 'name', label: 'Name', cell: (row: { name: string }) => row.name }];
  const data = Array.from({ length: 100 }, (_, id) => ({ id, name: `Row ${id}` }));
  const scope = await fixture<HTMLElement>(html`<section data-lr-theme-scope style="--lr-theme-font-size-m: 20px">
    <lr-table aria-label="Rows" style="--lr-table-row-height: calc(2rem + 1em)" .columns=${columns} .rows=${data.slice(0, 2)}></lr-table>
    <lr-data-grid label="Rows" style="block-size: 240px; --row-height: calc(2rem + 1em)" .columns=${columns} .data=${data}></lr-data-grid>
  </section>`);
  const table = scope.querySelector<LyraTable>('lr-table')!;
  const grid = scope.querySelector<LyraDataGrid>('lr-data-grid')!;
  await Promise.all([table.updateComplete, grid.updateComplete]);
  const root = document.documentElement;
  const previousSize = root.style.getPropertyValue('font-size');
  const previousPriority = root.style.getPropertyPriority('font-size');
  try {
    for (const rem of [20, 30]) {
      root.style.setProperty('font-size', `${rem}px`);
      grid.scrollToIndex(40, { align: 'start' });
      await grid.updateComplete;
      const expected = 2 * rem + Number.parseFloat(getComputedStyle(grid).fontSize);
      await waitUntil(() => {
        const row = grid.shadowRoot!.querySelector<HTMLElement>('[part~="row"]');
        return !!row && Math.abs(Number.parseFloat(getComputedStyle(row).minBlockSize) - expected) < 0.1;
      }, 'Grid rows must measure the painted CSS-math length');
      const row = table.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
      expect(row.getBoundingClientRect().height).to.be.closeTo(2 * rem + Number.parseFloat(getComputedStyle(table).fontSize), 1);
      const visibleNames = [...grid.shadowRoot!.querySelectorAll('[part~="row"]')].map(element => element.textContent);
      expect(visibleNames.some(text => text?.includes('Row 40'))).to.equal(true);
    }
  } finally {
    if (previousSize) root.style.setProperty('font-size', previousSize, previousPriority);
    else root.style.removeProperty('font-size');
  }
});

it('keeps helper toasts in their body theme while that owning scope switches modes', async () => {
  let region: Element | null = null;
  try {
    applyLyraStyleScope(document.body, { look: 'shadcn', mode: 'dark' });
    const handle = toast({ message: 'Saved', duration: 0 });
    const item = await handle.item;
    await item.updateComplete;
    region = item.closest('lr-toast');
    expect(region?.parentElement === document.body).to.equal(true);
    const surface = item.shadowRoot!.querySelector<HTMLElement>('[part="toast-item"]')!;
    const before = getComputedStyle(surface).backgroundColor;
    expect(before).not.to.equal('rgba(0, 0, 0, 0)');
    applyLyraStyleScope(document.body, { mode: 'light' });
    const after = getComputedStyle(surface).backgroundColor;
    expect(after).not.to.equal(before);
    expect(contrastRatio(getComputedStyle(surface).color, after)).to.be.at.least(4.5);
    handle.dismiss();
  } finally {
    region?.remove();
    applyLyraStyleScope(document.body, null);
  }
});

it('keeps categorical chart marks distinguishable from each built-in page surface', async () => {
  const scope = await fixture<HTMLElement>(html`<section style="background-color: var(--lr-theme-color-surface-default)"></section>`);
  try {
    for (const look of ['lyra', 'shadcn', 'material'] as const) {
      for (const mode of ['light', 'dark'] as const) {
        applyLyraStyleScope(scope, { look, mode, overrides: getLyraChartPaletteTokens(look) });
        const palette = resolveLyraChartPalette(scope, { mode, palette: look });
        const background = getComputedStyle(scope).backgroundColor;
        for (const color of palette.categorical) {
          expect(contrastRatio(color, background), `${look}/${mode}/${color}`).to.be.at.least(3);
        }
      }
    }
  } finally { applyLyraStyleScope(scope, null); }
});
