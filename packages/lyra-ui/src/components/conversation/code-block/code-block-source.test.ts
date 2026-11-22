import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-code-block.js';
import '../../lr-code-block-core.js';
import type { LyraCodeBlock } from '../../lr-code-block.js';
import type { LyraCodeBlockCore } from '../../lr-code-block-core.js';

for (const tagName of ['lr-code-block', 'lr-code-block-core'] as const) {
  describe(`${tagName} light-DOM source, wrap and aliases`, () => {
    const make = async (markup: ReturnType<typeof html>) =>
      (await fixture(markup)) as LyraCodeBlock | LyraCodeBlockCore;
    const text = (el: Element) => el.shadowRoot!.querySelector('code')?.textContent ?? '';

    it('renders dedented light-DOM text and ignores header-actions children', async () => {
      const el = await make(
        tagName === 'lr-code-block'
          ? html`<lr-code-block>
              <button slot="header-actions">x</button>
              if (a) {
                run();
              }
            </lr-code-block>`
          : html`<lr-code-block-core>
              <button slot="header-actions">x</button>
              if (a) {
                run();
              }
            </lr-code-block-core>`,
      );
      await waitUntil(() => text(el) !== '');
      expect(text(el)).to.equal('if (a) {\n  run();\n}');
    });

    it('keeps the text as written with without-dedent, dropping one leading newline', async () => {
      const el = await make(
        tagName === 'lr-code-block'
          ? html`<lr-code-block without-dedent>
  a
    b</lr-code-block>`
          : html`<lr-code-block-core without-dedent>
  a
    b</lr-code-block-core>`,
      );
      await waitUntil(() => text(el) !== '');
      expect(text(el)).to.equal('  a\n    b');
    });

    it('follows later light-DOM edits and lets a non-empty code property win without dedenting', async () => {
      const el = await make(
        tagName === 'lr-code-block'
          ? html`<lr-code-block>one</lr-code-block>`
          : html`<lr-code-block-core>one</lr-code-block-core>`,
      );
      await waitUntil(() => text(el) === 'one');
      el.textContent = 'two';
      await waitUntil(() => text(el) === 'two');
      el.code = '    keep\n  me';
      await el.updateComplete;
      expect(text(el)).to.equal('    keep\n  me');
      el.code = '';
      await waitUntil(() => text(el) === 'two');
    });

    it('wraps long lines only when wrap is set, in plain rendering', async () => {
      const el = await make(
        tagName === 'lr-code-block'
          ? html`<lr-code-block .code=${'x'.repeat(400)}></lr-code-block>`
          : html`<lr-code-block-core .code=${'x'.repeat(400)}></lr-code-block-core>`,
      );
      const pre = () => el.shadowRoot!.querySelector('[part~="pre"]') as HTMLElement;
      await waitUntil(() => pre());
      expect(getComputedStyle(pre()).whiteSpace).to.equal('pre');
      el.wrap = true;
      await el.updateComplete;
      expect(el.hasAttribute('wrap')).to.equal(true);
      expect(getComputedStyle(pre()).whiteSpace).to.equal('pre-wrap');
      expect(pre().scrollWidth).to.be.at.most(el.getBoundingClientRect().width + 1);
    });

    it('maps the without-copy and label aliases onto the existing members', async () => {
      const el = await make(
        tagName === 'lr-code-block'
          ? html`<lr-code-block code="a" without-copy label="Sample"></lr-code-block>`
          : html`<lr-code-block-core code="a" without-copy label="Sample"></lr-code-block-core>`,
      );
      await el.updateComplete;
      expect(el.withoutCopyButton).to.equal(true);
      expect(el.shadowRoot!.querySelector('[part~="copy-button"]') === null).to.equal(true);
      expect(el.shadowRoot!.querySelector('[part="body"]')?.getAttribute('aria-label')).to.equal('Sample');
      el.setAttribute('aria-label', 'Host wins');
      await el.updateComplete;
      await aTimeout(0);
      expect(el.shadowRoot!.querySelector('[part="body"]')?.getAttribute('aria-label')).to.equal('Host wins');
    });
  });
}
