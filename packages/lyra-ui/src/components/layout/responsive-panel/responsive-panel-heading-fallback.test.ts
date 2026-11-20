import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-responsive-panel.js';
import type { LyraResponsivePanel } from '../../lr-responsive-panel.js';

describe('lr-responsive-panel heading fallback', () => {
  it('falls back to the localized panel name when the slotted heading is empty', async () => {
    const el = await fixture<LyraResponsivePanel>(
      html`<lr-responsive-panel mode="overlay" open><h2 slot="header">   </h2><span slot="header">Ignored text</span></lr-responsive-panel>`
    );
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;
    // A heading wins over sibling header text even when it is blank, so the generic name applies.
    expect(panel.getAttribute('aria-label')).to.equal('Panel');
  });
});
