import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './radio-button.js';
import './radio.js';
import './radio-group.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('themes the button-content gap for both button authoring paths', async () => {
  for (const markup of [
    html`<lr-radio-button style="--lr-radio-button-gap: 13px">Label</lr-radio-button>`,
    html`<lr-radio appearance="button" style="--lr-radio-button-gap: 13px">Label</lr-radio>`,
  ]) {
    const el = await fixture(markup);
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    expect(getComputedStyle(base).columnGap).to.equal('13px');
  }
});

it('projects canonical and Shoelace adornment aliases through shared parts', async () => {
  const el = await fixture(html`
    <lr-radio-button value="a">
      <span id="start" slot="start">Start</span>
      <span id="prefix" slot="prefix">Prefix</span>
      Alpha
      <span id="end" slot="end">End</span>
      <span id="suffix" slot="suffix">Suffix</span>
    </lr-radio-button>
  `);
  const root = el.shadowRoot!;
  const startWrappers = root.querySelectorAll<HTMLElement>('[part~="start"][part~="prefix"]');
  const endWrappers = root.querySelectorAll<HTMLElement>('[part~="end"][part~="suffix"]');

  expect(startWrappers.length).to.equal(1);
  expect(endWrappers.length).to.equal(1);

  const start = startWrappers[0]!;
  const end = endWrappers[0]!;
  const startSlot = start.querySelector<HTMLSlotElement>('slot[name="start"]')!;
  const prefixSlot = start.querySelector<HTMLSlotElement>('slot[name="prefix"]')!;
  const endSlot = end.querySelector<HTMLSlotElement>('slot[name="end"]')!;
  const suffixSlot = end.querySelector<HTMLSlotElement>('slot[name="suffix"]')!;

  expect(startSlot.assignedElements().map((element) => element.id)).to.deep.equal(['start']);
  expect(prefixSlot.assignedElements().map((element) => element.id)).to.deep.equal(['prefix']);
  expect(endSlot.assignedElements().map((element) => element.id)).to.deep.equal(['end']);
  expect(suffixSlot.assignedElements().map((element) => element.id)).to.deep.equal(['suffix']);
  expect(getComputedStyle(start).maxInlineSize).to.equal('40%');
  expect(getComputedStyle(end).maxInlineSize).to.equal('40%');
});

