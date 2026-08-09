import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './tag.js';
import type { LyraTag } from './tag.js';

class TagLabelForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const tag = this.ownerDocument.createElement('lr-tag');
    tag.setAttribute('with-remove', '');
    tag.append(this.ownerDocument.createElement('slot'));
    root.append(tag);
  }
}
customElements.define('tag-label-forward-wrapper', TagLabelForwardWrapper);

// `<lr-tag>` shares `<lr-badge>`'s surface (see tag.class.ts) and adds the removable-chip surface
// on top of it, but it is still its own registered custom element (`lr-tag` in the manifest) --
// badge.test.ts mounts one in passing but only ever runs an axe accessibility check against
// `lr-badge`, never against an `lr-tag` instance itself, which is the per-tag a11y contract every
// public custom element is expected to carry.

const removeButton = (el: LyraTag): HTMLButtonElement | null =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="remove-button"]');

it('renders content and inherits the badge variant styling contract', async () => {
  const el = (await fixture(html`<lr-tag variant="success">Ready</lr-tag>`)) as LyraTag;
  expect(el.textContent).to.contain('Ready');
  expect(el.variant).to.equal('success');
  const base = el.shadowRoot!.querySelector('[part~="base"]');
  expect(base?.tagName).to.equal('SPAN');
});

it('is accessible in its own right, not merely via lr-badge', async () => {
  const el = (await fixture(html`<lr-tag>Tag</lr-tag>`)) as LyraTag;
  await expect(el).to.be.accessible();
});

it('inherits the size property/scale from lr-badge', async () => {
  const el = (await fixture(html`<lr-tag size="l">Big tag</lr-tag>`)) as LyraTag;
  expect(el.size).to.equal('l');
  expect(el.getAttribute('size')).to.equal('l');
});

