import { fixture, expect, html } from '@open-wc/testing';
import { LitElement } from 'lit';
import { palette } from '../internal/tokens/palette.styles.js';
import { tokens } from '../internal/tokens.styles.js';
import { tag } from '../internal/prefix.js';
import { setLyraTheme, type LyraThemeMode } from './theme.js';

class ProductionThemeProbe extends LitElement {
  static override styles = [palette, tokens];
}

const probeTag = tag('production-theme-probe');
if (!customElements.get(probeTag)) customElements.define(probeTag, ProductionThemeProbe);

let themeSheetPromise: Promise<CSSStyleSheet> | undefined;

function productionThemeSheet(): Promise<CSSStyleSheet> {
  themeSheetPromise ??= fetch(new URL('../theme.css', import.meta.url))
    .then((response) => response.text())
    .then((source) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(source);
      return sheet;
    });
  return themeSheetPromise;
}

async function renderedProbe(): Promise<ProductionThemeProbe> {
  const wrapper = await fixture(html`<div></div>`);
  const probe = document.createElement(probeTag) as ProductionThemeProbe;
  wrapper.append(probe);
  await probe.updateComplete;
  return probe;
}

const SEMANTIC_ROLES = [
  ...['quiet', 'normal', 'loud'].flatMap((emphasis) =>
    ['fill', 'border', 'on'].flatMap((role) => [
      `--lr-color-neutral-${role}-${emphasis}`,
      `--lr-color-brand-${role}-${emphasis}`,
    ])),
] as const;

describe('production theme rendering', () => {
  it('routes every representative neutral/brand emphasis through theme.css in light and dark mode', async () => {
    const sheet = await productionThemeSheet();
    const originalSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...originalSheets, sheet];
    try {
      for (const mode of ['light', 'dark'] satisfies LyraThemeMode[]) {
        setLyraTheme({ mode, accent: null });
        const probe = await renderedProbe();
        const rootStyle = getComputedStyle(document.documentElement);
        const probeStyle = getComputedStyle(probe);
        const failures: string[] = [];

        if (document.documentElement.getAttribute('data-lr-theme') !== mode) {
          failures.push(`${mode}: production API did not set data-lr-theme`);
        }
        for (const token of SEMANTIC_ROLES) {
          const input = token.replace('--lr-color-', '--lr-theme-color-');
          const expected = rootStyle.getPropertyValue(input).trim();
          const actual = probeStyle.getPropertyValue(token).trim();
          if (!expected) failures.push(`${mode}: ${input} resolved empty`);
          if (actual !== expected) failures.push(`${mode}: ${token} = ${actual}; expected ${expected}`);
        }

        const neutralFills = ['quiet', 'normal', 'loud'].map((emphasis) =>
          probeStyle.getPropertyValue(`--lr-color-neutral-fill-${emphasis}`).trim(),
        );
        const brandFills = ['quiet', 'normal', 'loud'].map((emphasis) =>
          probeStyle.getPropertyValue(`--lr-color-brand-fill-${emphasis}`).trim(),
        );
        if (new Set(neutralFills).size !== neutralFills.length) {
          failures.push(`${mode}: neutral emphasis collapsed (${neutralFills.join(' | ')})`);
        }
        if (new Set(brandFills).size !== brandFills.length) {
          failures.push(`${mode}: brand emphasis collapsed (${brandFills.join(' | ')})`);
        }
        expect(failures.join('\n')).to.equal('');
      }
    } finally {
      setLyraTheme({ mode: 'unset', accent: null });
      localStorage.removeItem('lyra-theme');
      document.adoptedStyleSheets = originalSheets;
    }
  });

  it('routes a production-runtime accent through every brand role and the focus token', async () => {
    const sheet = await productionThemeSheet();
    const originalSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...originalSheets, sheet];
    try {
      setLyraTheme({ mode: 'dark', accent: '#e63950' });
      const probe = await renderedProbe();
      const rootStyle = getComputedStyle(document.documentElement);
      const probeStyle = getComputedStyle(probe);
      const failures: string[] = [];

      for (const token of SEMANTIC_ROLES.filter((name) => name.includes('-brand-'))) {
        const input = token.replace('--lr-color-', '--lr-theme-color-');
        const expected = rootStyle.getPropertyValue(input).trim();
        const actual = probeStyle.getPropertyValue(token).trim();
        if (!expected) failures.push(`${input} resolved empty`);
        if (actual !== expected) failures.push(`${token} = ${actual}; expected ${expected}`);
      }
      const expectedFocus = rootStyle.getPropertyValue('--lr-theme-color-focus').trim();
      const actualFocus = probeStyle.getPropertyValue('--lr-focus-ring-color').trim();
      if (actualFocus !== expectedFocus) {
        failures.push(`--lr-focus-ring-color = ${actualFocus}; expected ${expectedFocus}`);
      }
      expect(failures.join('\n')).to.equal('');
    } finally {
      setLyraTheme({ mode: 'unset', accent: null });
      localStorage.removeItem('lyra-theme');
      document.adoptedStyleSheets = originalSheets;
    }
  });
});

