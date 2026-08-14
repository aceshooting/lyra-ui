import { expect, fixture, html } from '@open-wc/testing';
import { LyraElement } from '../../internal/lyra-element.js';
import { renderViewerLoading, viewerLoadingStyles } from './viewer-loading.js';
import './archive-viewer/archive-viewer.js';
import './calendar-viewer/calendar-viewer.js';
import './contact-viewer/contact-viewer.js';
import './csv-viewer/csv-viewer.js';
import './dataset-viewer/dataset-viewer.js';
import './docx-viewer/docx-viewer.js';
import './email-viewer/email-viewer.js';
import './html-viewer/html-viewer.js';
import './notebook-viewer/notebook-viewer.js';
import './spreadsheet-viewer/spreadsheet-viewer.js';
import './svg-viewer/svg-viewer.js';
import './xml-viewer/xml-viewer.js';

class ViewerLoadingFixture extends LyraElement {
  static override styles = [LyraElement.styles, viewerLoadingStyles];
  protected override render() { return renderViewerLoading('Loading document…'); }
}

if (!customElements.get('test-viewer-loading')) {
  customElements.define('test-viewer-loading', ViewerLoadingFixture);
}

describe('shared viewer loading treatment', () => {
  it('covers every viewer-local formerly blank loading container with one busy owner and visible text', async () => {
    const cases = [
      ['lr-archive-viewer', 'fetchState'],
      ['lr-calendar-viewer', 'fetchState'],
      ['lr-contact-viewer', 'fetchState'],
      ['lr-csv-viewer', 'fetchState'],
      ['lr-dataset-viewer', 'fetchState'],
      ['lr-docx-viewer', 'fetchState'],
      ['lr-email-viewer', 'fetchState'],
      ['lr-html-viewer', 'fetchState'],
      ['lr-notebook-viewer', 'loadState'],
      ['lr-spreadsheet-viewer', 'fetchState'],
      ['lr-svg-viewer', 'fetchState'],
      ['lr-xml-viewer', 'xmlState'],
    ] as const;
    const holder = await fixture<HTMLElement>(html`<div style="inline-size: 10rem"></div>`);

    for (const [tagName, stateKey] of cases) {
      const viewer = document.createElement(tagName) as HTMLElement & {
        requestUpdate(): void;
        updateComplete: Promise<unknown>;
      };
      holder.replaceChildren(viewer);
      await viewer.updateComplete;
      (viewer as unknown as Record<string, unknown>)[stateKey] = { kind: 'loading' };
      viewer.requestUpdate();
      await viewer.updateComplete;

      const base = viewer.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const label = viewer.shadowRoot!.querySelector<HTMLElement>('.viewer-loading-label')!;
      const indicator = viewer.shadowRoot!.querySelector<HTMLElement>('.viewer-loading-indicator')!;
      expect(base.getAttribute('aria-busy'), tagName).to.equal('true');
      expect(label.textContent, tagName).to.equal('Loading document…');
      expect(label.getBoundingClientRect().height, tagName).to.be.greaterThan(0);
      expect(indicator.getBoundingClientRect().width, tagName).to.be.greaterThan(0);
      expect(viewer.shadowRoot!.querySelectorAll('[role="status"], [role="alert"], [aria-live]'), tagName)
        .to.have.lengthOf(0);

      (viewer as unknown as Record<string, unknown>)[stateKey] = { kind: 'idle' };
      viewer.requestUpdate();
      await viewer.updateComplete;
      expect(base.getAttribute('aria-busy'), tagName).to.equal('false');
      expect(viewer.shadowRoot!.querySelector('.viewer-loading-label') === null, tagName).to.equal(true);
    }
  });

  it('paints a constrained tokenized indicator and ordinary text without creating another live region', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="inline-size: 10rem"><test-viewer-loading></test-viewer-loading></div>
    `);
    const host = wrapper.querySelector('test-viewer-loading') as ViewerLoadingFixture;
    await host.updateComplete;
    const spinner = host.shadowRoot!.querySelector<HTMLElement>('[part="spinner"]')!;
    const indicator = host.shadowRoot!.querySelector<HTMLElement>('.viewer-loading-indicator')!;
    const label = host.shadowRoot!.querySelector<HTMLElement>('.viewer-loading-label')!;
    expect(spinner.getBoundingClientRect().width).to.be.at.most(wrapper.getBoundingClientRect().width);
    expect(indicator.getBoundingClientRect().width).to.be.greaterThan(0);
    expect(indicator.getBoundingClientRect().height).to.be.greaterThan(0);
    expect(getComputedStyle(label).display).to.not.equal('none');
    expect(label.textContent).to.equal('Loading document…');
    expect(label.classList.contains('sr-only')).to.be.false;
    expect(host.shadowRoot!.querySelectorAll('[role="status"], [role="alert"], [aria-live]')).to.have.lengthOf(0);
  });

  it('ships a static reduced-motion branch for the shared animated indicator', async () => {
    const host = await fixture<ViewerLoadingFixture>(html`<test-viewer-loading></test-viewer-loading>`);
    await host.updateComplete;
    const sheets = [...host.shadowRoot!.styleSheets, ...host.shadowRoot!.adoptedStyleSheets];
    const reducedRule = sheets.flatMap((sheet) => [...sheet.cssRules])
      .find((rule) => rule instanceof CSSMediaRule
        && rule.conditionText === '(prefers-reduced-motion: reduce)') as CSSMediaRule | undefined;
    expect(reducedRule?.conditionText).to.equal('(prefers-reduced-motion: reduce)');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const indicator = host.shadowRoot!.querySelector<HTMLElement>('.viewer-loading-indicator')!;
      expect(getComputedStyle(indicator).animationName).to.equal('none');
    }
  });
});
