import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './reorder-item.js';
import type { LyraReorderItem } from './reorder-item.class.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

describe('<lr-reorder-item>', () => {
  it('renders slotted content with role="listitem"', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item>Row A</lr-reorder-item>`);
    expect(el.getAttribute('role')).to.equal('listitem');
    expect(el.textContent?.trim()).to.equal('Row A');
  });

  it('defaults to an empty required value and readonly false owner state', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item>Row</lr-reorder-item>`);
    expect(el.value).to.equal('');
    expect(el.disabled).to.be.false;
    expect(el.atStart).to.be.false;
    expect(el.atEnd).to.be.false;
    expect(el.listDisabled).to.be.false;
  });

  it('correlates localized move actions with the row label and honors explicit overrides', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item value="row">Row</lr-reorder-item>`);
    const labelledText = (button: Element): string =>
      (button.getAttribute('aria-labelledby') ?? '')
        .split(/\s+/)
        .map((id) => el.shadowRoot!.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
    let up = el.shadowRoot!.querySelector('[part="move-up-button"]')!;
    let down = el.shadowRoot!.querySelector('[part="move-down-button"]')!;
    expect(labelledText(up)).to.equal('Move up Row');
    expect(labelledText(down)).to.equal('Move down Row');

    el.accessibleLabel = 'Account name';
    el.strings = { moveUp: 'Déplacer vers le haut', moveDown: 'Déplacer vers le bas' };
    await el.updateComplete;
    up = el.shadowRoot!.querySelector('[part="move-up-button"]')!;
    down = el.shadowRoot!.querySelector('[part="move-down-button"]')!;
    expect(labelledText(up)).to.equal('Déplacer vers le haut Account name');
    expect(labelledText(down)).to.equal('Déplacer vers le bas Account name');
  });

  it('emits lr-move-request with the correct direction on click', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item value="row">Row</lr-reorder-item>`);
    const up = el.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    const down = el.shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;

    let listener = oneEvent(el, 'lr-move-request');
    up.click();
    let event = (await listener) as CustomEvent<{ direction: string }>;
    expect(event.detail.direction).to.equal('up');

    listener = oneEvent(el, 'lr-move-request');
    down.click();
    event = (await listener) as CustomEvent<{ direction: string }>;
    expect(event.detail.direction).to.equal('down');
  });

  it('disables both buttons and never emits lr-move-request when disabled', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item disabled>Row</lr-reorder-item>`);
    const up = el.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    const down = el.shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;
    expect(up.disabled).to.be.true;
    expect(down.disabled).to.be.true;

    let emitted = false;
    el.addEventListener('lr-move-request', () => {
      emitted = true;
    });
    up.click();
    down.click();
    expect(emitted).to.be.false;
  });

  it('keeps owner state readonly and disables both actions without a stable identity', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item>Row</lr-reorder-item>`);
    const up = el.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    const down = el.shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;
    expect(up.disabled).to.be.true;
    expect(down.disabled).to.be.true;
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(el),
      'atStart',
    );
    expect(typeof descriptor?.get).to.equal('function');
    expect(descriptor?.set === undefined).to.equal(true);
  });

  // A `role="listitem"` host is only ARIA-valid nested inside a `role="list"` ancestor (the
  // WAI-ARIA required-parent rule) -- <lr-reorder-item> is never used standalone in practice (it's
  // always a child of <lr-reorder-list>, which renders role="list"), so this wraps it the same way
  // <lr-tree-item>'s own accessibility test wraps in role="tree", while still asserting
  // accessibility on the item's own instance.
  it('is accessible, including when disabled', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      html`<div role="list"><lr-reorder-item value="row">Row</lr-reorder-item></div>`,
    );
    const el = wrapper.querySelector('lr-reorder-item') as LyraReorderItem;
    await expect(el).to.be.accessible();

    const disabledWrapper = await fixture<HTMLDivElement>(
      html`<div role="list"><lr-reorder-item value="row" disabled>Row</lr-reorder-item></div>`,
    );
    const disabledEl = disabledWrapper.querySelector('lr-reorder-item') as LyraReorderItem;
    await expect(disabledEl).to.be.accessible();
  });

  it('renders correctly under dir="rtl"', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      html`<div dir="rtl" role="list"><lr-reorder-item value="row">Row</lr-reorder-item></div>`,
    );
    const el = wrapper.querySelector('lr-reorder-item') as LyraReorderItem;
    await expect(el).to.be.accessible();
  });
});

