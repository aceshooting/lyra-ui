import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import '../../lr-code-block.js';
import '../../lr-code-block-core.js';
import type { LyraCodeBlock } from '../../lr-code-block.js';
import type { LyraCodeBlockCore } from '../../lr-code-block-core.js';

type AnyCodeBlock = LyraCodeBlock | LyraCodeBlockCore;

const states = (el: Element): string[] =>
  ['loading', 'error', 'highlighted'].filter((name) => el.matches(`:state(${name})`));

/** Creates an element with listeners armed before it connects, so no event can be missed. */
function mountWithLog(tagName: string, setup: (el: AnyCodeBlock) => void): { el: AnyCodeBlock; log: string[] } {
  const el = document.createElement(tagName) as AnyCodeBlock;
  const log: string[] = [];
  el.addEventListener('lr-load', (event) =>
    log.push((event as CustomEvent<{ highlighted: boolean }>).detail.highlighted ? 'load' : 'load-plain'));
  el.addEventListener('lr-error', () => log.push('error'));
  setup(el);
  document.body.append(el);
  return { el, log };
}

afterEach(() => {
  for (const el of document.body.querySelectorAll('lr-code-block, lr-code-block-core')) el.remove();
});

describe('lr-code-block highlight states and events', function () {
  this.timeout(20000);
  it('reaches :state(highlighted) and emits lr-load once the grammar has highlighted the code', async () => {
    const { el, log } = mountWithLog('lr-code-block', (node) => {
      node.language = 'json';
      node.code = '{"a": 1}';
    });
    await waitUntil(() => el.matches(':state(highlighted)'), 'highlighted state', { timeout: 10000 });
    expect(states(el)).to.deep.equal(['highlighted']);
    expect(log).to.include('load');
    expect(log).to.not.include('error');
  });

  it('reaches :state(error) and emits lr-load without highlighting, never lr-error, when no grammar exists, then recovers', async () => {
    const { el, log } = mountWithLog('lr-code-block', (node) => {
      node.language = 'not-a-real-language';
      node.code = 'plain';
    });
    await waitUntil(() => el.matches(':state(error)'), 'error state', { timeout: 10000 });
    expect(states(el)).to.deep.equal(['error']);
    expect(log).to.deep.equal(['load-plain']);
    expect(el.shadowRoot!.querySelector('code')!.textContent).to.equal('plain');
    el.language = 'json';
    el.code = '1';
    await waitUntil(() => el.matches(':state(highlighted)'), 'recovered', { timeout: 10000 });
    expect(states(el)).to.deep.equal(['highlighted']);
    expect(log).to.deep.equal(['load-plain', 'load']);
  });

  it('publishes no highlight state while language is unset', async () => {
    const el = await fixture<LyraCodeBlock>(html`<lr-code-block code="x"></lr-code-block>`);
    await aTimeout(0);
    expect(states(el)).to.deep.equal([]);
  });
});

describe('lr-code-block-core highlight states and events', function () {
  this.timeout(20000);
  it('holds :state(loading) while a lazy grammar resolves, then highlights', async () => {
    let release!: (value: unknown) => void;
    const pending = new Promise((resolve) => { release = resolve; });
    const { el, log } = mountWithLog('lr-code-block-core', (node) => {
      (node as LyraCodeBlockCore).languages = { json: () => pending.then(() => jsonGrammar) } as LyraCodeBlockCore['languages'];
      node.language = 'json';
      node.code = '{"a": 1}';
    });
    await el.updateComplete;
    expect(states(el)).to.deep.equal(['loading']);
    release(undefined);
    await waitUntil(() => el.matches(':state(highlighted)'), 'highlighted state', { timeout: 10000 });
    expect(states(el)).to.deep.equal(['highlighted']);
    expect(log).to.deep.equal(['load']);
  });

  it('reports :state(error) for a language absent from languages', async () => {
    const { el, log } = mountWithLog('lr-code-block-core', (node) => {
      (node as LyraCodeBlockCore).languages = { json: jsonGrammar };
      node.language = 'python';
      node.code = 'x = 1';
    });
    await waitUntil(() => el.matches(':state(error)'), 'error state');
    expect(states(el)).to.deep.equal(['error']);
    expect(log).to.deep.equal(['load-plain']);
  });
});

