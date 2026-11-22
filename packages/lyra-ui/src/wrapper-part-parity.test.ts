import { expect } from '@open-wc/testing';
import { expectDevWarning } from '../test/expected-dev-warnings.js';
expectDevWarning('lyra-tree-missing-accessible-name');

import './components/lr-pagination.js';
import './components/lr-tree-item.js';
import './components/lr-tree.js';
import './components/lr-button.js';
import './components/lr-checkbox.js';
import './components/lr-color-picker.js';
import './components/lr-input.js';
import './components/lr-number-input.js';
import './components/lr-time-input.js';
import './components/lr-switch.js';
import './components/lr-textarea.js';
import './components/lr-breadcrumb.js';
import './components/lr-carousel.js';
import './components/lr-accordion-item.js';
import './components/lr-details.js';
import './components/lr-tab-group.js';
import './components/lr-tab.js';
import './components/lr-image-comparer.js';
import './components/lr-badge.js';
import './components/lr-tooltip.js';
import './components/lr-progress-bar.js';
import './components/lr-progress-ring.js';
import './components/lr-rating.js';
import './components/lr-button-group.js';
import './components/lr-tab-panel.js';
import './components/lr-spinner.js';
import './components/lr-known-date.js';

type TestElement = HTMLElement & { updateComplete?: Promise<unknown> };

/**
 * Named outer-wrapper parts from Web Awesome 3.15.0's published custom-elements manifest, limited
 * to tags mapped by Lyra whose wrapper also carries `base`. `wa-page` is omitted because it has no
 * mapped Lyra tag yet; `wa-step`, `wa-stepper` and `wa-tag-input` are omitted because their Lyra
 * counterparts do not carry `base` on the component-named wrapper. Keep the upstream tag in each
 * row so a future pin update is reviewable.
 */
const mappedWrapperParts = [
  ['wa-accordion-item', 'lr-accordion-item', 'accordion-item'],
  ['wa-badge', 'lr-badge', 'badge'],
  ['wa-button-group', 'lr-button-group', 'button-group'],
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
  ['wa-rating', 'lr-rating', 'rating'],
  ['wa-switch', 'lr-switch', 'switch'],
  ['wa-tab', 'lr-tab', 'tab'],
  ['wa-tab-group', 'lr-tab-group', 'tab-group'],
  ['wa-tab-panel', 'lr-tab-panel', 'tab-panel'],
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
    it(`${lyraTag} renders the canonical ${namedPart} wrapper (${upstreamTag})`, async () => {
      const element = await render(lyraTag);
      try {
        const selector = lyraTag === 'lr-accordion-item'
          ? `[part~="${namedPart}"]` : `[part~="base"][part~="${namedPart}"]`;
        if (lyraTag === 'lr-accordion-item') expect(element.shadowRoot?.querySelectorAll('[part~="base"]').length ?? 0).to.equal(0);
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

  it('keeps Details wrapper aliases on the outer disclosure container rather than its private native details', async () => {
    const element = await render('lr-details');
    try {
      const wrapper = element.shadowRoot?.querySelector<HTMLElement>(
        '[part~="base"][part~="details"]'
      );
      const nativeDetails = element.shadowRoot?.querySelector<HTMLDetailsElement>(
        'details:not([part])'
      );
      const header = element.shadowRoot?.querySelector<HTMLElement>('[part="header"]');
      const summary = element.shadowRoot?.querySelector<HTMLElement>('[part="summary"]');
      const headerActions = element.shadowRoot?.querySelector<HTMLElement>(
        '[part~="header-actions"]'
      );
      const content = element.shadowRoot?.querySelector<HTMLElement>('[part="content"]');
      expect(wrapper?.localName ?? null).to.equal('div');
      expect(nativeDetails?.localName ?? null).to.equal('details');
      expect(nativeDetails?.hasAttribute('part') ?? true).to.equal(false);
      expect(header?.parentElement === wrapper).to.equal(true);
      expect(summary?.parentElement === nativeDetails).to.equal(true);
      expect(headerActions?.previousElementSibling === nativeDetails).to.equal(true);
      expect(content?.parentElement?.hasAttribute('part') ?? true).to.equal(false);
    } finally {
      element.remove();
    }
  });
});