it('contains a standalone unbroken button label at 320px in LTR and RTL', async () => {
  const label = 'InternationalizedStandaloneRadioButtonLabelWithoutAnyNaturalBreakOpportunity';
  for (const direction of ['ltr', 'rtl'] as const) {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 320px">
        <lr-radio-button value="choice">${label}</lr-radio-button>
      </div>
    `);
    const radio = wrapper.querySelector('lr-radio-button')!;
    expect(wrapper.scrollWidth, `dir=${direction} wrapper`).to.be.at.most(wrapper.clientWidth);
    expect(radio.getBoundingClientRect().width, `dir=${direction} host`).to.be.at.most(
      wrapper.getBoundingClientRect().width,
    );
  }
});

it('renders button chrome with the radio role and encodes checked state in the part name', async () => {
  const el = await fixture(html`<lr-radio-button value="a" checked>Alpha</lr-radio-button>`);
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('radio');
  expect(base.getAttribute('aria-checked')).to.equal('true');
  // `::part(base)[aria-checked]` never matches, so state has to live in the part name itself.
  expect(base.getAttribute('part')!.split(/\s+/)).to.include('checked');
  expect(base.getAttribute('part')!.split(/\s+/)).to.include.members(['button', 'button--checked']);
  await expect(el).to.be.accessible();
});

it('renders aria-checked="false" rather than omitting it when unchecked', async () => {
  const el = await fixture(html`<lr-radio-button value="a">Alpha</lr-radio-button>`);
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('aria-checked')).to.equal('false');
  expect(base.getAttribute('part')!.split(/\s+/)).to.not.include('checked');
});

it('preserves an explicitly empty host aria-label on the internal radio owner', async () => {
  const el = await fixture(html`<lr-radio-button aria-label="">Visible label</lr-radio-button>`);
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-label')).to.equal(true);
  expect(base.getAttribute('aria-label')).to.equal('');
});

it('participates in a radio group alongside a plain radio', async () => {
  const group = await fixture(html`
    <lr-radio-group name="plan" label="Plan" orientation="horizontal">
      <lr-radio-button value="free">Free</lr-radio-button>
      <lr-radio-button value="pro">Pro</lr-radio-button>
      <lr-radio value="team">Team</lr-radio>
    </lr-radio-group>
  `);
  await group.updateComplete;
  const pro = group.querySelector('lr-radio-button[value="pro"]') as HTMLElement & { checked: boolean };
  const listener = oneEvent(group, 'lr-change');
  pro.click();
  const event = await listener;
  expect(event.detail.value).to.equal('pro');
  expect(pro.checked).to.equal(true);
  // Selecting one clears the rest, including the plain `<lr-radio>` sharing the group.
  const others = [...group.querySelectorAll('lr-radio-button, lr-radio')]
    .filter((radio) => radio !== pro) as (Element & { checked: boolean })[];
  expect(others.every((radio) => radio.checked === false)).to.equal(true);
});

it('submits its value through the ancestor form', async () => {
  const form = await fixture(html`
    <form>
      <lr-radio-group name="plan" label="Plan">
        <lr-radio-button value="free">Free</lr-radio-button>
        <lr-radio-button value="pro" checked>Pro</lr-radio-button>
      </lr-radio-group>
    </form>
  `) as HTMLFormElement;
  await (form.querySelector('lr-radio-group') as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect(new FormData(form).get('plan')).to.equal('pro');
});

it('selects on Space from the keyboard', async () => {
  const el = await fixture(html`<lr-radio-button value="a">Alpha</lr-radio-button>`) as HTMLElement & { checked: boolean };
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const changed = oneEvent(el, 'change');
  base.focus();
  base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true, cancelable: true }));
  await changed;
  expect(el.checked).to.equal(true);
});

it('moves selection with the arrow keys inside a group', async () => {
  const group = await fixture(html`
    <lr-radio-group name="plan" label="Plan" orientation="horizontal">
      <lr-radio-button value="free" checked>Free</lr-radio-button>
      <lr-radio-button value="pro">Pro</lr-radio-button>
    </lr-radio-group>
  `);
  await group.updateComplete;
  const free = group.querySelector('lr-radio-button[value="free"]') as HTMLElement;
  const pro = group.querySelector('lr-radio-button[value="pro"]') as HTMLElement & { checked: boolean };
  const changed = oneEvent(group, 'lr-change');
  free.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
  await changed;
  expect(pro.checked).to.equal(true);
});

it('ignores Space while disabled', async () => {
  const el = await fixture(html`<lr-radio-button value="a" disabled>Alpha</lr-radio-button>`) as HTMLElement & { checked: boolean };
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true, cancelable: true }));
  await el.updateComplete;
  expect(el.checked).to.equal(false);
});

it('is not a keyboard stop while disabled', async () => {
  const el = await fixture(html`<lr-radio-button value="a" disabled>Alpha</lr-radio-button>`);
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('tabindex')).to.equal('-1');
  expect(base.getAttribute('part')!.split(/\s+/)).to.include('disabled');
});

describe('size and pill', () => {
  async function baseOf(markup: unknown): Promise<HTMLElement> {
    const el = (await fixture(markup as never)) as HTMLElement & { updateComplete: Promise<unknown> };
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  }

  it('grows the rendered button from size="s" to size="l"', async () => {
    const small = (await baseOf(html`<lr-radio-button size="s" value="a">Alpha</lr-radio-button>`)).getBoundingClientRect();
    const large = (await baseOf(html`<lr-radio-button size="l" value="a">Alpha</lr-radio-button>`)).getBoundingClientRect();
    expect(large.height).to.be.greaterThan(small.height);
    expect(large.width).to.be.greaterThan(small.width);
  });

  it('accepts the Web Awesome size spellings', async () => {
    const s = (await baseOf(html`<lr-radio-button size="s" value="a">Alpha</lr-radio-button>`)).getBoundingClientRect();
    const small = (await baseOf(html`<lr-radio-button size="small" value="a">Alpha</lr-radio-button>`)).getBoundingClientRect();
    expect(small.height).to.be.closeTo(s.height, 0.5);
  });

  it('keeps every tier at or above the WCAG 2.5.8 24px target height', async () => {
    for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const) {
      const base = await baseOf(html`<lr-radio-button size=${size} value="a">A</lr-radio-button>`);
      expect(base.getBoundingClientRect().height, `${size} height`).to.be.at.least(24);
    }
  });

  it('rounds the outer corners into a pill when pill is set', async () => {
    const plain = await baseOf(html`<lr-radio-button value="a">Alpha</lr-radio-button>`);
    const pill = await baseOf(html`<lr-radio-button pill value="a">Alpha</lr-radio-button>`);
    const plainRadius = Number.parseFloat(getComputedStyle(plain).borderStartStartRadius);
    const pillRadius = Number.parseFloat(getComputedStyle(pill).borderStartStartRadius);
    expect(pillRadius).to.be.greaterThan(plainRadius);
    expect(pillRadius).to.be.at.least(pill.getBoundingClientRect().height / 2);
  });

  it('is accessible as a pill at a non-default tier', async () => {
    const el = await fixture(html`<lr-radio-button pill size="l" value="a">Alpha</lr-radio-button>`);
    await expect(el).to.be.accessible();
  });
});

describe('lr-radio-button hover and press feedback', () => {
  const centerOf = (node: Element): [number, number] => {
    const rect = node.getBoundingClientRect();
    return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
  };

  // Both pairs shipped with an :active rule byte-identical to their :hover one, which is a pressed
  // state only on paper. Rendered results, because identical rules read identically in the source.
  // --lr-transition-fast is zeroed on each fixture: the base transitions its background, so reading
  // getComputedStyle one frame after the pointer arrives would otherwise catch the INTERPOLATED
  // colour -- still the resting one at t=0 -- and report "hover does nothing" for a working hover.
  for (const [label, markup] of [
    ['unchecked', html`<lr-radio-button value="a" style="--lr-transition-fast: 0s">Alpha</lr-radio-button>`],
    ['checked', html`<lr-radio-button value="a" checked style="--lr-transition-fast: 0s">Alpha</lr-radio-button>`],
  ] as const) {
    it(`presses a ${label} segment to a background different from its hover`, async () => {
      const el = await fixture(markup);
      const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
      const resting = getComputedStyle(base).backgroundColor;
      try {
        await sendMouse({ type: 'move', position: centerOf(base) });
        const hovered = getComputedStyle(base).backgroundColor;
        expect(hovered, `${label} hover vs resting`).to.not.equal(resting);
        await sendMouse({ type: 'down' });
        expect(getComputedStyle(base).backgroundColor, `${label} pressed vs hovered`).to.not.equal(
          hovered,
        );
      } finally {
        await sendMouse({ type: 'up' });
        await resetMouse();
      }
    });
  }

  it('themes unchecked and checked pointer-state longhands independently', async () => {
    const unchecked = await fixture(html`
      <lr-radio-button
        style="
          --lr-transition-fast: 0s;
          --lr-radio-button-hover-bg: rgb(1, 2, 3);
          --lr-radio-button-hover-border-color: rgb(4, 5, 6);
          --lr-radio-button-active-bg: rgb(7, 8, 9);
          --lr-radio-button-active-border-color: rgb(10, 11, 12);
        "
      >Unchecked</lr-radio-button>
    `);
    const uncheckedBase = unchecked.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    try {
      await sendMouse({ type: 'move', position: centerOf(uncheckedBase) });
      expect(getComputedStyle(uncheckedBase).backgroundColor).to.equal('rgb(1, 2, 3)');
      expect(getComputedStyle(uncheckedBase).borderTopColor).to.equal('rgb(4, 5, 6)');
      await sendMouse({ type: 'down' });
      expect(getComputedStyle(uncheckedBase).backgroundColor).to.equal('rgb(7, 8, 9)');
      expect(getComputedStyle(uncheckedBase).borderTopColor).to.equal('rgb(10, 11, 12)');
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }

    const checked = await fixture(html`
      <lr-radio-button
        checked
        style="
          --lr-transition-fast: 0s;
          --lr-radio-button-checked-bg: rgb(13, 14, 15);
          --lr-radio-button-checked-border-color: rgb(16, 17, 18);
          --lr-radio-button-checked-color: rgb(19, 20, 21);
          --lr-radio-button-checked-hover-bg: rgb(22, 23, 24);
          --lr-radio-button-checked-active-bg: rgb(25, 26, 27);
        "
      >Checked</lr-radio-button>
    `);
    const checkedBase = checked.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    expect(getComputedStyle(checkedBase).backgroundColor).to.equal('rgb(13, 14, 15)');
    expect(getComputedStyle(checkedBase).borderTopColor).to.equal('rgb(16, 17, 18)');
    expect(getComputedStyle(checkedBase).color).to.equal('rgb(19, 20, 21)');
    try {
      await sendMouse({ type: 'move', position: centerOf(checkedBase) });
      expect(getComputedStyle(checkedBase).backgroundColor).to.equal('rgb(22, 23, 24)');
      await sendMouse({ type: 'down' });
      expect(getComputedStyle(checkedBase).backgroundColor).to.equal('rgb(25, 26, 27)');
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });
});