it('contains a long reorder-item label in exact 320px LTR and RTL allocations', async () => {
  for (const direction of ['ltr', 'rtl'] as const) {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir=${direction} role="list" style="inline-size: 320px; max-inline-size: 100%;">
        <lr-reorder-item value=${direction}>InternationalizedReorderItemLabelWithoutAnyNaturalBreakOpportunity</lr-reorder-item>
      </div>
    `);
    const el = wrapper.querySelector('lr-reorder-item') as LyraReorderItem;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector<HTMLElement>("[part='base']")!;
    const content = el.shadowRoot!.querySelector<HTMLElement>("[part='content']")!;

    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth + 1);
    expect(el.scrollWidth).to.be.at.most(el.clientWidth + 1);
    expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
    expect(content.scrollWidth).to.be.at.most(content.clientWidth + 1);
    expect(getComputedStyle(base).direction).to.equal(direction);
  }
});

describe('move-button state cssprops', () => {
  function centreOf(target: HTMLElement): [number, number] {
    const rect = target.getBoundingClientRect();
    return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
  }

  function resolvedInShadow(
    el: LyraReorderItem,
    declaration: string,
    property: string,
  ): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  it('keeps the pre-cssprop hover and active paint when the props are unset', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div role="list"><lr-reorder-item value="row">Row</lr-reorder-item></div>`,
    );
    const el = wrapper.querySelector('lr-reorder-item') as LyraReorderItem;
    const up = el.shadowRoot!.querySelector<HTMLElement>('[part="move-up-button"]')!;
    expect(up.getBoundingClientRect().width, 'the move button has pointer geometry').to.be.greaterThan(0);

    try {
      await sendMouse({ type: 'move', position: centreOf(up) });
      expect(getComputedStyle(up).backgroundColor).to.equal(
        resolvedInShadow(el, 'background: var(--lr-color-brand-quiet)', 'background-color'),
      );
      expect(getComputedStyle(up).color).to.equal(
        resolvedInShadow(el, 'color: var(--lr-color-brand)', 'color'),
      );

      await sendMouse({ type: 'down' });
      await waitUntil(() => up.matches(':active'), 'the physical pointer activates the move button');
      expect(getComputedStyle(up).backgroundColor).to.equal(
        resolvedInShadow(
          el,
          'background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
          'background-color',
        ),
      );
      expect(getComputedStyle(up).color).to.equal(
        resolvedInShadow(el, 'color: var(--lr-color-brand)', 'color'),
      );
    } finally {
      await resetMouse();
    }
  });

  it('inherits independent move-button hover and active paint from an ancestor', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div
        role="list"
        style="
          --lr-reorder-item-move-button-hover-bg: rgb(0, 51, 102);
          --lr-reorder-item-move-button-hover-color: rgb(255, 255, 255);
          --lr-reorder-item-move-button-active-bg: rgb(0, 30, 60);
          --lr-reorder-item-move-button-active-color: rgb(255, 255, 0);
        "
      >
        <lr-reorder-item value="row">Row</lr-reorder-item>
      </div>
    `);
    const el = wrapper.querySelector('lr-reorder-item') as LyraReorderItem;
    const up = el.shadowRoot!.querySelector<HTMLElement>('[part="move-up-button"]')!;
    const down = el.shadowRoot!.querySelector<HTMLElement>('[part="move-down-button"]')!;
    const content = el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
    const contentColor = getComputedStyle(content).color;

    try {
      await sendMouse({ type: 'move', position: centreOf(up) });
      expect(getComputedStyle(up).backgroundColor).to.equal('rgb(0, 51, 102)');
      expect(getComputedStyle(up).color).to.equal('rgb(255, 255, 255)');
      expect(getComputedStyle(content).color, 'the move-button props do not recolor row content').to.equal(
        contentColor,
      );

      await sendMouse({ type: 'move', position: centreOf(down) });
      await sendMouse({ type: 'down' });
      await waitUntil(() => down.matches(':active'), 'the physical pointer activates the second move button');
      expect(getComputedStyle(down).backgroundColor).to.equal('rgb(0, 30, 60)');
      expect(getComputedStyle(down).color).to.equal('rgb(255, 255, 0)');
    } finally {
      await resetMouse();
    }
  });

  it('keeps disabled move buttons flat despite inherited state paint props', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div
        role="list"
        style="
          --lr-reorder-item-move-button-hover-bg: rgb(0, 51, 102);
          --lr-reorder-item-move-button-active-bg: rgb(0, 30, 60);
        "
      >
        <lr-reorder-item value="row" disabled>Row</lr-reorder-item>
      </div>
    `);
    const el = wrapper.querySelector('lr-reorder-item') as LyraReorderItem;
    const up = el.shadowRoot!.querySelector<HTMLElement>('[part="move-up-button"]')!;

    expect(getComputedStyle(up).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(up).color).to.equal(
      resolvedInShadow(el, 'color: var(--lr-color-text-quiet)', 'color'),
    );
    await expect(el).to.be.accessible();
  });
});

describe('ElementInternals availability', () => {
  it('does not throw when constructed in an environment without a real ElementInternals implementation', async () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraReorderItem | undefined;
      expect(() => {
        el = document.createElement('lr-reorder-item') as LyraReorderItem;
      }).to.not.throw();
      document.body.append(el!);
      // Mounting drives updated()'s setCustomState() calls against the fallback ElementInternals'
      // states Set (at-start/at-end/list-disabled/pending/busy/invalid-identity) -- the fallback
      // must keep that wiring usable rather than merely swallowing the constructor error. A
      // synchronous throw inside updated() would reject this promise.
      await el!.updateComplete;
      el!.remove();
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });

  it('falls back to noop internals when attachInternals() throws (e.g. called a second time)', async () => {
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function () {
      throw new DOMException('attachInternals already called', 'InvalidStateError');
    };
    try {
      let el: LyraReorderItem | undefined;
      expect(() => {
        el = document.createElement('lr-reorder-item') as LyraReorderItem;
      }).to.not.throw();
      document.body.append(el!);
      await el!.updateComplete;
      el!.remove();
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});
