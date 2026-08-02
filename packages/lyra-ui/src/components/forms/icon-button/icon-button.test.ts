import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './icon-button.js';
import '../../media/flag/flag.js';
import { styles } from './icon-button.styles.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import type { LyraIconButton } from './icon-button.js';

/** A 1x1 inline SVG, so `<lr-flag>` renders synchronously with no peer-package round trip. */
const TEST_FLAG_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';

it('forwards its accessible label and click event', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`);
  expect(el.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('Dismiss');
  const event = oneEvent(el, 'click');
  el.shadowRoot!.querySelector('button')!.click();
  expect((await event).bubbles).to.be.true;
});

it('relays exactly one native focus/blur pair plus one prefixed alias pair', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div><lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button></div>
  `);
  const el = wrapper.querySelector('lr-icon-button') as LyraIconButton;
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  wrapper.addEventListener('focus', (event) => nativeEvents.push(event as FocusEvent));
  wrapper.addEventListener('blur', (event) => nativeEvents.push(event as FocusEvent));
  wrapper.addEventListener('lr-focus', () => aliases.push('lr-focus'));
  wrapper.addEventListener('lr-blur', () => aliases.push('lr-blur'));

  el.focus();
  el.blur();

  expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
  expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
  expect(aliases).to.deep.equal(['lr-focus', 'lr-blur']);
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

it('restores SVG context for slotted bare geometry with no icon and no enclosing svg', async () => {
  const el = await fixture(html`
    <lr-icon-button aria-label="Star">
      <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"></path>
    </lr-icon-button>
  `);
  const fallback = el.shadowRoot!.querySelector('[part="fallback"]') as SVGSVGElement | null;
  expect(fallback, 'a fallback SVG must be mounted').to.exist;
  const clonedPath = fallback!.querySelector('path');
  expect(clonedPath, 'the bare <path> must be cloned into real SVG namespace').to.exist;
  expect(clonedPath!.namespaceURI).to.equal('http://www.w3.org/2000/svg');
  expect(clonedPath!.getAttribute('d')).to.equal('M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z');
  // The original slotted node stays in the light DOM untouched (still there, still HTML-namespaced) --
  // only a clone is added to the internal fallback SVG.
  const original = el.querySelector('path')!;
  expect(original.namespaceURI).to.not.equal('http://www.w3.org/2000/svg');
});

it('gives the fallback svg the same fill/stroke defaults lr-icon own wrapper uses, so bare stroke-style geometry renders outlined', async () => {
  const el = await fixture(html`
    <lr-icon-button aria-label="Star">
      <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"></path>
    </lr-icon-button>
  `);
  const fallback = el.shadowRoot!.querySelector('[part="fallback"]') as SVGSVGElement;
  expect(fallback.getAttribute('fill')).to.equal('none');
  expect(fallback.getAttribute('stroke')).to.equal('currentColor');
  expect(fallback.getAttribute('stroke-width')).to.equal('1.75');
  expect(fallback.getAttribute('stroke-linecap')).to.equal('round');
  expect(fallback.getAttribute('stroke-linejoin')).to.equal('round');
});

it('lets a slotted node with its own fill/stroke override the fallback svg defaults', async () => {
  const el = await fixture(html`
    <lr-icon-button aria-label="Dot">
      <circle cx="12" cy="12" r="8" fill="red" stroke="blue"></circle>
    </lr-icon-button>
  `);
  const fallback = el.shadowRoot!.querySelector('[part="fallback"]') as SVGSVGElement;
  // Parent svg still carries the base defaults...
  expect(fallback.getAttribute('fill')).to.equal('none');
  // ...but the cloned child's own explicit attributes win for that child, matching today's
  // verbatim-attribute-copy behavior.
  const clonedCircle = fallback.querySelector('circle')!;
  expect(clonedCircle.getAttribute('fill')).to.equal('red');
  expect(clonedCircle.getAttribute('stroke')).to.equal('blue');
});

