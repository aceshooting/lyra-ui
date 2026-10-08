import { expect } from '@open-wc/testing';
import '../all.js';
import { ROOT_BARREL_TAGS } from './root-registration-allowlist.js';
import { DOCUMENT_TOKEN_SENTINEL } from './document-tokens.generated.js';
import { setColorScheme, setForcedColors, setReducedMotion } from '../../test/wtr-media.js';
import { expectDevWarning } from '../../test/expected-dev-warnings.js';
import { nextFrame } from '../../test/frames.js';

// The permanent half of RFC 0002's parity evidence, over every registered component. Under the
// document token layer a component host resolves no shared output itself: it inherits what its
// nearest theme scope resolved. So in every page mode, for every component, the host's resolved
// tokens must equal its scope's -- which is exactly why scoped theming renders as it did when every
// host re-derived the layer. The release-gate harness (docs/rfcs/0002-evidence, parity-e.mjs and
// parity-modes.mjs) separately compares rendered pixels and styles against the 26.0.0 package.

expectDevWarning('lyra-data-grid-missing-accessible-name');
expectDevWarning('lyra-tree-missing-accessible-name');

/** Layer outputs no component sheet restates (the glass re-derivation names are excluded). */
const SAMPLE = [
  '--lr-color-surface',
  '--lr-color-surface-raised',
  '--lr-color-text',
  '--lr-color-border-subtle',
  '--lr-color-brand',
  '--lr-color-brand-fill-loud',
  '--lr-color-on-brand',
  '--lr-color-overlay',
  '--lr-space-m',
  '--lr-radius',
  '--lr-shadow-m',
  '--lr-font',
  '--lr-transition-fast',
  '--lr-transition-interactive',
  '--lr-duration-fast',
] as const;

const squash = (value: string) => value.trim().replace(/\s+/g, ' ');
const tokensOf = (element: Element) => {
  const style = getComputedStyle(element);
  return SAMPLE.map((name) => `${name}=${squash(style.getPropertyValue(name))}`);
};

function prepare(tag: string, element: Element): void {
  if (tag === 'lr-table') element.setAttribute('aria-label', 'Records');
  if (tag === 'lr-emoji-picker') (element as unknown as { loadGroups: () => Promise<null> }).loadGroups = () => Promise.resolve(null);
  if (tag === 'lr-locale-picker') (element as unknown as { withoutFlags: boolean }).withoutFlags = true;
}

/** Mounts every registered component inside `scope` and returns them once they have rendered. */
async function mountAll(scope: HTMLElement, hostAttributes: Record<string, string> = {}): Promise<HTMLElement[]> {
  const elements = ROOT_BARREL_TAGS.map((tag) => {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(hostAttributes)) element.setAttribute(name, value);
    prepare(tag, element);
    scope.append(element);
    return element;
  });
  await Promise.all(elements.map((element) => (element as { updateComplete?: Promise<unknown> }).updateComplete?.catch(() => undefined)));
  await nextFrame();
  return elements;
}

function mismatches(elements: readonly HTMLElement[], expected: (element: HTMLElement) => string[]): string[] {
  return elements.flatMap((element) => {
    const want = expected(element);
    const got = tokensOf(element);
    return got.flatMap((entry, index) => (entry === want[index] ? [] : [`<${element.localName}> ${entry} (scope ${want[index]})`]));
  });
}

async function withScope<T>(markup: string, run: (scope: HTMLElement) => Promise<T>): Promise<T> {
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  document.body.append(holder);
  try {
    return await run(holder.querySelector<HTMLElement>('[data-scope]')!);
  } finally {
    holder.remove();
  }
}

