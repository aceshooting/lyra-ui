import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraStylePanel } from './style-panel.class.js';
import '../../lr-style-panel.js';
import {
  LYRA_LOOKS,
  applyLyraStyleScope,
  getLyraStyle,
  resetLyraStyle,
  setLyraStyle,
  type LyraStyleChangeDetail,
} from '../../../theme/theme.js';
import type { LyraSegmented } from '../../layout/segmented/segmented.class.js';
import type { LyraSelect } from '../../forms/select/select.class.js';
import type { LyraSlider } from '../../forms/slider/slider.class.js';
import type { LyraSwatchPicker } from '../../forms/swatch-picker/swatch-picker.class.js';

let previousRecord: string | null;
let previousSheets: CSSStyleSheet[];
let sheets: CSSStyleSheet[];

before(async () => {
  sheets = await Promise.all(['theme.css', 'density.css', 'accents.css', 'surfaces/glass.css'].map(async (path) => {
    const response = await fetch(new URL(`../../../${path}`, import.meta.url));
    if (!response.ok) throw new Error(`Missing style fixture: ${path}`);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(await response.text());
    return sheet;
  }));
});

beforeEach(() => {
  previousRecord = localStorage.getItem('lyra-theme');
  previousSheets = document.adoptedStyleSheets;
  document.adoptedStyleSheets = [...previousSheets, ...sheets];
  resetLyraStyle();
  setLyraStyle({ mode: 'light' });
});

afterEach(() => {
  setLyraStyle({
    mode: 'unset', look: null, surface: null, density: null, accent: null, overrides: null,
    accentBackground: null, surfaceOpacity: null,
  });
  applyLyraStyleScope(document.documentElement, null);
  document.adoptedStyleSheets = previousSheets;
  if (previousRecord === null) localStorage.removeItem('lyra-theme');
  else localStorage.setItem('lyra-theme', previousRecord);
});

const part = <T extends Element>(el: LyraStylePanel, name: string): T =>
  el.shadowRoot!.querySelector<T>(`[part~="${name}"]`)!;

async function settled(el: LyraStylePanel): Promise<void> {
  await el.updateComplete;
  for (const child of el.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete?: Promise<unknown> }>('*')) {
    await child.updateComplete;
  }
}

/** Clicks a segmented item by its value, as a user would. */
async function pickSegment(control: LyraSegmented, value: string): Promise<void> {
  await control.updateComplete;
  const index = control.items.findIndex((item) => item.value === value);
  control.shadowRoot!.querySelector<HTMLElement>(`[part="segment"][data-index="${index}"]`)!.click();
}