it('never runs a slotted custom element through the bare-geometry clone path', async () => {
  const el = await fixture(html`
    <lr-icon-button aria-label="Français">
      <lr-flag src=${TEST_FLAG_SRC} label="Français"></lr-flag>
    </lr-icon-button>
  `);
  // No fallback SVG at all -- lr-flag is a complete element, not bare geometry.
  expect(el.shadowRoot!.querySelector('[part="fallback"]')).to.not.exist;
  const flag = el.querySelector('lr-flag')!;
  expect(flag.shadowRoot!.querySelectorAll('img').length).to.equal(1);
});

it('leaves a complete slotted svg/img untouched by the fallback path', async () => {
  const el = await fixture(html`
    <lr-icon-button aria-label="Custom">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle></svg>
    </lr-icon-button>
  `);
  expect(el.shadowRoot!.querySelector('[part="fallback"]')).to.not.exist;
  expect(el.querySelectorAll('svg').length).to.equal(1);
});

it('still floors slotted content at the tappable target size on both axes', async () => {
  const el = await fixture(html`
    <lr-icon-button aria-label="Tiny">
      <span style="display: block; inline-size: 0.5rem; block-size: 0.5rem"></span>
    </lr-icon-button>
  `);
  const box = el.shadowRoot!.querySelector('button')!.getBoundingClientRect();
  expect(box.width).to.equal(40);
  expect(box.height).to.equal(40);
});

it('exposes --lr-icon-button-radius, defaulting to the pre-existing literal', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`);
  const cs = getComputedStyle(el.shadowRoot!.querySelector('button')!);
  expect(cs.borderRadius).to.equal('6px');
});

it('retunes the corner radius via --lr-icon-button-radius with no element-selector override', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`);
  (el as HTMLElement).style.setProperty('--lr-icon-button-radius', '3px');
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  const cs = getComputedStyle(el.shadowRoot!.querySelector('button')!);
  expect(cs.borderRadius).to.equal('3px');
});

it('declares --lr-icon-button-radius on :host and consumes it on the button element', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/:host \{[^}]*--lr-icon-button-radius: var\(--lr-radius\);/);
  expect(css).to.include('border-radius: var(--lr-icon-button-radius);');
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

it('localizes the fallback accessible name via .strings', async () => {
  const el = await fixture(html`<lr-icon-button icon="close"></lr-icon-button>`);
  expect(el.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('Button');
  (el as unknown as { strings: Record<string, string> }).strings = { iconButtonLabel: 'Bouton' };
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  expect(el.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('Bouton');
});

it('forwards host click() to the internal native button, not just a bare host-level click event', async () => {
  // HTMLElement.click() already dispatches a bubbling click event on the host with no override at
  // all -- that alone doesn't prove the internal <button part="button"> was actually activated, so
  // this asserts the internal button's own click handler ran instead of the host's generic default.
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`);
  let internalClicks = 0;
  el.shadowRoot!.querySelector('button')!.addEventListener('click', () => internalClicks++);
  el.click();
  expect(internalClicks).to.equal(1);
});

it('reflects disabled synchronously on assignment, with no await', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`);
  expect(el.hasAttribute('disabled')).to.be.false;
  // No `await`: the `disabled` setter must synchronously reflect the host attribute before any
  // same-tick native form API (e.g. a `<fieldset>` toggle) runs -- mirrors `<lr-button>`'s
  // identical test.
  (el as unknown as { disabled: boolean }).disabled = true;
  expect(el.hasAttribute('disabled'), 'the host attribute must be set synchronously').to.be.true;
  (el as unknown as { disabled: boolean }).disabled = false;
  expect(el.hasAttribute('disabled')).to.be.false;
});

it('never forwards host click() while disabled (native disabled button semantics)', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss" disabled></lr-icon-button>`);
  let calls = 0;
  el.addEventListener('click', () => calls++);
  el.click();
  expect(calls).to.equal(0);
});

it('is form-associated, participating in an ancestor form.elements', async () => {
  const form = await fixture(html`
    <form><lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button></form>
  `) as HTMLFormElement;
  const el = form.querySelector('lr-icon-button')!;
  expect(Array.from(form.elements)).to.include(el);
});