// 11.0.0 added `--lr-focus-ring` as a composite outline shorthand, explicitly to replace the Web
// Awesome idiom `outline: var(--wa-focus-ring)`. But that idiom is written by a consumer against
// their OWN element, while the token was declared only inside `baseTokens`' `:host` block -- so it
// existed solely inside Lyra shadow roots. At document scope it resolved to the empty string, which
// makes the whole `outline` declaration invalid at computed-value time; because `outline` does not
// inherit, the property fell back to `outline-style: none` and the focus ring VANISHED, silently.
// That is a WCAG 2.4.7 failure with no console signal and no test signal. The library evidenced the
// gap itself: `styles/native.css` hand-expanded the ring rather than using the composite.
describe('focus-ring tokens at consumer scope', () => {
  const FOCUS_RING_TOKENS = [
    '--lr-focus-ring-width',
    '--lr-focus-ring-color',
    '--lr-focus-ring-offset',
    '--lr-focus-ring',
  ] as const;

  it('resolves every focus-ring token on a plain element outside any Lyra shadow root', async () => {
    const sheet = await productionThemeSheet();
    const originalSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...originalSheets, sheet];
    try {
      const host = (await fixture(html`<a href="#probe">Probe</a>`)) as HTMLElement;
      const style = getComputedStyle(host);
      const empty = FOCUS_RING_TOKENS.filter(
        (token) => style.getPropertyValue(token).trim() === '',
      );

      expect(empty, `unreachable at document scope: ${empty.join(', ')}`).to.deep.equal([]);
      expect(
        style.getPropertyValue('--lr-focus-ring').trim().includes('solid'),
        'the composite must carry the style keyword, which is the whole point of shipping it',
      ).to.be.true;
    } finally {
      document.adoptedStyleSheets = originalSheets;
    }
  });

  it('actually paints an outline when a consumer writes the advertised idiom', async () => {
    const sheet = await productionThemeSheet();
    const originalSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...originalSheets, sheet];
    try {
      const host = (await fixture(
        html`<a href="#probe" style="outline: var(--lr-focus-ring);">Probe</a>`,
      )) as HTMLElement;

      expect(
        getComputedStyle(host).outlineStyle,
        'the ring must not silently degrade to outline-style: none',
      ).to.not.equal('none');
    } finally {
      document.adoptedStyleSheets = originalSheets;
    }
  });

  it('still lets each component re-derive the ring on its own host', async () => {
    const sheet = await productionThemeSheet();
    const originalSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...originalSheets, sheet];
    try {
      setLyraTheme({ mode: 'light', accent: null });
      const probe = await renderedProbe();
      const probeStyle = getComputedStyle(probe);

      for (const token of FOCUS_RING_TOKENS) {
        expect(
          probeStyle.getPropertyValue(token).trim(),
          `${token} must still resolve inside a component`,
        ).to.not.equal('');
      }
    } finally {
      document.adoptedStyleSheets = originalSheets;
    }
  });
});
