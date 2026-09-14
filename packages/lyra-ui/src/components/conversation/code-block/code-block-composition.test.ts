import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './code-block.js';
import './code-block-core.js';
import type { LyraCodeBlock } from './code-block.class.js';

const ANCESTOR_TOKENS =
  '--lr-icon-button-background: rgb(1, 2, 3); --lr-icon-button-radius: 11px;';

function copyButton(el: Element): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part~="copy-button"]')!;
}

function nativeControl(el: Element): HTMLButtonElement {
  return copyButton(el).shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

for (const tag of ['lr-code-block', 'lr-code-block-core'] as const) {
  describe(`${tag}: composed copy lr-icon-button`, () => {
    const fixtureFor = (attributes = ''): string =>
      `<${tag} filename="demo.ts" code="const a = 1;" ${attributes}></${tag}>`;

    const mount = async (attributes = ''): Promise<Element> => {
      const wrapper = await fixture(html`<div>${unsafeTemplate(fixtureFor(attributes))}</div>`);
      const el = wrapper.querySelector(tag)!;
      await (el as Element & { updateComplete: Promise<unknown> }).updateComplete;
      return el;
    };

    // `fixture` needs a real template; build one from a string without unsafe-HTML machinery.
    function unsafeTemplate(markup: string): DocumentFragment {
      const template = document.createElement('template');
      template.innerHTML = markup;
      return template.content.cloneNode(true) as DocumentFragment;
    }

    it('composes a real lr-icon-button as the copy control', async () => {
      const el = await mount();
      expect(copyButton(el).localName).to.equal('lr-icon-button');
      expect(copyButton(el).getAttribute('exportparts')).to.contain(
        'button:copy-button__control'
      );
    });

    it('takes its paint from the shared --lr-icon-button-* contract on an ancestor', async () => {
      const wrapper = await fixture(
        html`<div style=${ANCESTOR_TOKENS}>${unsafeTemplate(fixtureFor())}</div>`
      );
      const el = wrapper.querySelector(tag)!;
      await (el as Element & { updateComplete: Promise<unknown> }).updateComplete;
      const style = getComputedStyle(nativeControl(el));
      expect(style.backgroundColor).to.equal('rgb(1, 2, 3)');
      expect(style.borderTopLeftRadius).to.equal('11px');
    });

    it('keeps the text copy label by default', async () => {
      const el = await mount();
      expect((el as unknown as LyraCodeBlock).copyAppearance).to.equal('text');
      expect(copyButton(el).textContent?.trim()).to.equal('Copy');
    });

    it('renders a glyph and no visible text under copy-appearance="icon"', async () => {
      const el = await mount('copy-appearance="icon"');
      expect(copyButton(el).textContent?.trim()).to.equal('');
      expect(copyButton(el).querySelectorAll('svg').length).to.equal(1);
      expect(
        copyButton(el).getAttribute('aria-label'),
        'the localized name survives the icon appearance'
      ).to.equal('Copy code');
    });

    it('copies on Enter from the actually focused control', async () => {
      const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      const writes: string[] = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text: string) => {
            writes.push(text);
            return Promise.resolve();
          },
        },
      });
      try {
        const el = await mount();
        copyButton(el).focus();
        await (el as Element & { updateComplete: Promise<unknown> }).updateComplete;
        expect(
          copyButton(el).shadowRoot!.activeElement === nativeControl(el),
          'focus landed on the composed native control'
        ).to.equal(true);
        await sendKeys({ press: 'Enter' });
        expect(writes).to.deep.equal(['const a = 1;']);
      } finally {
        if (original) Object.defineProperty(navigator, 'clipboard', original);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    });

    it('renders a header-actions slot after the copy control', async () => {
      const wrapper = await fixture(
        html`<div>
          ${unsafeTemplate(
            `<${tag} filename="demo.ts" code="const a = 1;"><button slot="header-actions" id="extra">Run</button></${tag}>`
          )}
        </div>`
      );
      const el = wrapper.querySelector(tag)!;
      await (el as Element & { updateComplete: Promise<unknown> }).updateComplete;
      const slot = el.shadowRoot!.querySelector<HTMLSlotElement>(
        '[part="header-actions"] slot[name="header-actions"]'
      )!;
      expect(slot.assignedElements().map((node) => node.id)).to.deep.equal(['extra']);
      const header = el.shadowRoot!.querySelector('[part="header"]')!;
      const order = [...header.children].map((child) => child.getAttribute('part'));
      expect(order.indexOf('header-actions')).to.be.greaterThan(
        order.findIndex((value) => value?.includes('copy-button'))
      );
    });

    it('collapses the empty header-actions wrapper so the copy control keeps the content edge', async () => {
      const el = await mount();
      const header = el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
      const wrapper = el.shadowRoot!.querySelector<HTMLElement>('[part="header-actions"]')!;
      expect(
        wrapper.hasAttribute('hidden'),
        'the wrapper is stamped hidden when nothing is slotted'
      ).to.equal(true);
      expect(
        getComputedStyle(wrapper).display,
        'the [hidden] rule actually collapses it, so it contributes no flex gap'
      ).to.equal('none');
      const headerStyle = getComputedStyle(header);
      const contentEnd =
        header.getBoundingClientRect().right -
        parseFloat(headerStyle.paddingRight) -
        parseFloat(headerStyle.borderRightWidth);
      expect(
        copyButton(el).getBoundingClientRect().right,
        'the copy control still sits on the header content edge, not one gap in from it'
      ).to.be.closeTo(contentEnd, 0.5);
    });

    it('uncollapses the wrapper once something is slotted', async () => {
      const wrapper = await fixture(
        html`<div>
          ${unsafeTemplate(
            `<${tag} filename="demo.ts" code="const a = 1;"><button slot="header-actions" id="extra">Run</button></${tag}>`
          )}
        </div>`
      );
      const el = wrapper.querySelector(tag)!;
      await (el as Element & { updateComplete: Promise<unknown> }).updateComplete;
      const actions = el.shadowRoot!.querySelector<HTMLElement>('[part="header-actions"]')!;
      expect(actions.hasAttribute('hidden')).to.equal(false);
      // The sheet declares inline-flex; blockification of a flex item computes that to `flex`.
      expect(getComputedStyle(actions).display).to.equal('flex');
    });

    it('brings the header into existence for a child appended after first render', async () => {
      const wrapper = await fixture(
        html`<div>${unsafeTemplate(`<${tag} code="const a = 1;" copyable="false"></${tag}>`)}</div>`
      );
      const el = wrapper.querySelector(tag)! as Element & {
        updateComplete: Promise<unknown>;
      };
      await el.updateComplete;
      expect(
        el.shadowRoot!.querySelector('[part="header"]') === null,
        'no filename, language, copy control or collapse toggle means no header at all'
      ).to.equal(true);

      const action = document.createElement('button');
      action.slot = 'header-actions';
      action.id = 'late';
      el.appendChild(action);
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="header"]') !== null,
        'appending a header-actions child renders the header'
      );
      await el.updateComplete;
      const slot = el.shadowRoot!.querySelector<HTMLSlotElement>(
        '[part="header-actions"] slot[name="header-actions"]'
      )!;
      expect(slot.assignedElements().map((node) => node.id)).to.deep.equal(['late']);

      el.removeChild(action);
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="header"]') === null,
        'removing it retires the header again'
      );
    });

    it('is accessible with a header, a copy control and slotted header actions', async () => {
      const wrapper = await fixture(
        html`<div>
          ${unsafeTemplate(
            `<${tag} filename="demo.ts" language="ts" collapsible code="const a = 1;" copy-appearance="icon"><button slot="header-actions">Run</button></${tag}>`
          )}
        </div>`
      );
      const el = wrapper.querySelector(tag)!;
      await (el as Element & { updateComplete: Promise<unknown> }).updateComplete;
      await expect(el).to.be.accessible();
    });
  });
}