it('type="submit" requests submit on the closest ancestor form via host click()', async () => {
  const form = await fixture(html`
    <form><lr-icon-button icon="close" aria-label="Save" type="submit"></lr-icon-button></form>
  `) as HTMLFormElement;
  const el = form.querySelector('lr-icon-button')!;
  let submitted = false;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitted = true;
  });
  el.click();
  expect(submitted).to.be.true;
});

it('type="reset" resets the closest ancestor form via host click()', async () => {
  const form = await fixture(html`
    <form>
      <input name="field" />
      <lr-icon-button icon="close" aria-label="Reset" type="reset"></lr-icon-button>
    </form>
  `) as HTMLFormElement;
  const input = form.querySelector('input') as HTMLInputElement;
  input.value = 'changed';
  const el = form.querySelector('lr-icon-button')!;
  el.click();
  expect(input.value).to.equal('');
});

it('submits and resets through an external form owner', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <form id="external-icon-owner"><input name="draft" value="initial"></form>
      <lr-icon-button form="external-icon-owner" icon="close" aria-label="Act" type="submit"></lr-icon-button>
    </div>
  `);
  const form = wrapper.querySelector('form')!;
  const input = form.querySelector('input')!;
  const el = wrapper.querySelector('lr-icon-button') as LyraIconButton;
  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits++;
  });

  el.click();
  expect(submits).to.equal(1);

  input.value = 'changed';
  el.type = 'reset';
  await el.updateComplete;
  el.click();
  expect(input.value).to.equal('initial');
});

it('honours --lr-icon-button-background and --lr-icon-button-color on the native button', async () => {
  const el = await fixture(html`
    <lr-icon-button
      icon="close"
      aria-label="Dismiss"
      style="--lr-icon-button-background: rgb(1, 2, 3); --lr-icon-button-color: rgb(7, 8, 9);"
    ></lr-icon-button>
  `);
  const cs = getComputedStyle(el.shadowRoot!.querySelector('button')!);
  expect(cs.backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(cs.color).to.equal('rgb(7, 8, 9)');
});

it('honours --lr-icon-button-border on the native button', async () => {
  const el = await fixture(html`
    <lr-icon-button
      icon="close"
      aria-label="Dismiss"
      style="--lr-icon-button-border: 2px solid rgb(10, 20, 30);"
    ></lr-icon-button>
  `);
  const cs = getComputedStyle(el.shadowRoot!.querySelector('button')!);
  expect(cs.borderTopWidth).to.equal('2px');
  expect(cs.borderTopStyle).to.equal('solid');
  expect(cs.borderTopColor).to.equal('rgb(10, 20, 30)');
});

// :hover and :active DO have scriptable state here -- the runner drives a real pointer through
// test/wtr-mouse.ts -- so these assert what the button actually paints. They used to match the
// stylesheet text instead, which is precisely why the hover fallback could resolve to
// var(--lr-color-surface), i.e. the page background, and read as "no hover at all" on a default
// page for two majors with a green test.
/** The page surface, painted onto a throwaway node inside the button's own shadow root so it comes
 *  back as a normalised colour string comparable to a computed background-color. Never hardcode the
 *  hex: the palette is generated. */
function surfaceColor(el: Element): string {
  const probe = document.createElement('div');
  probe.style.background = 'var(--lr-color-surface)';
  el.shadowRoot!.appendChild(probe);
  const painted = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return painted;
}

const centerOf = (node: Element): [number, number] => {
  const rect = node.getBoundingClientRect();
  return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
};

it('hovers to a background that is visibly not the page surface it sits on', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`);
  const button = el.shadowRoot!.querySelector('button')!;
  const surface = surfaceColor(el);
  const resting = getComputedStyle(button).backgroundColor;
  try {
    await sendMouse({ type: 'move', position: centerOf(button) });
    const hovered = getComputedStyle(button).backgroundColor;
    expect(hovered, 'hover vs page surface').to.not.equal(surface);
    expect(hovered, 'hover vs resting').to.not.equal(resting);
  } finally {
    await resetMouse();
  }
});

