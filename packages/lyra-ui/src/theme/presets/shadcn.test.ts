import { expect, fixture, html } from '@open-wc/testing';
import { LitElement } from 'lit';
import '../../components/forms/button/button.js';
import '../../components/forms/input/input.js';
import '../../components/layout/card/card.js';
import type { LyraButton } from '../../components/forms/button/button.class.js';
import type { LyraCard } from '../../components/layout/card/card.class.js';
import type { LyraInput } from '../../components/forms/input/input.class.js';
import { tag } from '../../internal/prefix.js';
import { palette } from '../../internal/tokens/palette.styles.js';
import { tokens as tokenStyles } from '../../internal/tokens.styles.js';
import { applyLyraThemePreset } from '../presets.js';
import { getLyraTheme, setLyraTheme, type LyraThemeMode } from '../theme.js';
import { LYRA_SHADCN_THEME_PRESET } from './shadcn.js';

/**
 * The generated runtime preset against its source stylesheet. Rendering is compared for real --
 * both routes adopt the shipped theme.css, and one also adopts themes/shadcn.css -- because the
 * whole point of the generated module is that it is the same look through a different carrier.
 */

class PresetThemeProbe extends LitElement {
  static override styles = [palette, tokenStyles];
}

const probeTag = tag('preset-theme-probe');
if (!customElements.get(probeTag)) customElements.define(probeTag, PresetThemeProbe);

const MODES = ['light', 'dark'] as const satisfies readonly LyraThemeMode[];
const OWNERSHIP_KEY = Symbol.for('@aceshooting/lyra-ui.theme-tokens.v1');

const textCache = new Map<string, Promise<string>>();
function loadText(path: string): Promise<string> {
  let pending = textCache.get(path);
  if (!pending) {
    pending = fetch(new URL(path, import.meta.url)).then((response) => response.text());
    textCache.set(path, pending);
  }
  return pending;
}

async function loadSheet(path: string): Promise<CSSStyleSheet> {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(await loadText(path));
  return sheet;
}