describe('withRemove', () => {
  it('renders no remove affordance by default, leaving the committed output unchanged', async () => {
    const el = (await fixture(html`<lr-tag>Plain</lr-tag>`)) as LyraTag;
    expect(el.withRemove).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part~="remove-button"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('button').length).to.equal(0);
  });

  it('renders a real native button once with-remove is set', async () => {
    const el = (await fixture(html`<lr-tag with-remove>Removable</lr-tag>`)) as LyraTag;
    expect(el.withRemove).to.be.true;
    const button = removeButton(el);
    expect(button?.tagName).to.equal('BUTTON');
    expect(button?.type).to.equal('button');
    // The glyph itself is decorative; the name comes from the button's own aria-label.
    expect(button!.querySelector('svg')?.getAttribute('aria-hidden')).to.equal('true');
  });

  it('accepts removable as the Shoelace alias and exports its base part alias', async () => {
    const el = (await fixture(html`<lr-tag removable>Removable alias</lr-tag>`)) as LyraTag;
    expect(el.removable).to.be.true;
    expect(el.withRemove).to.be.true;
    const button = removeButton(el)!;
    expect(button.part.contains('remove-button')).to.be.true;
    expect(button.part.contains('remove-button__base')).to.be.true;

    el.removable = false;
    await el.updateComplete;
    expect(el.withRemove).to.be.false;
    expect((removeButton(el)) === (null)).to.equal(true);
  });

  it('names the remove button with the tag label, localized', async () => {
    const el = (await fixture(html`<lr-tag with-remove>Removable</lr-tag>`)) as LyraTag;
    expect(removeButton(el)?.getAttribute('aria-label')).to.equal('Remove Removable');
  });

  it('falls back to the bare remove string for a label-less tag', async () => {
    const el = (await fixture(html`<lr-tag with-remove></lr-tag>`)) as LyraTag;
    expect(removeButton(el)?.getAttribute('aria-label')).to.equal('Remove');
  });

  it('routes the remove button name through this.localize()', async () => {
    const el = (await fixture(html`
      <lr-tag with-remove .strings=${{ removeWithContext: 'Supprimer {label}' }}>Balise</lr-tag>
    `)) as LyraTag;
    expect(removeButton(el)?.getAttribute('aria-label')).to.equal('Supprimer Balise');
  });

  it('lets a host aria-label win over the computed remove-button name', async () => {
    const el = (await fixture(
      html`<lr-tag with-remove aria-label="Remove the beta filter">beta</lr-tag>`,
    )) as LyraTag;
    expect(removeButton(el)?.getAttribute('aria-label')).to.equal('Remove the beta filter');
  });

  it('tracks a forwarded label and preserves an explicitly empty host aria-label', async () => {
    const wrapper = (await fixture(html`
      <tag-label-forward-wrapper><span data-label>Alpha</span></tag-label-forward-wrapper>
    `)) as TagLabelForwardWrapper;
    const el = wrapper.shadowRoot!.querySelector('lr-tag') as LyraTag;
    await el.updateComplete;
    const label = wrapper.querySelector<HTMLElement>('[data-label]')!;
    expect(removeButton(el)?.getAttribute('aria-label')).to.equal('Remove Alpha');

    label.textContent = 'Beta';
    await Promise.resolve();
    await el.updateComplete;
    expect(removeButton(el)?.getAttribute('aria-label')).to.equal('Remove Beta');

    label.setAttribute('aria-label', 'Gamma');
    await Promise.resolve();
    await el.updateComplete;
    expect(removeButton(el)?.getAttribute('aria-label')).to.equal('Remove Gamma');

    el.setAttribute('aria-label', '');
    await Promise.resolve();
    await el.updateComplete;
    expect(removeButton(el)?.getAttribute('aria-label')).to.equal('');

    el.removeAttribute('aria-label');
    const replacement = wrapper.ownerDocument.createElement('span');
    replacement.textContent = 'Delta';
    const reassigned = oneEvent(el.querySelector('slot')!, 'slotchange');
    label.replaceWith(replacement);
    await reassigned;
    await el.updateComplete;
    expect(removeButton(el)?.getAttribute('aria-label')).to.equal('Remove Delta');
  });

  it('constructs its live-label observer in the adopted owner realm', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameWindow = frame.contentWindow!;
    const frameDocument = frame.contentDocument!;
    const descriptor = Object.getOwnPropertyDescriptor(frameWindow, 'MutationObserver');
    const NativeMutationObserver = frameWindow.MutationObserver;
    let constructions = 0;
    class TrackingMutationObserver extends NativeMutationObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        constructions += 1;
      }
    }
    Object.defineProperty(frameWindow, 'MutationObserver', {
      configurable: true,
      value: TrackingMutationObserver,
    });
    const el = (await fixture(html`<lr-tag with-remove>Alpha</lr-tag>`)) as LyraTag;
    el.remove();
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      expect(constructions, 'base and label observers use the adopted window').to.be.greaterThan(1);
    } finally {
      el.remove();
      if (descriptor) Object.defineProperty(frameWindow, 'MutationObserver', descriptor);
      else delete (frameWindow as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver;
      frame.remove();
    }
  });

  it('skips its optional label observer when SSR provides no owner document', async () => {
    const el = (await fixture(html`<lr-tag with-remove>Alpha</lr-tag>`)) as LyraTag;
    el.remove();
    Object.defineProperty(el, 'ownerDocument', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(() =>
        (el as unknown as { syncLabelObserver(): void }).syncLabelObserver(),
      ).not.to.throw();
    } finally {
      delete (el as unknown as { ownerDocument?: Document }).ownerDocument;
    }
  });

  it('matches the SSR remove label on first hydration, then preserves the action while adding context', async () => {
    const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
    const el = document.createElement('lr-tag') as LyraTag;
    el.setAttribute('with-remove', '');
    // A pre-existing shadow root is LyraElement's hydration signal. The repository-wide hydration
    // gate covers real declarative-shadow-DOM node claiming; this focused fixture proves the
    // component's first/second-update state contract without globally installing hydration hooks.
    el.attachShadow({ mode: 'open' });
    el.innerHTML = '<strong>Alpha</strong>';
    container.append(el);

    await el.updateComplete;
    const hydrationAction = removeButton(el);
    expect(hydrationAction?.getAttribute('aria-label')).to.equal('Remove');

    await el.updateComplete;
    expect(removeButton(el) === hydrationAction).to.be.true;
    expect(removeButton(el)?.getAttribute('aria-label')).to.equal('Remove Alpha');

    el.remove();
    el.innerHTML = '<strong>Beta</strong>';
    container.append(el);
    await el.updateComplete;
    expect(removeButton(el) === hydrationAction).to.be.true;
    expect(removeButton(el)?.getAttribute('aria-label')).to.equal('Remove Beta');
  });

  it('meets the shared minimum hit-area floor on the remove button', async () => {
    const el = (await fixture(html`<lr-tag with-remove size="2xs">x</lr-tag>`)) as LyraTag;
    // Resolve --lr-icon-button-size to real pixels through a probe rather than assuming a 16px
    // root font size, which a user-set browser text size makes wrong.
    const probe = document.createElement('span');
    probe.style.display = 'block';
    probe.style.setProperty('min-inline-size', 'var(--lr-icon-button-size)');
    el.append(probe);
    const floor = parseFloat(getComputedStyle(probe).minInlineSize);
    probe.remove();

    const box = removeButton(el)!.getBoundingClientRect();
    expect(floor).to.be.at.least(24);
    expect(box.width).to.be.at.least(floor);
    expect(box.height).to.be.at.least(floor);
  });

  it('re-derives the remove-button name when the label changes after mount', async () => {
    const el = (await fixture(html`<lr-tag with-remove>before</lr-tag>`)) as LyraTag;
    expect(removeButton(el)?.getAttribute('aria-label')).to.equal('Remove before');

    el.textContent = 'after';
    await waitUntil(
      () => removeButton(el)?.getAttribute('aria-label') === 'Remove after',
      'the remove button name must follow a light-DOM label rewrite',
    );
  });

  it('keeps no label observer alive once disconnected', async () => {
    const host = (await fixture(html`<div><lr-tag with-remove>beta</lr-tag></div>`)) as HTMLElement;
    const tag = host.querySelector('lr-tag') as LyraTag;
    tag.remove();
    expect((tag as unknown as { labelObserver?: MutationObserver }).labelObserver).to.equal(undefined);

    host.append(tag);
    await tag.updateComplete;
    tag.textContent = 'gamma';
    await waitUntil(
      () => removeButton(tag)?.getAttribute('aria-label') === 'Remove gamma',
      'reconnecting must re-arm the label observer',
    );
  });

  it('refreshes the contextual remove label after light DOM changes while disconnected', async () => {
    const host = (await fixture(html`<div><lr-tag with-remove>beta</lr-tag></div>`)) as HTMLElement;
    const tag = host.querySelector('lr-tag') as LyraTag;
    expect(removeButton(tag)?.getAttribute('aria-label')).to.equal('Remove beta');

    tag.remove();
    tag.textContent = 'gamma';
    host.append(tag);
    await tag.updateComplete;

    expect(removeButton(tag)?.getAttribute('aria-label')).to.equal('Remove gamma');
  });

  it('places the remove button at the inline end under both directions', async () => {
    const centerX = (node: Element): number => {
      const box = node.getBoundingClientRect();
      return box.left + box.width / 2;
    };
    const contentOf = (tag: LyraTag): HTMLElement =>
      tag.shadowRoot!.querySelector('[part="content"]') as HTMLElement;

    const ltr = (await fixture(html`<lr-tag with-remove>label</lr-tag>`)) as LyraTag;
    expect(centerX(removeButton(ltr)!)).to.be.greaterThan(centerX(contentOf(ltr)));

    // A physical margin would leave the button stranded on the same physical side here; the flow
    // must mirror instead, so the button ends up on the left of the label under RTL.
    const rtl = (await fixture(html`<div dir="rtl"><lr-tag with-remove>وسم</lr-tag></div>`)) as HTMLElement;
    const rtlTag = rtl.querySelector('lr-tag') as LyraTag;
    expect(centerX(removeButton(rtlTag)!)).to.be.lessThan(centerX(contentOf(rtlTag)));
  });

  it('is accessible while removable', async () => {
    const el = (await fixture(html`<lr-tag with-remove variant="brand">beta</lr-tag>`)) as LyraTag;
    expect(el.shadowRoot!.querySelectorAll('[part~="remove-button"]').length).to.equal(1);
    await expect(el).to.be.accessible();
  });
});