it('presses to a background stronger than -- and different from -- its hover', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`);
  const button = el.shadowRoot!.querySelector('button')!;
  try {
    await sendMouse({ type: 'move', position: centerOf(button) });
    const hovered = getComputedStyle(button).backgroundColor;
    await sendMouse({ type: 'down' });
    const pressed = getComputedStyle(button).backgroundColor;
    expect(pressed, 'pressed vs hovered').to.not.equal(hovered);
    expect(pressed, 'pressed vs page surface').to.not.equal(surfaceColor(el));
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('honours the hover and press override tokens on the rendered button', async () => {
  const el = await fixture(html`
    <lr-icon-button
      icon="close"
      aria-label="Dismiss"
      style="--lr-icon-button-background-hover: rgb(1, 2, 3); --lr-icon-button-color-hover: rgb(4, 5, 6); --lr-icon-button-border-hover: 2px solid rgb(7, 8, 9); --lr-icon-button-background-active: rgb(10, 11, 12); --lr-icon-button-color-active: rgb(13, 14, 15); --lr-icon-button-border-active: 2px solid rgb(16, 17, 18);"
    ></lr-icon-button>
  `);
  const button = el.shadowRoot!.querySelector('button')!;
  try {
    await sendMouse({ type: 'move', position: centerOf(button) });
    const hovered = getComputedStyle(button);
    expect(hovered.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(hovered.color).to.equal('rgb(4, 5, 6)');
    expect(hovered.borderTopColor).to.equal('rgb(7, 8, 9)');
    await sendMouse({ type: 'down' });
    const pressed = getComputedStyle(button);
    expect(pressed.backgroundColor).to.equal('rgb(10, 11, 12)');
    expect(pressed.color).to.equal('rgb(13, 14, 15)');
    expect(pressed.borderTopColor).to.equal('rgb(16, 17, 18)');
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('falls the press tokens through to the hover ones when only those are set', async () => {
  const el = await fixture(html`
    <lr-icon-button
      icon="close"
      aria-label="Dismiss"
      style="--lr-icon-button-color-hover: rgb(4, 5, 6); --lr-icon-button-border-hover: 2px solid rgb(7, 8, 9);"
    ></lr-icon-button>
  `);
  const button = el.shadowRoot!.querySelector('button')!;
  try {
    await sendMouse({ type: 'move', position: centerOf(button) });
    await sendMouse({ type: 'down' });
    const pressed = getComputedStyle(button);
    expect(pressed.color).to.equal('rgb(4, 5, 6)');
    expect(pressed.borderTopColor).to.equal('rgb(7, 8, 9)');
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('renders unset background/color exactly as before (unset-regression)', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`);
  const cs = getComputedStyle(el.shadowRoot!.querySelector('button')!);
  // With every new tint token unset, the button keeps today's transparent background and no
  // rendered border -- the additive guarantee 6.2.0 rests on.
  expect(cs.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  expect(cs.borderStyle).to.equal('none');
});

