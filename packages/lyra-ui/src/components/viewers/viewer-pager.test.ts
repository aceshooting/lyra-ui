import { expect, fixture, html } from '@open-wc/testing';
import { LyraElement } from '../../internal/lyra-element.js';
import { setReducedMotion } from '../../../test/wtr-media.js';
import { renderViewerPagerButton, viewerPagerStyles } from './viewer-pager.js';

class ViewerPagerFixture extends LyraElement {
  static override styles = [LyraElement.styles, viewerPagerStyles];
  protected override render() {
    return html`${renderViewerPagerButton('previous', 'Previous', false, () => {})}`;
  }
}
if (!customElements.get('test-viewer-pager')) customElements.define('test-viewer-pager', ViewerPagerFixture);

describe('shared viewer pager', () => {
  it('keeps a visible hit target and removes transitions under reduced motion', async () => {
    await setReducedMotion('no-preference');
    try {
      const viewer = await fixture<ViewerPagerFixture>(html`<test-viewer-pager></test-viewer-pager>`);
      const button = viewer.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
      expect(button.getAttribute('aria-label')).to.equal('Previous');
      expect(button.getAttribute('part')).to.equal('previous-button');
      expect(button.getBoundingClientRect().width).to.be.greaterThan(0);
      await setReducedMotion('reduce');
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(getComputedStyle(button).transitionDuration).to.equal('0s');
    } finally {
      await setReducedMotion('no-preference');
    }
  });
});