describe('document token layer parity over every registered component', () => {
  it('inherits the root layer on every host in a plain region', async () => {
    await withScope('<div data-scope></div>', async (scope) => {
      const elements = await mountAll(scope);
      expect(getComputedStyle(document.documentElement).getPropertyValue(DOCUMENT_TOKEN_SENTINEL).trim()).to.not.equal('');
      expect(mismatches(elements, () => tokensOf(document.documentElement)).join('\n')).to.equal('');
    });
  });

  it('inherits a dark mode scope on every host', async () => {
    await withScope('<section class="lr-dark" data-scope></section>', async (scope) => {
      const elements = await mountAll(scope);
      expect(getComputedStyle(scope).getPropertyValue('--lr-color-surface').trim()).to.equal('#0a0a0a');
      expect(mismatches(elements, () => tokensOf(scope)).join('\n')).to.equal('');
    });
  });

  it('inherits a marked scope that retunes inputs, inside a dark region, on every host', async () => {
    const markup = '<section data-lr-theme="dark"><div data-lr-theme-scope data-scope ' +
      'style="--lr-theme-color-brand-fill-loud: #8b008b; --lr-theme-space-m: 1.25rem"></div></section>';
    await withScope(markup, async (scope) => {
      const elements = await mountAll(scope);
      expect(getComputedStyle(scope).getPropertyValue('--lr-color-brand').trim()).to.equal('#8b008b');
      expect(getComputedStyle(scope).getPropertyValue('--lr-color-surface').trim()).to.equal('#0a0a0a');
      expect(mismatches(elements, () => tokensOf(scope)).join('\n')).to.equal('');
    });
  });

  it('re-derives on a host that is its own mode scope exactly as a plain element would', async () => {
    await withScope('<div data-scope></div><div id="reference" data-lr-theme="dark"></div>', async (scope) => {
      const reference = scope.parentElement!.querySelector('#reference')!;
      const elements = await mountAll(scope, { 'data-lr-theme': 'dark' });
      expect(mismatches(elements, () => tokensOf(reference)).join('\n')).to.equal('');
    });
  });

  it('follows the operating-system dark preference on every host', async () => {
    await withScope('<div data-scope></div>', async (scope) => {
      const elements = await mountAll(scope);
      await setColorScheme('dark');
      try {
        expect(getComputedStyle(document.documentElement).getPropertyValue('--lr-color-surface').trim()).to.equal('#0a0a0a');
        expect(mismatches(elements, () => tokensOf(document.documentElement)).join('\n')).to.equal('');
      } finally {
        await setColorScheme('no-preference');
      }
    });
  });

  it('flattens motion on every host under reduced motion', async () => {
    await withScope('<div data-scope></div>', async (scope) => {
      const elements = await mountAll(scope);
      await setReducedMotion('reduce');
      try {
        const slow = elements.filter((element) => squash(getComputedStyle(element).getPropertyValue('--lr-duration-fast')) !== '0.001ms');
        expect(slow.map((element) => element.localName).join(' ')).to.equal('');
      } finally {
        await setReducedMotion('no-preference');
      }
    });
  });

  it('substitutes system colours on every host under forced colours', async function () {
    await withScope('<div data-lr-theme="dark" data-scope></div>', async (scope) => {
      const elements = await mountAll(scope);
      try {
        await setForcedColors('active');
      } catch {
        this.skip();
      }
      try {
        if (!matchMedia('(forced-colors: active)').matches) this.skip();
        const wrong = elements.filter((element) => {
          const style = getComputedStyle(element);
          return style.getPropertyValue('--lr-color-surface').trim() !== 'Canvas' ||
            style.getPropertyValue('--lr-color-text').trim() !== 'CanvasText' ||
            style.getPropertyValue('--lr-focus-ring-color').trim() !== 'Highlight';
        });
        expect(wrong.map((element) => element.localName).join(' ')).to.equal('');
      } finally {
        await setForcedColors('none');
      }
    });
  });

  it('never adopts the layer into a library component\'s own shadow root', async () => {
    await withScope('<div data-lr-theme-scope data-scope></div>', async (scope) => {
      const elements = await mountAll(scope);
      const adopted = elements.filter((element) => element.shadowRoot?.adoptedStyleSheets.some((sheet) =>
        Array.from(sheet.cssRules).some((rule) => rule.cssText.includes(DOCUMENT_TOKEN_SENTINEL))));
      expect(adopted.map((element) => element.localName).join(' ')).to.equal('');
    });
  });
});
