import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import { toRgba } from '../../test/color-contrast.js';
import '../components/overlays/dialog/dialog.js';
import '../components/overlays/drawer/drawer.js';
import '../components/overlays/overlay/popover.js';
import '../components/overlays/overlay/dropdown.js';
import '../components/forms/select/select.js';
import '../components/forms/combobox/combobox.js';
import '../components/forms/combobox/option.js';
import '../components/forms/locale-picker/locale-picker.js';
import '../components/forms/color-picker/color-picker.js';
import '../components/forms/date-picker/date-input.js';
import '../components/forms/input/time-input.js';
import '../components/utility/mention-popover/mention-popover.js';
import '../components/layout/menu/menu.js';
import '../components/layout/menu/menu-item.js';
import '../components/layout/navigation-menu/navigation-menu.js';
import '../components/layout/navigation-menu-item/navigation-menu-item.js';
import '../components/conversation/model-select/model-select.js';
import '../components/conversation/voice-picker/voice-picker.js';
import '../components/utility/export-button/export-button.js';
import type { LyraDialog } from '../components/overlays/dialog/dialog.class.js';
import type { LyraDropdown } from '../components/overlays/overlay/dropdown.class.js';

type SurfaceFixture = { name: string; template: TemplateResult; selector: string; part: string };
const surfaces: SurfaceFixture[] = [
  { name: 'dialog', template: html`<lr-dialog label="Details" open>Details</lr-dialog>`, selector: 'lr-dialog', part: '[part~="panel"]' },
  { name: 'drawer', template: html`<lr-drawer label="Details" open>Details</lr-drawer>`, selector: 'lr-drawer', part: '[part~="panel"]' },
  { name: 'popover', template: html`<lr-popover><button slot="trigger">Open</button>Details</lr-popover>`, selector: 'lr-popover', part: '[part~="popup"]' },
  { name: 'dropdown', template: html`<lr-dropdown><button slot="trigger">Open</button><lr-menu><lr-menu-item>Details</lr-menu-item></lr-menu></lr-dropdown>`, selector: 'lr-dropdown', part: '[part~="popup"]' },
  { name: 'select', template: html`<lr-select label="Fruit"><lr-option value="apple">Apple</lr-option></lr-select>`, selector: 'lr-select', part: '[part="listbox"]' },
  { name: 'combobox', template: html`<lr-combobox label="Fruit"><lr-option value="apple">Apple</lr-option></lr-combobox>`, selector: 'lr-combobox', part: '[part="listbox"]' },
  { name: 'locale picker', template: html`<lr-locale-picker label="Language" without-flags></lr-locale-picker>`, selector: 'lr-locale-picker', part: '[part="listbox"]' },
  { name: 'color picker', template: html`<lr-color-picker label="Color"></lr-color-picker>`, selector: 'lr-color-picker', part: '[part="panel"]' },
  { name: 'date input', template: html`<lr-date-input label="Date"></lr-date-input>`, selector: 'lr-date-input', part: '[part="popup"]' },
  { name: 'time input', template: html`<lr-time-input label="Time"></lr-time-input>`, selector: 'lr-time-input', part: '[part="popup"]' },
  { name: 'mentions', template: html`<input aria-label="Message" id="mention-anchor" /><lr-mention-popover></lr-mention-popover>`, selector: 'lr-mention-popover', part: '[part="listbox"]' },
  { name: 'models', template: html`<lr-model-select label="Model"></lr-model-select>`, selector: 'lr-model-select', part: '[part="listbox"]' },
  { name: 'voices', template: html`<lr-voice-picker label="Voice"></lr-voice-picker>`, selector: 'lr-voice-picker', part: '[part="listbox"]' },
  { name: 'export menu', template: html`<lr-export-button .formats=${['csv', 'json']}></lr-export-button>`, selector: 'lr-export-button', part: '[part="menu"]' },
  { name: 'menu', template: html`<lr-menu label="Actions"><lr-menu-item>Details</lr-menu-item></lr-menu>`, selector: 'lr-menu', part: ':host' },
  { name: 'navigation panel', template: html`<lr-navigation-menu top-layer><lr-navigation-menu-item>Details<div slot="panel">Details</div></lr-navigation-menu-item></lr-navigation-menu>`, selector: 'lr-navigation-menu-item', part: '[part="panel"]' },
];

