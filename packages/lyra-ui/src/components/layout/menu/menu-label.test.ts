import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-menu-label.js';
import '../../lr-menu.js';
import '../../lr-menu-item.js';

it('renders a presentational heading that is not a focus stop', async () => {
  const el = await fixture(html`<lr-menu-label>Recently used</lr-menu-label>`);
  expect(el.getAttribute('role')).to.equal('presentation');
  expect(el.shadowRoot!.querySelector('[part="base"]')!.textContent).to.equal(
    ''
  );
  expect(el.hasAttribute('tabindex')).to.equal(false);
  await expect(el).to.be.accessible();
});

it('leaves an author-supplied role alone', async () => {
  const el = await fixture(
    html`<lr-menu-label role="none">Recently used</lr-menu-label>`
  );
  expect(el.getAttribute('role')).to.equal('none');
});

it('is skipped by the owning menu roving tabindex', async () => {
  const menu = await fixture(html`
    <lr-menu>
      <lr-menu-label>Recently used</lr-menu-label>
      <lr-menu-item value="a">Alpha</lr-menu-item>
      <lr-menu-item value="b">Bravo</lr-menu-item>
    </lr-menu>
  `);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const label = menu.querySelector('lr-menu-label') as HTMLElement;
  const items = [...menu.querySelectorAll('lr-menu-item')] as HTMLElement[];
  // `<lr-menu>` is the sole authority over its items' tabindex, so every item it manages carries
  // one. The label carries none at all, which is what proves it was never enrolled as an item.
  expect(items.every((item) => item.hasAttribute('tabindex'))).to.equal(true);
  expect(label.hasAttribute('tabindex')).to.equal(false);
});

it('restores the host presentation role when the authored role is removed', async () => {
  const label = await fixture<HTMLElementTagNameMap['lr-menu-label']>(html`<lr-menu-label role="note">Groups</lr-menu-label>`);
  label.removeAttribute('role');
  await label.updateComplete;
  expect(label.getAttribute('role')).to.equal('presentation');
  expect(label.role).to.equal('presentation');
});
