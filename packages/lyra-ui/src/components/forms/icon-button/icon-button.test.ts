import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './icon-button.js';
import '../../media/flag/flag.js';

/** A 1x1 inline SVG, so `<lr-flag>` renders synchronously with no peer-package round trip. */
const TEST_FLAG_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';

it('forwards its accessible label and click event', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`);
  expect(el.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('Dismiss');
  const event = oneEvent(el, 'click');
  el.shadowRoot!.querySelector('button')!.click();
  expect((await event).bubbles).to.be.true;
});

it('keeps the visual glyph independent from the icon button hit target', async () => {
  const el = await fixture(html`<lr-icon-button icon="search" aria-label="Search"></lr-icon-button>`);
  const icon = el.shadowRoot!.querySelector('lr-icon')!;
  const button = el.shadowRoot!.querySelector('button')!;

  // --lr-icon-button-size is a tappable-target *floor*, not a fixed size: a small glyph pads
  // out to it on both axes.
  expect(button.getBoundingClientRect().width).to.equal(40);
  expect(button.getBoundingClientRect().height).to.equal(40);
  expect(getComputedStyle(icon).inlineSize).to.equal('20px');
});

it('renders exactly one resolved lr-icon and no stray slot wrapper for a named glyph', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`);
  const icons = el.shadowRoot!.querySelectorAll('lr-icon');
  expect(icons.length).to.equal(1);
  expect(icons[0].getAttribute('name')).to.equal('close');
  await (icons[0] as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect(icons[0].shadowRoot!.querySelector('path')!.getAttribute('d')).to.equal('m6 6 12 12M18 6 6 18');
  // The glyph is not wrapped around the default slot, so slotted content is a sibling of it.
  // (Assertions stay on counts/strings -- a failed DOM-element `equal` hangs the whole file.)
  expect(icons[0].querySelectorAll('slot').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('slot').length).to.equal(1);
});

it('hosts slotted natural-aspect-ratio content without cloning it into an SVG', async () => {
  const el = await fixture(html`
    <lr-icon-button aria-label="Français">
      <lr-flag src=${TEST_FLAG_SRC} label="Français" style="block-size: 3rem"></lr-flag>
    </lr-icon-button>
  `);
  const flag = el.querySelector('lr-flag')!;
  const button = el.shadowRoot!.querySelector('button')!;

  // No `icon`, so no <lr-icon> is mounted at all -- which is what used to SVG-namespace-clone
  // the slotted element into an `lr-flag` that never upgraded and never painted.
  expect(el.shadowRoot!.querySelectorAll('lr-icon').length).to.equal(0);
  expect(flag.assignedSlot === el.shadowRoot!.querySelector('slot')).to.equal(true);
  expect(flag.shadowRoot!.querySelectorAll('img').length).to.equal(1);
  expect(flag.getBoundingClientRect().width).to.be.greaterThan(0);

  // 3rem tall at the flag's default 4/3 ratio == 64x48: the button takes the content's natural
  // aspect ratio instead of squashing it to a 1:1 box.
  const box = button.getBoundingClientRect();
  expect(box.width).to.be.greaterThan(box.height);
  expect(box.width).to.equal(64);
  expect(box.height).to.equal(48);
});

it('still floors slotted content at the tappable target size on both axes', async () => {
  const el = await fixture(html`
    <lr-icon-button aria-label="Tiny">
      <lr-flag src=${TEST_FLAG_SRC} label="Tiny" style="block-size: 0.5rem"></lr-flag>
    </lr-icon-button>
  `);
  const box = el.shadowRoot!.querySelector('button')!.getBoundingClientRect();
  expect(box.width).to.equal(40);
  expect(box.height).to.equal(40);
});

it('names the button from aria-label, then label, then the localized fallback', async () => {
  const both = await fixture(
    html`<lr-icon-button icon="close" aria-label="Dismiss" label="Close"></lr-icon-button>`,
  );
  expect(both.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('Dismiss');

  const labelOnly = await fixture(html`<lr-icon-button icon="close" label="Close"></lr-icon-button>`);
  expect(labelOnly.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('Close');

  const bare = await fixture(html`<lr-icon-button icon="close"></lr-icon-button>`);
  expect(bare.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('Button');

  const slottedOnly = await fixture(html`
    <lr-icon-button label="Français"><lr-flag src=${TEST_FLAG_SRC} label="Français"></lr-flag></lr-icon-button>
  `);
  expect(slottedOnly.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('Français');
});

it('is accessible', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`);
  await expect(el).to.be.accessible();
});

it('is accessible while disabled', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss" disabled></lr-icon-button>`);
  await expect(el).to.be.accessible();
});

it('is accessible with slotted content instead of a named glyph', async () => {
  const el = await fixture(html`
    <lr-icon-button aria-label="Français"><lr-flag src=${TEST_FLAG_SRC} label=""></lr-flag></lr-icon-button>
  `);
  expect(el.querySelector('lr-flag')!.shadowRoot!.querySelectorAll('img').length).to.equal(1);
  await expect(el).to.be.accessible();
});