it('is accessible', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`);
  await expect(el).to.be.accessible();
});

it('is accessible while disabled', async () => {
  const el = await fixture(html`<lr-icon-button icon="close" aria-label="Dismiss" disabled></lr-icon-button>`);
  await expect(el).to.be.accessible();
});

it('inherits fieldset disabled state and cannot submit while effectively disabled', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-icon-button icon="close" aria-label="Save" type="submit"></lr-icon-button>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  const el = form.querySelector('lr-icon-button') as LyraIconButton;
  const button = el.shadowRoot!.querySelector('button') as HTMLButtonElement;
  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits++;
  });

  fieldset.disabled = true;
  await el.updateComplete;
  expect(button.disabled).to.be.true;
  el.click();
  expect(submits).to.equal(0);

  fieldset.disabled = false;
  await el.updateComplete;
  el.click();
  expect(submits).to.equal(1);
});

it('remains constructible when attachInternals is unavailable', () => {
  const original = HTMLElement.prototype.attachInternals;
  // @ts-expect-error simulates an SSR/test DOM without ElementInternals.
  delete HTMLElement.prototype.attachInternals;
  try {
    expect(() => document.createElement('lr-icon-button')).to.not.throw();
  } finally {
    HTMLElement.prototype.attachInternals = original;
  }
});

it('is accessible with slotted content instead of a named glyph', async () => {
  const el = await fixture(html`
    <lr-icon-button aria-label="Français"><lr-flag src=${TEST_FLAG_SRC} label=""></lr-flag></lr-icon-button>
  `);
  expect(el.querySelector('lr-flag')!.shadowRoot!.querySelectorAll('img').length).to.equal(1);
  await expect(el).to.be.accessible();
});

it('blur() releases the native button it focused', async () => {
  const el = (await fixture(
    html`<lr-icon-button icon="close" aria-label="Dismiss"></lr-icon-button>`,
  )) as LyraIconButton;
  await el.updateComplete;
  el.focus();
  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('button'));
  el.blur();
  expect(el.shadowRoot!.activeElement).to.be.null;
});

describe('lr-icon-button — mapped Shoelace surface', () => {
  it('accepts name/library/src aliases and forwards them to the resolved lr-icon', async () => {
    const named = (await fixture(html`
      <lr-icon-button name="close" library="default" label="Dismiss"></lr-icon-button>
    `)) as LyraIconButton;
    const namedIcon = named.shadowRoot!.querySelector('lr-icon')!;
    expect(named.name).to.equal('close');
    expect(named.icon).to.equal('close');
    expect(named.library).to.equal('default');
    expect(namedIcon.getAttribute('name')).to.equal('close');
    expect(namedIcon.getAttribute('library')).to.equal('default');

    named.name = 'search';
    await named.updateComplete;
    expect(named.icon).to.equal('search');
    expect(named.shadowRoot!.querySelector('lr-icon')!.getAttribute('name')).to.equal('search');

    const sourced = (await fixture(html`
      <lr-icon-button src=${TEST_FLAG_SRC} label="Remote icon"></lr-icon-button>
    `)) as LyraIconButton;
    const sourcedIcon = sourced.shadowRoot!.querySelector('lr-icon')!;
    expect(sourced.src).to.equal(TEST_FLAG_SRC);
    expect(sourcedIcon.getAttribute('src')).to.equal(TEST_FLAG_SRC);
  });

  it('exports base and button from the same native control in button mode', async () => {
    const el = (await fixture(html`
      <lr-icon-button name="close" label="Dismiss"></lr-icon-button>
    `)) as LyraIconButton;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const button = el.shadowRoot!.querySelector('[part~="button"]') as HTMLElement;
    expect(base.isSameNode(button)).to.be.true;
    expect(base.localName).to.equal('button');
  });

  it('renders safe href/target/download as a real anchor with a derived safe rel', async () => {
    const el = (await fixture(html`
      <lr-icon-button
        name="close"
        label="Download"
        href="https://example.com/icon.svg"
        target="_blank"
        download="icon.svg"
      ></lr-icon-button>
    `)) as LyraIconButton;
    const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
    expect(anchor).to.exist;
    expect(anchor.getAttribute('href')).to.equal('https://example.com/icon.svg');
    expect(anchor.target).to.equal('_blank');
    expect(anchor.rel).to.equal('noopener noreferrer');
    expect(anchor.download).to.equal('icon.svg');
    await expect(el).to.be.accessible();
  });

  it('makes disabled link mode inert and restores its href when re-enabled', async () => {
    const el = (await fixture(html`
      <lr-icon-button name="close" label="Open" href="https://example.com" disabled></lr-icon-button>
    `)) as LyraIconButton;
    let clicks = 0;
    el.addEventListener('click', () => clicks++);
    const anchor = el.shadowRoot!.querySelector('a[part~="base"]') as HTMLAnchorElement;
    expect(anchor.hasAttribute('href')).to.be.false;
    expect(anchor.getAttribute('aria-disabled')).to.equal('true');
    el.click();
    expect(clicks).to.equal(0);

    el.disabled = false;
    await el.updateComplete;
    expect(anchor.getAttribute('href')).to.equal('https://example.com');
    await expect(el).to.be.accessible();
  });

  it('falls back to the native button for an unsafe href', async () => {
    const el = (await fixture(html`
      <lr-icon-button name="close" label="Unsafe" href="javascript:alert(1)"></lr-icon-button>
    `)) as LyraIconButton;
    expect(el.shadowRoot!.querySelectorAll('a').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('button[part~="base"]').length).to.equal(1);
  });
});
