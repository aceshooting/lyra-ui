import { expect } from '@open-wc/testing';
import './components/data/pagination/pagination.js';
import './components/data/tree/tree-item.js';
import './components/data/tree/tree.js';
import './components/forms/button/button.js';
import './components/forms/checkbox/checkbox.js';
import './components/forms/color-picker/color-picker.js';
import './components/forms/input/input.js';
import './components/forms/input/number-input.js';
import './components/forms/input/time-input.js';
import './components/forms/switch/switch.js';
import './components/forms/textarea/textarea.js';
import './components/layout/breadcrumb/breadcrumb.js';
import './components/layout/carousel/carousel.js';
import './components/layout/details/accordion-item.js';
import './components/layout/details/details.js';
import './components/layout/tab-group/tab-group.js';
import './components/layout/tab-group/tab.js';
import './components/media/image-comparer/image-comparer.js';
import './components/media/qr-code/qr-code.js';
import './components/overlays/badge/badge.js';
import './components/overlays/overlay/tooltip.js';
import './components/overlays/progress/progress-bar.js';
import './components/overlays/progress/progress-ring.js';
import './components/overlays/rating/rating.js';
import './components/overlays/spinner/spinner.js';
import './components/utility/known-date/known-date.js';

type TestElement = HTMLElement & { updateComplete?: Promise<unknown> };

/**
 * Named outer-wrapper parts from Web Awesome 3.11.0's published custom-elements manifest, limited
 * to tags mapped by Lyra. `wa-page` is the one published wrapper omitted here because it has no
 * mapped Lyra tag yet. Keep the upstream tag in each row so a future pin update is reviewable.
 */
const mappedWrapperParts = [
  ['wa-accordion-item', 'lr-accordion-item', 'accordion-item'],
  ['wa-badge', 'lr-badge', 'badge'],
  ['wa-breadcrumb', 'lr-breadcrumb', 'breadcrumb'],
  ['wa-button', 'lr-button', 'button'],
  ['wa-carousel', 'lr-carousel', 'carousel'],
  ['wa-checkbox', 'lr-checkbox', 'checkbox'],
  ['wa-color-picker', 'lr-color-picker', 'color-picker'],
  ['wa-comparison', 'lr-image-comparer', 'comparison'],
  ['wa-details', 'lr-details', 'details'],
  ['wa-known-date', 'lr-known-date', 'known-date'],
  ['wa-number-input', 'lr-number-input', 'number-input'],
  ['wa-pagination', 'lr-pagination', 'pagination'],
  ['wa-progress-bar', 'lr-progress-bar', 'progress-bar'],
  ['wa-progress-ring', 'lr-progress-ring', 'progress-ring'],
  ['wa-qr-code', 'lr-qr-code', 'qr-code'],
  ['wa-rating', 'lr-rating', 'rating'],
  ['wa-switch', 'lr-switch', 'switch'],
  ['wa-tab', 'lr-tab', 'tab'],
  ['wa-tab-group', 'lr-tab-group', 'tab-group'],
  ['wa-time-input', 'lr-time-input', 'time-input'],
  ['wa-tooltip', 'lr-tooltip', 'tooltip'],
  ['wa-tree', 'lr-tree', 'tree'],
  ['wa-tree-item', 'lr-tree-item', 'tree-item'],
  ['wa-input', 'lr-input', 'input-wrapper'],
  ['wa-textarea', 'lr-textarea', 'textarea-wrapper'],
  ['wa-spinner', 'lr-spinner', 'spinner'],
] as const;

async function render(tagName: string): Promise<TestElement> {
  const element = document.createElement(tagName) as TestElement;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe('mapped outer-wrapper part parity', () => {
  for (const [upstreamTag, lyraTag, namedPart] of mappedWrapperParts) {
    it(`${lyraTag} renders base and ${namedPart} on one node (${upstreamTag})`, async () => {
      const element = await render(lyraTag);
      try {
        const selector = `[part~="base"][part~="${namedPart}"]`;
        expect(element.shadowRoot?.querySelectorAll(selector).length ?? 0).to.equal(1);
      } finally {
        element.remove();
      }
    });
  }

  it('keeps the spinner indicator distinct from the named wrapper alias', async () => {
    const element = await render('lr-spinner');
    try {
      const wrapper = element.shadowRoot?.querySelector('[part~="base"][part~="spinner"]');
      const indicator = element.shadowRoot?.querySelector('[part~="spinner-indicator"]');
      expect(wrapper?.localName ?? null).to.equal('span');
      expect(indicator?.localName ?? null).to.equal('span');
      expect(wrapper === indicator).to.be.false;
    } finally {
      element.remove();
    }
  });

  it('lets consumer ::part() rules reach both wrapper names on representative components', async () => {
    const style = document.createElement('style');
    style.textContent = `
      lr-breadcrumb::part(base), lr-spinner::part(base) {
        outline-style: solid;
        outline-width: 7px;
      }
      lr-breadcrumb::part(breadcrumb), lr-spinner::part(spinner) {
        outline-color: rgb(1, 2, 3);
      }
    `;
    document.head.append(style);
    const elements = await Promise.all([render('lr-breadcrumb'), render('lr-spinner')]);
    try {
      for (const element of elements) {
        const wrapper = element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
        const computed = getComputedStyle(wrapper);
        expect(computed.outlineStyle).to.equal('solid');
        expect(computed.outlineWidth).to.equal('7px');
        expect(computed.outlineColor).to.equal('rgb(1, 2, 3)');
      }
    } finally {
      for (const element of elements) element.remove();
      style.remove();
    }
  });
});