describe('lr-remove', () => {
  it('emits a cancelable, bubbling, composed lr-remove on click', async () => {
    const el = (await fixture(html`<div><lr-tag with-remove>beta</lr-tag></div>`)) as HTMLElement;
    const tag = el.querySelector('lr-tag') as LyraTag;

    const removed = oneEvent(tag, 'lr-remove');
    removeButton(tag)!.click();
    const event = await removed;
    expect(event.cancelable).to.be.true;
    expect(event.bubbles).to.be.true;
    expect(event.composed).to.be.true;
    expect((event.target as HTMLElement).localName).to.equal('lr-tag');
  });

  it('removes the tag from the DOM when the event is not canceled', async () => {
    const host = (await fixture(html`<div><lr-tag with-remove>beta</lr-tag></div>`)) as HTMLElement;
    const tag = host.querySelector('lr-tag') as LyraTag;
    removeButton(tag)!.click();
    expect(host.querySelectorAll('lr-tag').length).to.equal(0);
    expect(tag.isConnected).to.be.false;
  });

  it('keeps the tag in the DOM when a listener calls preventDefault()', async () => {
    const host = (await fixture(html`<div><lr-tag with-remove>beta</lr-tag></div>`)) as HTMLElement;
    const tag = host.querySelector('lr-tag') as LyraTag;
    tag.addEventListener('lr-remove', (event) => event.preventDefault());
    removeButton(tag)!.click();
    expect(host.querySelectorAll('lr-tag').length).to.equal(1);
    expect(tag.isConnected).to.be.true;
  });

  it('fires from keyboard activation of the focused remove button', async () => {
    const host = (await fixture(html`<div><lr-tag with-remove>beta</lr-tag></div>`)) as HTMLElement;
    const tag = host.querySelector('lr-tag') as LyraTag;
    const button = removeButton(tag)!;
    button.focus();
    expect((tag.shadowRoot!.activeElement as HTMLElement | null)?.part.contains('remove-button')).to.be.true;

    let fired = 0;
    tag.addEventListener('lr-remove', (event) => {
      fired += 1;
      event.preventDefault();
    });
    // A native <button> turns Enter/Space into a click; dispatching the resulting click is the
    // faithful stand-in for the key press in a headless run.
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(fired).to.equal(1);
  });

  it('emits nothing while with-remove is unset', async () => {
    const host = (await fixture(html`<div><lr-tag>beta</lr-tag></div>`)) as HTMLElement;
    const tag = host.querySelector('lr-tag') as LyraTag;
    let fired = 0;
    tag.addEventListener('lr-remove', () => (fired += 1));
    tag.click();
    expect(fired).to.equal(0);
    expect(tag.isConnected).to.be.true;
  });
});
