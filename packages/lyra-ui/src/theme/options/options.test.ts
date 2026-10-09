import { expect, fixture, html } from '@open-wc/testing';
import { applyLyraStyleScope } from '../theme.js';
import { LYRA_SHAPE_PRESETS } from './shape.js';
import { LYRA_TYPOGRAPHY_PRESETS } from './typography.js';
import { LYRA_ELEVATION_PRESETS } from './elevation.js';
import '../../components/layout/card/card.js';
import '../../components/forms/button/button.js';
import '../../components/forms/textarea/textarea.js';
import '../../components/overlays/dialog/dialog.js';
import '../../translations/ar/overlays.js';
import '../../translations/ar/shared.js';
import type { LyraCard } from '../../components/layout/card/card.js';
import type { LyraButton } from '../../components/forms/button/button.js';
import type { LyraTextarea } from '../../components/forms/textarea/textarea.js';
import type { LyraDialog } from '../../components/overlays/dialog/dialog.js';

describe('optional shape, typography and elevation presets', () => {
  let themeSheet: CSSStyleSheet;
  let previousSheets: CSSStyleSheet[];
  before(async () => {
    const response = await fetch(new URL('../../theme.css', import.meta.url));
    if (!response.ok) throw new Error('Missing theme resolver fixture');
    themeSheet = new CSSStyleSheet();
    themeSheet.replaceSync(await response.text());
  });
  beforeEach(() => {
    previousSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...previousSheets, themeSheet];
  });
  afterEach(() => { document.adoptedStyleSheets = previousSheets; });

  it('keeps presets immutable without freezing the caller’s composition', () => {
    expect(Object.isFrozen(LYRA_SHAPE_PRESETS)).to.equal(true);
    expect(Object.isFrozen(LYRA_TYPOGRAPHY_PRESETS.arabic)).to.equal(true);
    expect(Object.isFrozen(LYRA_ELEVATION_PRESETS.raised['--lr-theme-shadow-m'])).to.equal(true);
    const composed = { ...LYRA_SHAPE_PRESETS.rounded, ...LYRA_ELEVATION_PRESETS.flat };
    expect(Object.isFrozen(composed)).to.equal(false);
  });

  it('keeps mixed-script text inside a narrow allocation with an enlarged type size', async () => {
    const scope = await fixture<HTMLElement>(html`
      <section style="inline-size:320px;max-inline-size:100%">
        <lr-textarea label="Text" value="مَسَاحَةُ عَمَلٍ · नयी कार्यसूची · กำลังทำงาน · 日本語 · 한국어 · English 123"></lr-textarea>
      </section>
    `);
    const textarea = scope.querySelector<LyraTextarea>('lr-textarea')!;
    await textarea.updateComplete;
    const text = textarea.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="textarea"]')!;
    const initial = text.value;
    try {
      for (const preset of ['arabic', 'devanagari', 'thai', 'japanese', 'korean'] as const) {
        applyLyraStyleScope(scope, { mode: 'light', overrides: {
          ...LYRA_TYPOGRAPHY_PRESETS[preset], '--lr-theme-font-size-m': '2rem',
        } });
        expect(text.value).to.equal(initial);
        expect(text.getBoundingClientRect().width).to.be.at.most(scope.getBoundingClientRect().width);
        expect(text.scrollWidth).to.be.at.most(text.clientWidth + 1);
        expect(Number.parseFloat(getComputedStyle(text).lineHeight)).to.be.at.least(Number.parseFloat(getComputedStyle(text).fontSize) * 1.5);
      }
    } finally {
      applyLyraStyleScope(scope, null);
    }
  });

  it('composes shape, script typography and elevation while preserving local hooks and restoring unset rendering', async () => {
    const scope = await fixture<HTMLElement>(html`
      <section data-lr-theme-scope lang="ar" dir="rtl" style="--lr-theme-border-radius-m: 7px">
        <lr-card>العربية · English · १२३</lr-card>
        <lr-card style="--border-radius: 11px">Local radius</lr-card>
        <lr-button>Action</lr-button>
        <lr-button pill>Pill</lr-button>
        <lr-button style="--lr-button-radius: 9px">Local radius</lr-button>
        <lr-textarea label="Text" value="العربية · English · १२३"></lr-textarea>
        <lr-dialog label="Heading">Body</lr-dialog>
      </section>
    `);
    const cards = [...scope.querySelectorAll<LyraCard>('lr-card')];
    const buttons = [...scope.querySelectorAll<LyraButton>('lr-button')];
    const textarea = scope.querySelector<LyraTextarea>('lr-textarea')!;
    const dialog = scope.querySelector<LyraDialog>('lr-dialog')!;
    await Promise.all([...cards, ...buttons, textarea, dialog].map(element => element.updateComplete));
    const card = (index: number) => cards[index]!.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const button = (index: number) => buttons[index]!.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    const panel = dialog.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    const heading = dialog.shadowRoot!.querySelector<HTMLElement>('[part~="heading"]')!;
    const text = textarea.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="textarea"]')!;
    const initial = {
      radius: getComputedStyle(card(0)).borderTopLeftRadius,
      font: getComputedStyle(text).fontFamily,
      lineHeight: getComputedStyle(text).lineHeight,
      shadow: getComputedStyle(panel).boxShadow,
      pill: getComputedStyle(button(1)).borderTopLeftRadius,
    };
    expect(initial.radius).to.equal('7px');
    try {
      applyLyraStyleScope(scope, { mode: 'light', overrides: {
        ...LYRA_SHAPE_PRESETS.rounded,
        ...LYRA_TYPOGRAPHY_PRESETS.arabic,
        ...LYRA_ELEVATION_PRESETS.flat,
      } });
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      expect(Number.parseFloat(getComputedStyle(card(0)).borderTopLeftRadius)).to.equal(rem);
      expect(getComputedStyle(card(1)).borderTopLeftRadius).to.equal('11px');
      expect(Number.parseFloat(getComputedStyle(button(0)).borderTopLeftRadius)).to.equal(1.5 * rem);
      expect(getComputedStyle(button(1)).borderTopLeftRadius).to.equal(initial.pill);
      expect(getComputedStyle(button(2)).borderTopLeftRadius).to.equal('9px');
      expect(getComputedStyle(heading).fontFamily).to.include('Noto Sans Arabic');
      expect(getComputedStyle(text).fontFamily).to.include('Noto Sans Arabic');
      expect(Number.parseFloat(getComputedStyle(text).lineHeight)).to.be.closeTo(Number.parseFloat(getComputedStyle(text).fontSize) * 1.75, 0.1);
      expect(getComputedStyle(panel).boxShadow).to.equal('none');
      expect(scope.lang).to.equal('ar');
      expect(scope.dir).to.equal('rtl');
      expect(text.value).to.equal('العربية · English · १२३');

      applyLyraStyleScope(scope, { mode: 'dark', overrides: {
        ...LYRA_SHAPE_PRESETS.square, ...LYRA_ELEVATION_PRESETS.raised,
      } });
      expect(getComputedStyle(card(0)).borderTopLeftRadius).to.equal('0px');
      expect(getComputedStyle(panel).boxShadow).not.to.equal('none');
      dialog.style.setProperty('--lr-overlay-shadow-modal', 'none');
      expect(getComputedStyle(panel).boxShadow).to.equal('none');
      dialog.style.removeProperty('--lr-overlay-shadow-modal');
    } finally {
      applyLyraStyleScope(scope, null);
    }
    expect(getComputedStyle(card(0)).borderTopLeftRadius).to.equal(initial.radius);
    expect(getComputedStyle(text).fontFamily).to.equal(initial.font);
    expect(getComputedStyle(text).lineHeight).to.equal(initial.lineHeight);
    expect(getComputedStyle(panel).boxShadow).to.equal(initial.shadow);
  });
});
