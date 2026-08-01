import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './radio-button.js';
import './radio.js';
import './radio-group.js';

it('renders button chrome with the radio role and encodes checked state in the part name', async () => {
  const el = await fixture(html`<lr-radio-button value="a" checked>Alpha</lr-radio-button>`);
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('radio');
  expect(base.getAttribute('aria-checked')).to.equal('true');
  // `::part(base)[aria-checked]` never matches, so state has to live in the part name itself.
  expect(base.getAttribute('part')!.split(/\s+/)).to.include('checked');
  await expect(el).to.be.accessible();
});

it('renders aria-checked="false" rather than omitting it when unchecked', async () => {
  const el = await fixture(html`<lr-radio-button value="a">Alpha</lr-radio-button>`);
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('aria-checked')).to.equal('false');
  expect(base.getAttribute('part')!.split(/\s+/)).to.not.include('checked');
});

it('participates in a radio group alongside a plain radio', async () => {
  const group = await fixture(html`
    <lr-radio-group name="plan" label="Plan">
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
    <lr-radio-group name="plan" label="Plan">
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