describe('shared glass menu and modal surfaces', () => {
  let previousSheets: CSSStyleSheet[];
  let materialSheet: CSSStyleSheet;
  let preferenceSheet: CSSStyleSheet;

  before(async () => {
    for (const [path, receive] of [
      ['../surfaces/glass.css', (sheet: CSSStyleSheet) => { materialSheet = sheet; }],
      ['../preferences.css', (sheet: CSSStyleSheet) => { preferenceSheet = sheet; }],
    ] as const) {
      const response = await fetch(new URL(path, import.meta.url));
      if (!response.ok) throw new Error(`Missing fixture ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      receive(sheet);
    }
  });
  beforeEach(() => {
    previousSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...previousSheets, materialSheet, preferenceSheet];
  });
  afterEach(() => { document.adoptedStyleSheets = previousSheets; });

  for (const mode of ['light', 'dark']) {
    for (const treatment of ['solid', 'glass']) {
      for (const surface of surfaces) {
        it(`${surface.name} uses ${treatment} in ${mode} mode`, async () => {
          const wrapper = await fixture<HTMLDivElement>(html`<div data-lr-theme=${mode} data-lr-surface=${treatment} style="--lr-transition-fast:0ms;--lr-duration-base:0ms;--show-duration:0ms;--hide-duration:0ms">${surface.template}</div>`);
          const host = wrapper.querySelector<HTMLElement & {
            updateComplete: Promise<unknown>; show?: () => void | Promise<void>; open: boolean; anchor?: HTMLElement;
          }>(surface.selector)!;
          await host.updateComplete;
          if (surface.name === 'navigation panel') {
            host.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
          } else if (surface.name === 'mentions') {
            host.anchor = wrapper.querySelector<HTMLInputElement>('#mention-anchor')!;
            host.open = true;
          } else if (surface.name !== 'menu') {
            if (surface.name === 'models' || surface.name === 'voices') host.open = true;
            else if (host.show) await host.show();
            else host.open = true;
          }
          await host.updateComplete;
          const box = surface.part === ':host' ? host : host.shadowRoot!.querySelector<HTMLElement>(surface.part)!;
          await waitUntil(() => {
            const bounds = box.getBoundingClientRect();
            const style = getComputedStyle(box);
            return !box.hidden && style.visibility === 'visible' && Number(style.opacity) > 0
              && bounds.width > 0 && bounds.height > 0;
          }, `${surface.name} must be open and visibly rendered`);
          if (surface.name === 'navigation panel') {
            expect(box.dataset['layout']).to.equal('floating');
            expect(box.matches(':popover-open')).to.equal(true);
          }
          const alpha = toRgba(getComputedStyle(box).backgroundColor)[3];
          expect(alpha, `${surface.name} material alpha`).to.equal(treatment === 'solid' ? 255 : 204);
          const layer = box.querySelector<HTMLElement>(':scope > .glass-scroll-layer') ?? box;
          const filter = getComputedStyle(layer, '::before').backdropFilter;
          if (treatment === 'glass') expect(filter, surface.name).to.include('blur(');
          else expect(filter, surface.name).to.equal('none');
        });
      }
    }
  }

  it('keeps an inline color editor opaque inside a Glass scope', async () => {
    const host = await fixture<HTMLElement>(html`<lr-color-picker inline data-lr-surface="glass" label="Color"></lr-color-picker>`);
    const panel = host.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;
    expect(toRgba(getComputedStyle(panel).backgroundColor)[3]).to.equal(255);
    expect(getComputedStyle(panel, '::before').backdropFilter).to.equal('none');
  });

  it('lets independently promoted overlays escape an ancestor Glass material', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div class="lr-surface-chrome" data-lr-surface="glass">
      <lr-dialog label="Details" style="--lr-dialog-height:200px;--lr-dialog-width:300px;--lr-duration-base:0ms">
        <lr-dropdown top-layer style="--show-duration:0ms;--hide-duration:0ms"><button slot="trigger">Actions</button><lr-menu><lr-menu-item>Share</lr-menu-item></lr-menu></lr-dropdown>
      </lr-dialog></div>`);
    const dialog = wrapper.querySelector<LyraDialog>('lr-dialog')!;
    await dialog.show();
    const panel = dialog.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    expect(toRgba(getComputedStyle(panel).backgroundColor)[3]).to.equal(204);
    const dropdown = dialog.querySelector<LyraDropdown>('lr-dropdown')!;
    await dropdown.show();
    const popup = dropdown.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    expect(popup.matches(':popover-open')).to.equal(true);
    expect(toRgba(getComputedStyle(popup).backgroundColor)[3]).to.equal(204);
    const menu = dropdown.querySelector<HTMLElement>('lr-menu')!;
    expect(toRgba(getComputedStyle(menu).backgroundColor)[3]).to.equal(0);
    await dropdown.hide();
    await dialog.hide();
  });

  it('qualifies Glass inside a native modal carrier independently of its ancestor', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div class="lr-surface-chrome" data-lr-surface="glass"><dialog>Existing modal</dialog><lr-dialog label="Nested details" style="--lr-duration-base:0ms">Nested details</lr-dialog></div>`);
    const native = wrapper.querySelector<HTMLDialogElement>('dialog')!;
    native.showModal();
    const dialog = wrapper.querySelector<LyraDialog>('lr-dialog')!;
    await dialog.show();
    const carrier = dialog.shadowRoot!.querySelector<HTMLDialogElement>('dialog[data-native-modal-carrier]')!;
    expect(carrier.matches(':modal')).to.equal(true);
    expect(dialog.hasAttribute('data-native-modal-active')).to.equal(true);
    const panel = dialog.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    expect(panel.getBoundingClientRect().height).to.be.greaterThan(0);
    expect(toRgba(getComputedStyle(panel).backgroundColor)[3]).to.equal(204);
    await dialog.hide();
    expect(dialog.hasAttribute('data-native-modal-active')).to.equal(false);
    native.close();
  });

  it('keeps the dialog decorative layer stationary when its public panel scrolls', async () => {
    const host = await fixture<LyraDialog>(html`<lr-dialog label="Details" data-lr-surface="glass" open style="--lr-dialog-height:140px;--lr-dialog-width:200px;--lr-duration-base:0ms"><p>Details</p></lr-dialog>`);
    const panel = host.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    const layer = panel.querySelector<HTMLElement>('.glass-scroll-layer')!;
    const content = document.createElement('div');
    content.style.height = '600px';
    content.style.width = '400px';
    content.style.flex = '0 0 auto';
    panel.append(content);
    await waitUntil(() => parseFloat(getComputedStyle(layer, '::before').height) === panel.clientHeight);
    const initial = layer.getBoundingClientRect();
    panel.scrollTop = 120;
    panel.scrollLeft = 50;
    await waitUntil(() => layer.style.getPropertyValue('--_lr-glass-scroll-offset') === `${panel.scrollLeft}px`);
    expect(panel.scrollTop).to.be.greaterThan(0);
    expect(layer.getBoundingClientRect().top).to.equal(initial.top);
    expect(layer.getBoundingClientRect().left).to.equal(initial.left);
    expect(getComputedStyle(layer, '::before').backdropFilter).to.include('blur(');
  });
});