/** Each mode block's declarations, read from the source stylesheet (comments removed). */
async function stylesheetTokens(): Promise<Record<'light' | 'dark', Map<string, string>>> {
  const source = (await loadText('../../themes/shadcn.css')).replace(/\/\*[\s\S]*?\*\//g, '');
  const darkStart = source.search(/\.lr-dark\s*,/);
  expect(darkStart).to.be.greaterThan(0);
  const read = (block: string) => {
    const map = new Map<string, string>();
    for (const match of block.matchAll(/(--lr-theme-[a-z0-9-]+)\s*:\s*([^;]+);/g)) map.set(match[1]!, match[2]!.trim());
    return map;
  };
  return { light: read(source.slice(0, darkStart)), dark: read(source.slice(darkStart)) };
}

function ownershipList(): string[] {
  const list = (document.documentElement as unknown as Record<symbol, unknown>)[OWNERSHIP_KEY];
  return Array.isArray(list) ? list.map(String) : [];
}

let originalSheets: CSSStyleSheet[] = [];

describe('LYRA_SHADCN_THEME_PRESET', () => {
  beforeEach(() => {
    originalSheets = document.adoptedStyleSheets;
  });

  afterEach(() => {
    document.adoptedStyleSheets = originalSheets;
    setLyraTheme({ mode: 'unset', accent: null, surface: null, tokens: null });
    localStorage.removeItem('lyra-theme');
    document.documentElement.removeAttribute('data-lr-theme-preset');
  });

  it('carries exactly the stylesheet keys, only as tokens, and applies every value unrepaired in both modes', async () => {
    expect(LYRA_SHADCN_THEME_PRESET.id).to.equal('shadcn');
    expect(Object.isFrozen(LYRA_SHADCN_THEME_PRESET)).to.equal(true);
    expect(Object.isFrozen(LYRA_SHADCN_THEME_PRESET.theme)).to.equal(true);
    expect(Object.keys(LYRA_SHADCN_THEME_PRESET.theme)).to.deep.equal(['tokens']);

    const css = await stylesheetTokens();
    const presetTokens = LYRA_SHADCN_THEME_PRESET.theme.tokens ?? {};
    expect(Object.keys(presetTokens)).to.deep.equal([...css.light.keys()]);
    expect([...css.dark.keys()].sort()).to.deep.equal([...css.light.keys()].sort());

    for (const mode of MODES) {
      document.documentElement.removeAttribute('data-lr-theme-preset');
      setLyraTheme({ mode, accent: null, surface: null, tokens: null });
      applyLyraThemePreset(LYRA_SHADCN_THEME_PRESET);
      expect(document.documentElement.dataset['lrThemePreset'], mode).to.equal('shadcn');
      expect(getLyraTheme().tokens).to.deep.equal(presetTokens);
      // Nothing synthesized: the ownership list is exactly the map.
      expect(ownershipList()).to.deep.equal(Object.keys(presetTokens));
      // Compared through the engine's own serialization of the authored value: WebKit rewrites a
      // quoted font family with double quotes, which is not a repair.
      const scratch = document.createElement('div');
      const mismatches: string[] = [];
      for (const [name, authored] of css[mode]) {
        scratch.style.setProperty(name, authored);
        const expected = scratch.style.getPropertyValue(name);
        const painted = document.documentElement.style.getPropertyValue(name);
        if (painted !== expected) mismatches.push(`${mode} ${name}: painted ${painted}, authored ${authored}`);
      }
      expect(mismatches.join('\n')).to.equal('');
    }
  });

  it('renders identically to the stylesheet preset in light and dark', async () => {
    const [base, preset] = await Promise.all([loadSheet('../../theme.css'), loadSheet('../../themes/shadcn.css')]);
    const names = Object.keys(LYRA_SHADCN_THEME_PRESET.theme.tokens ?? {});
    const layerTwo = names.map((name) => name.replace('--lr-theme-', '--lr-'));

    const render = async (mode: 'light' | 'dark') => {
      const rootStyle = getComputedStyle(document.documentElement);
      const wrapper = await fixture(html`<div></div>`);
      const probe = document.createElement(probeTag) as PresetThemeProbe;
      wrapper.append(probe);
      await probe.updateComplete;
      const probeStyle = getComputedStyle(probe);
      const button = await fixture<LyraButton>(html`<lr-button>Save</lr-button>`);
      const input = await fixture<LyraInput>(html`<lr-input label="Name"></lr-input>`);
      const card = await fixture<LyraCard>(html`<lr-card>Card</lr-card>`);
      await Promise.all([button.updateComplete, input.updateComplete, card.updateComplete]);
      return {
        mode,
        inputs: Object.fromEntries(names.map((name) => [name, rootStyle.getPropertyValue(name).trim()])),
        layerTwo: Object.fromEntries(layerTwo.map((name) => [name, probeStyle.getPropertyValue(name).trim()])),
        button: getComputedStyle(button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!).backgroundColor,
        input: getComputedStyle(input.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!).borderTopColor,
        card: getComputedStyle(card.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!).borderTopColor,
      };
    };

    for (const mode of MODES) {
      document.adoptedStyleSheets = [...originalSheets, base, preset];
      setLyraTheme({ mode, accent: null, surface: null, tokens: null });
      const viaStylesheet = await render(mode);

      document.adoptedStyleSheets = [...originalSheets, base];
      setLyraTheme({ mode, accent: null, surface: null, tokens: null });
      applyLyraThemePreset(LYRA_SHADCN_THEME_PRESET);
      const viaRuntime = await render(mode);

      expect(viaRuntime).to.deep.equal(viaStylesheet);
      if (mode === 'light') expect(viaRuntime.button).to.equal('rgb(23, 23, 23)');
      // Perturbation guard: the look is really applied, not both routes falling back to theme.css.
      expect(viaRuntime.inputs['--lr-theme-color-surface-border-subtle']).to.not.equal('');
    }
  });

  it('keeps lr-button, lr-input and lr-card accessible under the runtime preset', async () => {
    document.adoptedStyleSheets = [...originalSheets, await loadSheet('../../theme.css')];
    for (const mode of MODES) {
      setLyraTheme({ mode, accent: null, surface: null, tokens: null });
      applyLyraThemePreset(LYRA_SHADCN_THEME_PRESET);
      // The test page itself has no themed background, so give the controls the page surface the
      // look defines; otherwise a dark-mode label is measured against the runner's white body.
      const page = await fixture<HTMLElement>(html`
        <div style="background: var(--lr-theme-color-surface-default); color: var(--lr-theme-color-text-normal); padding: 1rem">
          <lr-button>Save</lr-button>
          <lr-input label="Name"></lr-input>
          <lr-card>Card</lr-card>
        </div>
      `);
      const button = page.querySelector<LyraButton>('lr-button')!;
      const input = page.querySelector<LyraInput>('lr-input')!;
      const card = page.querySelector<LyraCard>('lr-card')!;
      await Promise.all([button.updateComplete, input.updateComplete, card.updateComplete]);
      await expect(button).to.be.accessible();
      await expect(input).to.be.accessible();
      await expect(card).to.be.accessible();
    }
  });
});