describe('<lr-style-panel>', () => {
  it('renders every axis with localized English labels and the current style, and is accessible', async () => {
    setLyraStyle({ look: 'lyra', surface: 'glass', density: 'compact', accent: 'ruby', surfaceOpacity: 0.4 });
    const el = await fixture<LyraStylePanel>(html`<lr-style-panel></lr-style-panel>`);
    await settled(el);
    const base = part<HTMLElement>(el, 'base');
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('Appearance');
    const mode = part<LyraSegmented>(el, 'mode');
    expect(mode.label).to.equal('Color mode');
    expect(mode.items.map((item) => item.label)).to.deep.equal(['Light', 'Dark', 'System']);
    expect(mode.value).to.equal('light');
    const look = part<LyraSelect>(el, 'look');
    expect(look.label).to.equal('Look');
    expect(look.value).to.equal('lyra');
    expect([...look.querySelectorAll('lr-option')].map((option) => option.textContent?.trim()))
      .to.deep.equal(['shadcn', 'Lyra', 'Material', 'Data', 'Terminal', 'High contrast']);
    expect(part<LyraSegmented>(el, 'surface').value).to.equal('glass');
    const opacity = part<LyraSlider>(el, 'surface-opacity');
    expect(opacity.label).to.equal('Glass opacity');
    expect(opacity.valueAsNumber).to.equal(0.4);
    expect(opacity.shadowRoot!.textContent).to.include('40%');
    expect(opacity.disabled).to.equal(false);
    expect(part<LyraSegmented>(el, 'density').value).to.equal('compact');
    const accent = part<LyraSwatchPicker>(el, 'accent-picker');
    expect(accent.value).to.equal('ruby');
    expect(accent.items.map((item) => item.label)).to.deep.equal([
      'Emerald', 'Peridot', 'Topaz', 'Ruby', 'Tourmaline', 'Amethyst', 'Aquamarine', 'Sapphire', 'Hematite',
    ]);
    expect(part<HTMLElement>(el, 'accent-label').textContent?.trim()).to.equal('Accent color');
    expect(part<HTMLElement>(el, 'reset').textContent?.trim()).to.equal('Reset to defaults');
    await expect(el).to.be.accessible();
  });

  it('writes each axis through setLyraStyle and reports it once as its own lr-change', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><lr-style-panel></lr-style-panel></div>`);
    const el = wrapper.querySelector('lr-style-panel') as LyraStylePanel;
    await settled(el);
    const outer: string[] = [];
    wrapper.addEventListener('lr-change', (event) => outer.push((event.target as Element).localName));
    let requestLeaks = 0;
    wrapper.addEventListener('lr-change-request', () => requestLeaks++);

    let change = oneEvent(el, 'lr-change');
    await pickSegment(part<LyraSegmented>(el, 'mode'), 'dark');
    let detail = ((await change) as CustomEvent<LyraStyleChangeDetail>).detail;
    expect(detail.changed).to.include('mode');
    expect(getLyraStyle().mode).to.equal('dark');

    change = oneEvent(el, 'lr-change');
    await pickSegment(part<LyraSegmented>(el, 'surface'), 'solid');
    await change;
    expect(getLyraStyle().surface).to.equal('solid');
    await settled(el);
    expect(part<LyraSlider>(el, 'surface-opacity').disabled).to.equal(true);

    change = oneEvent(el, 'lr-change');
    await pickSegment(part<LyraSegmented>(el, 'density'), 'touch');
    await change;
    expect(getLyraStyle().density).to.equal('touch');

    const accent = part<LyraSwatchPicker>(el, 'accent-picker');
    change = oneEvent(el, 'lr-change');
    accent.shadowRoot!.querySelectorAll<HTMLElement>('[part~="swatch"]')[7]!.click();
    detail = ((await change) as CustomEvent<LyraStyleChangeDetail>).detail;
    expect(detail.style.accentName).to.equal('sapphire');
    expect(getLyraStyle().accentName).to.equal('sapphire');
    expect(requestLeaks, 'child value requests stay inside the panel').to.equal(0);

    const look = part<LyraSelect>(el, 'look');
    look.value = 'lyra';
    change = oneEvent(el, 'lr-change');
    look.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true, detail: {} }));
    await change;
    expect(getLyraStyle().look).to.equal('lyra');

    setLyraStyle({ surface: 'glass' });
    await settled(el);
    const opacity = part<LyraSlider>(el, 'surface-opacity');
    opacity.valueAsNumber = 0.85;
    change = oneEvent(el, 'lr-change');
    opacity.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true, detail: {} }));
    await change;
    expect(getLyraStyle().surfaceOpacity).to.equal(0.85);

    // An empty look value and a write that changes nothing emit no panel lr-change.
    look.value = '';
    look.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true, detail: {} }));
    opacity.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true, detail: {} }));
    expect(outer).to.deep.equal(['lr-style-panel', 'lr-style-panel', 'lr-style-panel', 'lr-style-panel', 'lr-style-panel', 'lr-style-panel']);
  });

  it('moves the glass opacity slider in percent steps and writes the 0-1 value', async () => {
    const el = await fixture<LyraStylePanel>(html`<lr-style-panel axes="surface-opacity"></lr-style-panel>`);
    await settled(el);
    const slider = part<LyraSlider>(el, 'surface-opacity');
    const thumb = slider.shadowRoot!.querySelector<HTMLElement>('[part~="thumb"]')!;
    expect(thumb.getAttribute('aria-valuenow')).to.equal('0.6');
    expect(thumb.getAttribute('aria-valuetext')).to.equal('60%');
    for (const [key, expected, text] of [['ArrowRight', 0.61, '61%'], ['End', 1, '100%'], ['Home', 0, '0%']] as const) {
      const change = oneEvent(el, 'lr-change');
      thumb.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      thumb.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      const { detail } = (await change) as CustomEvent<LyraStyleChangeDetail>;
      expect(detail.changed, key).to.deep.equal(['surfaceOpacity']);
      expect(detail.style.surfaceOpacity, key).to.equal(expected);
      expect(getLyraStyle().surfaceOpacity, key).to.equal(expected);
      expect(getComputedStyle(document.documentElement).getPropertyValue('--lr-theme-surface-opacity').trim(), key).to.equal(String(expected));
      await settled(el);
      expect(thumb.getAttribute('aria-valuetext'), key).to.equal(text);
    }
  });

  it('follows style changes made elsewhere and resets only the axes it shows', async () => {
    setLyraStyle({ density: 'compact', accent: 'ruby', look: 'lyra' });
    const el = await fixture<LyraStylePanel>(html`<lr-style-panel axes="density bogus accent density"></lr-style-panel>`);
    await settled(el);
    expect(el.shadowRoot!.querySelectorAll('[part~="mode"], [part~="look"], [part~="surface"]').length).to.equal(0);
    expect([...part<HTMLElement>(el, 'base').children].map((child) => child.getAttribute('part')))
      .to.deep.equal(['density', 'accent', 'reset']);
    setLyraStyle({ density: 'touch' });
    await waitUntil(() => part<LyraSegmented>(el, 'density').value === 'touch', 'the panel follows outside writes');
    const change = oneEvent(el, 'lr-change');
    part<HTMLElement>(el, 'reset').click();
    const { changed } = ((await change) as CustomEvent<LyraStyleChangeDetail>).detail;
    expect([...changed].sort()).to.deep.equal(['accent', 'density']);
    expect(Object.isFrozen(changed), 'the changed list is a frozen snapshot').to.equal(true);
    expect(getLyraStyle().density).to.equal('comfortable');
    expect(getLyraStyle().accentName).to.equal('emerald');
    expect(getLyraStyle().look).to.equal('lyra');
    el.axes = null as unknown as string;
    el.withoutReset = true;
    setLyraStyle({ mode: 'unset' });
    await settled(el);
    expect(el.shadowRoot!.querySelectorAll('[part~="mode"], [part~="look"], [part~="surface-opacity"]').length).to.equal(3);
    expect(part(el, 'reset')).to.equal(null);
    expect(part<LyraSegmented>(el, 'mode').value).to.equal('');
    el.remove();
    setLyraStyle({ density: 'compact' });
    expect(part<LyraSegmented>(el, 'density').value).to.equal('comfortable');
  });

  it('localizes through .strings, keeps application looks, honours label and disabled, and works under RTL', async () => {
    const custom = [...LYRA_LOOKS.slice(0, 1), { id: 'brand', name: 'Brand', optional: true, stylesheet: null }];
    const wrapper = await fixture<HTMLElement>(html`<div dir="rtl"><lr-style-panel
      .strings=${{ stylePanelMode: 'Mode de couleur', styleLookShadcn: 'Classique', stylePanelReset: 'Réinitialiser' }}
      .looks=${custom}
      label="Préférences"
      disabled
    ></lr-style-panel></div>`);
    const el = wrapper.querySelector('lr-style-panel') as LyraStylePanel;
    await settled(el);
    expect(part<LyraSegmented>(el, 'mode').label).to.equal('Mode de couleur');
    expect([...part<LyraSelect>(el, 'look').querySelectorAll('lr-option')].map((option) => option.textContent?.trim()))
      .to.deep.equal(['Classique', 'Brand']);
    expect(part<HTMLElement>(el, 'reset').textContent?.trim()).to.equal('Réinitialiser');
    expect(part<HTMLElement>(el, 'base').getAttribute('aria-label')).to.equal('Préférences');
    for (const name of ['mode', 'look', 'surface', 'surface-opacity', 'density', 'accent-picker', 'reset']) {
      expect((part<HTMLElement & { disabled: boolean }>(el, name)).disabled, name).to.equal(true);
    }
    el.looks = null as unknown as typeof custom;
    await settled(el);
    expect(part<LyraSelect>(el, 'look').querySelectorAll('lr-option').length).to.equal(LYRA_LOOKS.length);
    // Disabled controls are exempt from the text-contrast minimum.
    await expect(el).to.be.accessible({ ignoredRules: ['color-contrast'] });
  });
  it('fits a 320px allocation with long localized labels, in LTR and RTL', async () => {
    const strings = {
      stylePanelMode: 'Farbmodus der Benutzeroberfläche',
      stylePanelModeLight: 'Heller Darstellungsmodus', stylePanelModeDark: 'Dunkler Darstellungsmodus',
      stylePanelModeSystem: 'Systemeinstellung übernehmen',
      stylePanelDensity: 'Informationsdichte',
      stylePanelDensityCompact: 'Kompaktdarstellung', stylePanelDensityComfortable: 'Komfortabler Abstand',
      stylePanelDensityTouch: 'Berührungsoptimiert',
      stylePanelReset: 'Alle Darstellungseinstellungen zurücksetzen',
    };
    for (const dir of ['ltr', 'rtl'] as const) {
      const wrapper = await fixture<HTMLElement>(html`<div dir=${dir} style="inline-size: 320px"><lr-style-panel
        .strings=${strings}></lr-style-panel></div>`);
      const el = wrapper.querySelector('lr-style-panel') as LyraStylePanel;
      await settled(el);
      const box = wrapper.getBoundingClientRect();
      expect(el.scrollWidth, `${dir}: no panel overflow`).to.be.at.most(el.clientWidth);
      for (const name of ['mode', 'look', 'surface', 'density', 'accent-picker', 'reset']) {
        const rect = part<HTMLElement>(el, name).getBoundingClientRect();
        expect(rect.left >= box.left - 1 && rect.right <= box.right + 1, `${dir}: ${name} inside 320px`).to.equal(true);
      }
    }
  });
});
