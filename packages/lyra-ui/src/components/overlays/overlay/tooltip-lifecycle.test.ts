import { expect } from '@open-wc/testing';
import { LyraTooltip } from './tooltip.class.js';

it('does not read the tooltip render root before hydration establishes it', () => {
  const tagName = 'test-tooltip-deferred-render-root';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends LyraTooltip {
        override requestUpdate(): void {}
        override createRenderRoot(): HTMLElement | DocumentFragment {
          return undefined as unknown as DocumentFragment;
        }
      },
    );
  }
  const el = document.createElement(tagName) as LyraTooltip;

  expect(() => el.connectedCallback()).not.to.throw();
  expect(el.querySelector('[data-lyra-tooltip-description]')).to.exist;
  el.disconnectedCallback();
});
