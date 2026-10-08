import { expect, fixture } from '@open-wc/testing';
import '../components/overlays/badge/badge.js';
import '../components/overlays/callout/callout.js';

for (const tagName of ['lr-badge', 'lr-callout']) {
  for (const variant of ['success', 'warning', 'danger']) {
    it(`${tagName} variant=${variant} maps the semantic fill/border/on tokens`, async () => {
      const el = await fixture<HTMLElement>(`<${tagName} variant="${variant}">x</${tagName}>`);
      const computed = getComputedStyle(el);
      for (const role of ['fill-quiet', 'border-normal', 'on-loud']) {
        expect(computed.getPropertyValue(`--lr-color-${role}`).trim()).to.equal(
          computed.getPropertyValue(`--lr-color-${variant}-${role}`).trim(),
        );
      }
    });
  }
}