for (const tagName of ['lr-code-block', 'lr-code-block-core'] as const) {
  describe(`${tagName} upstream-named surface`, () => {
    it('reflects without-copy alongside without-copy-button, default false', async () => {
      const el = (await fixture(
        tagName === 'lr-code-block'
          ? html`<lr-code-block code="a"></lr-code-block>`
          : html`<lr-code-block-core code="a"></lr-code-block-core>`,
      )) as AnyCodeBlock;
      expect(el.withoutCopy).to.equal(false);
      expect(el.hasAttribute('without-copy')).to.equal(false);
      el.withoutCopyButton = true;
      await el.updateComplete;
      expect(el.hasAttribute('without-copy')).to.equal(true);
      expect(el.hasAttribute('without-copy-button')).to.equal(true);
      el.removeAttribute('without-copy');
      await el.updateComplete;
      expect(el.withoutCopyButton).to.equal(false);
      expect(el.hasAttribute('without-copy-button')).to.equal(false);
      expect(el.shadowRoot!.querySelectorAll('[part~="copy-button"]')).to.have.lengthOf(1);
    });

    it('forwards the copy control button as copy-button__button and exposes its feedback part', async () => {
      const el = (await fixture(
        tagName === 'lr-code-block'
          ? html`<lr-code-block code="a"></lr-code-block>`
          : html`<lr-code-block-core code="a"></lr-code-block-core>`,
      )) as AnyCodeBlock;
      const copy = el.shadowRoot!.querySelector('[part~="copy-button"]')!;
      const exported = (copy.getAttribute('exportparts') ?? '').split(',').map((entry) => entry.trim());
      expect(exported).to.include.members(['button:copy-button-control', 'button:copy-button__button']);
      expect(el.shadowRoot!.querySelectorAll('[part~="copy-button__feedback"]')).to.have.lengthOf(1);
    });

    for (const ok of [true, false]) {
      it(`swaps the icon-appearance glyph after a copy that ${ok ? 'succeeds' : 'fails'}`, async () => {
        const el = (await fixture(
          tagName === 'lr-code-block'
            ? html`<lr-code-block code="a" copy-appearance="icon"></lr-code-block>`
            : html`<lr-code-block-core code="a" copy-appearance="icon"></lr-code-block-core>`,
        )) as AnyCodeBlock;
        const parts = () =>
          ['copy-button__copy-icon', 'copy-button__success-icon', 'copy-button__error-icon'].filter(
            (part) => el.shadowRoot!.querySelector(`[part~="${part}"]`) !== null,
          );
        expect(parts()).to.deep.equal(['copy-button__copy-icon']);
        const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: async () => { if (!ok) throw new Error(); } },
        });
        try {
          const done = oneEvent(el, ok ? 'lr-copy' : 'lr-copy-error');
          el.shadowRoot!.querySelector<HTMLElement>('[part~="copy-button"]')!.click();
          await done;
          await el.updateComplete;
          expect(parts()).to.deep.equal([ok ? 'copy-button__success-icon' : 'copy-button__error-icon']);
          const feedback = el.shadowRoot!.querySelector('[part~="copy-button__feedback"]')!;
          expect(feedback.getAttribute('aria-hidden')).to.equal('true');
          expect(feedback.textContent!.trim()).to.not.equal('');
        } finally {
          if (previous) Object.defineProperty(navigator, 'clipboard', previous);
          else Reflect.deleteProperty(navigator, 'clipboard');
        }
      });
    }
  });
}

describe('lr-code-block syntax color custom properties', function () {
  this.timeout(20000);
  const tokenSpan = (el: Element, text: string): HTMLElement =>
    Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="pre"] span[data-token]')).find(
      (span) => span.textContent === text,
    )!;

  it('recolors classified tokens from the unprefixed properties and keeps theme colors when unset', async () => {
    const el = await fixture<LyraCodeBlock>(html`
      <lr-code-block
        language="json"
        code='{"key": "value", "n": 42}'
        style="--string-color: rgb(1, 2, 3); --property-color: rgb(4, 5, 6)"
      ></lr-code-block>
    `);
    await waitUntil(() => el.matches(':state(highlighted)'), 'highlighted', { timeout: 10000 });
    const value = tokenSpan(el, '"value"');
    expect(value.dataset['token']).to.equal('string');
    expect(getComputedStyle(value).color).to.equal('rgb(1, 2, 3)');
    const key = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[data-token="property"]'));
    expect(key.length).to.be.greaterThan(0);
    expect(getComputedStyle(key[0]!).color).to.equal('rgb(4, 5, 6)');
    const number = tokenSpan(el, '42');
    expect(number.dataset['token']).to.equal('constant');
    // Unset: the theme's own token color still paints.
    const themed = number.style.color;
    expect(themed).to.not.equal('');
    const probe = document.createElement('span');
    probe.style.color = themed;
    document.body.append(probe);
    try {
      expect(getComputedStyle(number).color).to.equal(getComputedStyle(probe).color);
    } finally {
      probe.remove();
    }
  });

  it('applies the same property to a lr-code-block-core token', async () => {
    const el = await fixture<LyraCodeBlockCore>(html`
      <lr-code-block-core
        language="json"
        code='{"key": true}'
        .languages=${{ json: jsonGrammar }}
        style="--constant-color: rgb(7, 8, 9)"
      ></lr-code-block-core>
    `);
    await waitUntil(() => el.matches(':state(highlighted)'), 'highlighted', { timeout: 10000 });
    const constant = tokenSpan(el, 'true');
    expect(getComputedStyle(constant).color).to.equal('rgb(7, 8, 9)');
  });
});
