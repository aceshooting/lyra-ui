import { expect, fixture, html } from '@open-wc/testing';
import './animation.js';

it('is accessible with a slotted animation target', async () => {
  const el = await fixture(html`
      <lyra-animation name="none" play iterations="1">
      <p>Animated content</p>
    </lyra-animation>
  `);
  await expect(el).to.be.accessible();
});
