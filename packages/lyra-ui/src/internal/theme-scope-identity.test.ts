import { expect, fixture, html } from '@open-wc/testing';
import { DOCUMENT_TOKEN_CSS, LAYER_CONSUMED_INPUTS } from './document-tokens.generated.js';
import { adoptLyraTokens } from '../utilities/tokens.js';
import { resetLyraStyle, setLyraStyle } from '../theme/theme.js';
import { setColorScheme } from '../../test/wtr-media.js';
import { expectDevWarning } from '../../test/expected-dev-warnings.js';

// RFC 0002 invariant: a redundant scope changes nothing. A bare `data-lr-theme-scope` child must
// compute every layer output and every layer-consumed input exactly as its parent does, whatever
// the parent inherited or set: inline or stylesheet inputs on :root, a runtime custom accent, a
// design-token fixture, a look boundary. Two defects broke this before it was a gate: a follower
// resolved once at :root, and the marker re-resolving every input from the look slots.
expectDevWarning('lyra-style:resolver');

const LAYER_OUTPUTS = [...new Set([...DOCUMENT_TOKEN_CSS.matchAll(/[{;](--lr-[a-z0-9-]+):/g)].map((match) => match[1]!))];
const NAMES = [...LAYER_OUTPUTS, ...LAYER_CONSUMED_INPUTS];

async function sheetOf(path: string): Promise<CSSStyleSheet> {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(await (await fetch(new URL(path, import.meta.url))).text());
  return sheet;
}

function differences(parent: Element, child: Element): string[] {
  const a = getComputedStyle(parent);
  const b = getComputedStyle(child);
  return NAMES.filter((name) => a.getPropertyValue(name).trim() !== b.getPropertyValue(name).trim());
}

interface Situation {
  readonly name: string;
  readonly sheets?: readonly string[];
  readonly setup?: () => void | Promise<void>;
  readonly teardown?: () => void;
  readonly parent: (child: unknown) => ReturnType<typeof html>;
}

const root = document.documentElement;
const SITUATIONS: readonly Situation[] = [
  { name: 'no override', parent: (child) => html`<section class="parent">${child}</section>` },
  {
    name: 'inline inputs on :root',
    setup: () => { root.style.setProperty('--lr-theme-color-brand-fill-loud', '#8b008b'); root.style.setProperty('--lr-theme-space-m', '1.1rem'); },
    teardown: () => { root.style.removeProperty('--lr-theme-color-brand-fill-loud'); root.style.removeProperty('--lr-theme-space-m'); },
    parent: (child) => html`<section class="parent">${child}</section>`,
  },
  {
    name: 'unlayered :root input',
    sheets: ['data:text/css,:root{--lr-theme-color-brand-fill-loud:%237c3aed;--lr-theme-color-surface-default:%23fffbe6}'],
    parent: (child) => html`<section class="parent">${child}</section>`,
  },
  {
    name: ':root input in lr-overrides',
    sheets: ['data:text/css,@layer lr-overrides{:root{--lr-theme-color-brand-fill-loud:%23007a5a}}'],
    parent: (child) => html`<section class="parent">${child}</section>`,
  },
  {
    name: 'runtime custom accent on <html>',
    setup: () => { setLyraStyle({ accent: '#8b008b' }); },
    teardown: () => { resetLyraStyle(); },
    parent: (child) => html`<section class="parent">${child}</section>`,
  },
  { name: 'design-token fixture', sheets: ['../styles/design-tokens.css'], parent: (child) => html`<section class="parent lr-token-dark">${child}</section>` },
  { name: 'look boundary', parent: (child) => html`<section class="parent" data-lr-look="lyra">${child}</section>` },
  { name: 'mode island', parent: (child) => html`<section class="parent lr-dark">${child}</section>` },
];

describe('theme scopes: a redundant marker is value-identical to its parent', () => {
  let theme: CSSStyleSheet;
  let previous: CSSStyleSheet[];
  before(async () => {
    theme = await sheetOf('../theme.css');
    adoptLyraTokens(document);
  });
  beforeEach(() => { previous = document.adoptedStyleSheets; });
  afterEach(async () => {
    document.adoptedStyleSheets = previous;
    await setColorScheme('no-preference');
  });

  for (const withTheme of [true, false]) for (const scheme of ['light', 'dark'] as const) for (const situation of SITUATIONS) {
    it(`${withTheme ? 'theme.css' : 'no theme.css'} / OS ${scheme} / ${situation.name}`, async () => {
      const extra = await Promise.all((situation.sheets ?? []).map((path) => sheetOf(path)));
      document.adoptedStyleSheets = [...previous, ...(withTheme ? [theme] : []), ...extra];
      await setColorScheme(scheme);
      await situation.setup?.();
      try {
        const tree = await fixture<HTMLElement>(situation.parent(html`<div data-lr-theme-scope class="child"></div>`));
        const parent = tree.classList.contains('parent') ? tree : tree.querySelector('.parent')!;
        const child = parent.querySelector('.child')!;
        expect(differences(parent, child), 'names that differ between the parent and its bare marker child').to.deep.equal([]);
      } finally {
        situation.teardown?.();
      }
    });
  }
});
