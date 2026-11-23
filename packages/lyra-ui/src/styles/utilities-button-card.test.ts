import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import { setReducedMotion } from '../../test/wtr-media.js';
import '../components/lr-button.js';
import '../components/lr-card.js';
import { lyraTokenLayerPending } from '../internal/document-tokens.js';

// The light-DOM .lr-button and .lr-card classes read the same tokens as <lr-button> and <lr-card>,
// so a prerendered link or button can stand in for a hydrated component. Each comparison renders
// both side by side and asserts the computed values of the properties that make the pixels.

await lyraTokenLayerPending();

const links: HTMLLinkElement[] = [];

before(async () => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./utilities.css', import.meta.url).href;
  const loaded = new Promise<void>((resolve, reject) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => reject(new Error('utilities.css failed to load')), { once: true });
  });
  document.head.append(link);
  links.push(link);
  await loaded;
});

after(() => {
  for (const link of links) link.remove();
});

const VARIANTS = ['neutral', 'brand', 'success', 'warning', 'danger'] as const;
const APPEARANCES = ['accent', 'filled', 'outlined', 'filled-outlined', 'plain'] as const;
const SIZES = ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const;

const BUTTON_PROPERTIES = [
  'background-color',
  'color',
  'border-top-color',
  'border-top-width',
  'border-top-left-radius',
  'min-block-size',
  'padding-inline-start',
  'padding-block-start',
  'font-size',
  'font-weight',
  'font-family',
  'box-shadow',
] as const;

function base(host: Element): HTMLElement {
  const part = host.shadowRoot?.querySelector<HTMLElement>('[part~="base"]');
  if (!part) throw new Error(`${host.localName} rendered no base part`);
  return part;
}

function pick(element: Element, properties: readonly string[]): Record<string, string> {
  const style = getComputedStyle(element);
  return Object.fromEntries(properties.map((name) => [name, style.getPropertyValue(name)]));
}

function classesOf(variant: string, appearance: string, size: string): string {
  return `lr-button lr-${variant} lr-${appearance} lr-size-${size}`;
}

/** The background once the background-color transition has finished. */
async function settled(element: Element): Promise<string> {
  let previous = '';
  let current = getComputedStyle(element).backgroundColor;
  while (current !== previous) {
    previous = current;
    await new Promise((resolve) => setTimeout(resolve, 250));
    current = getComputedStyle(element).backgroundColor;
  }
  return current;
}

async function pair(variant: string, appearance: string, size: string, scope = '') {
  const el = await fixture(html`
    <div class=${scope} data-lr-theme=${scope ? 'dark' : 'light'}>
      <lr-button variant=${variant} appearance=${appearance} size=${size}>Go</lr-button>
      <a class=${classesOf(variant, appearance, size)} href="#go">Go</a>
    </div>
  `);
  const component = el.querySelector('lr-button')!;
  await (component as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  return { component: base(component), plain: el.querySelector<HTMLElement>('a')! };
}

describe('.lr-button', () => {
  afterEach(async () => {
    await resetMouse();
  });

  it('matches <lr-button> for every variant and appearance at the default size', async () => {
    const mismatches: string[] = [];
    for (const variant of VARIANTS) {
      for (const appearance of APPEARANCES) {
        const { component, plain } = await pair(variant, appearance, 'm');
        const want = pick(component, BUTTON_PROPERTIES);
        const got = pick(plain, BUTTON_PROPERTIES);
        for (const name of BUTTON_PROPERTIES) {
          if (want[name] !== got[name]) mismatches.push(`${variant}/${appearance} ${name}: ${got[name]} != ${want[name]}`);
        }
      }
    }
    expect(mismatches).to.deep.equal([]);
  });

  it('matches <lr-button> geometry on every size step', async () => {
    const mismatches: string[] = [];
    for (const size of SIZES) {
      const { component, plain } = await pair('brand', 'accent', size);
      const want = pick(component, BUTTON_PROPERTIES);
      const got = pick(plain, BUTTON_PROPERTIES);
      for (const name of BUTTON_PROPERTIES) {
        if (want[name] !== got[name]) mismatches.push(`${size} ${name}: ${got[name]} != ${want[name]}`);
      }
      const heights = [component, plain].map((node) => Math.round(node.getBoundingClientRect().height));
      if (heights[0] !== heights[1]) mismatches.push(`${size} height: ${heights[1]} != ${heights[0]}`);
    }
    expect(mismatches).to.deep.equal([]);
  });

  it('defaults to the neutral accent button at the m step, like <lr-button>', async () => {
    const el = await fixture(html`
      <div>
        <lr-button>Go</lr-button>
        <button class="lr-button" type="button">Go</button>
      </div>
    `);
    await (el.querySelector('lr-button') as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    expect(pick(el.querySelector('button')!, BUTTON_PROPERTIES)).to.deep.equal(pick(base(el.querySelector('lr-button')!), BUTTON_PROPERTIES));
  });

  it('matches <lr-button> inside a dark theme scope', async () => {
    for (const [variant, appearance] of [['brand', 'accent'], ['neutral', 'outlined'], ['danger', 'filled']] as const) {
      const { component, plain } = await pair(variant, appearance, 'm', 'lr-dark');
      expect(pick(plain, BUTTON_PROPERTIES), `${variant}/${appearance}`).to.deep.equal(pick(component, BUTTON_PROPERTIES));
    }
  });

  it('takes the hover fill <lr-button> takes', async () => {
    const { component, plain } = await pair('brand', 'accent', 'm');
    const rest = getComputedStyle(plain).backgroundColor;
    await hoverUntilMatched(component, 'pointer never reached the component');
    await waitUntil(() => getComputedStyle(component).backgroundColor !== rest, 'component hover fill never applied');
    const want = await settled(component);
    await hoverUntilMatched(plain, 'pointer never reached the link');
    await waitUntil(() => getComputedStyle(plain).backgroundColor === want, `link hover fill ${getComputedStyle(plain).backgroundColor} != ${want}`);
  });

  it('presses with the shared scale and stops scaling under reduced motion', async () => {
    const { plain } = await pair('brand', 'accent', 'm');
    plain.addEventListener('click', (event) => event.preventDefault());
    try {
      await hoverUntilMatched(plain, 'pointer never reached the link');
      await sendMouse({ type: 'down' });
      await waitUntil(() => getComputedStyle(plain).transform !== 'none', 'press never scaled the link');
      await sendMouse({ type: 'up' });
      let reduced = false;
      try {
        await setReducedMotion('reduce');
        await waitUntil(() => matchMedia('(prefers-reduced-motion: reduce)').matches, 'reduce never matched', { timeout: 1000 });
        reduced = true;
      } catch {
        // An engine without reduced-motion emulation keeps only the first assertion.
      }
      if (reduced) {
        await hoverUntilMatched(plain, 'pointer never reached the link');
        await sendMouse({ type: 'down' });
        await waitUntil(() => plain.matches(':active'), 'press never activated the link');
        expect(getComputedStyle(plain).transform).to.equal('none');
        await sendMouse({ type: 'up' });
      }
    } finally {
      await setReducedMotion('no-preference').catch(() => undefined);
    }
  });

  it('shows the shared focus ring on keyboard focus', async () => {
    const { plain } = await pair('brand', 'accent', 'm');
    await focusByKeyboard(plain);
    await waitUntil(() => plain.matches(':focus-visible'), 'link never matched :focus-visible');
    const style = getComputedStyle(plain);
    expect(style.outlineStyle).to.equal('solid');
    expect(parseFloat(style.outlineWidth)).to.be.at.least(2);
    expect(parseFloat(style.outlineOffset)).to.be.at.least(0);
  });

  it('dims disabled buttons and aria-disabled links, and gives them no pointer feedback', async () => {
    const el = await fixture(html`
      <div>
        <lr-button variant="brand" disabled>Go</lr-button>
        <button class="lr-button lr-brand" type="button" disabled>Go</button>
        <a class="lr-button lr-brand" aria-disabled="true">Go</a>
      </div>
    `);
    await (el.querySelector('lr-button') as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const want = getComputedStyle(base(el.querySelector('lr-button')!)).opacity;
    expect(Number(want)).to.be.lessThan(1);
    for (const node of [el.querySelector<HTMLElement>('button')!, el.querySelector<HTMLElement>('a')!]) {
      const rest = getComputedStyle(node).backgroundColor;
      expect(getComputedStyle(node).opacity).to.equal(want);
      expect(getComputedStyle(node).cursor).to.equal('not-allowed');
      await hoverUntilMatched(node, `pointer never reached the ${node.localName}`);
      await settlePointer();
      expect(getComputedStyle(node).backgroundColor).to.equal(rest);
    }
  });

  it('never leaves a short label narrower than its block size', async () => {
    const el = await fixture(html`<a class="lr-button lr-size-m" href="#x">X</a>`);
    const rect = el.getBoundingClientRect();
    expect(Math.round(rect.width)).to.be.at.least(Math.round(rect.height));
  });

  it('lets a public --lr-button-* token retune it as it retunes <lr-button>', async () => {
    const el = await fixture(html`
      <div style="--lr-button-accent-fill: rgb(10, 20, 30); --lr-button-radius: 7px">
        <lr-button variant="brand">Go</lr-button>
        <a class="lr-button lr-brand" href="#go">Go</a>
      </div>
    `);
    await (el.querySelector('lr-button') as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const style = getComputedStyle(el.querySelector('a')!);
    expect(style.backgroundColor).to.equal('rgb(10, 20, 30)');
    expect(style.borderTopLeftRadius).to.equal('7px');
    expect(getComputedStyle(base(el.querySelector('lr-button')!)).backgroundColor).to.equal('rgb(10, 20, 30)');
  });

  it('keeps the radius and case utilities applicable on top', async () => {
    const el = await fixture(html`<a class="lr-button lr-radius-pill lr-uppercase" href="#x">Go</a>`);
    expect(getComputedStyle(el).textTransform).to.equal('uppercase');
    expect(parseFloat(getComputedStyle(el).borderTopLeftRadius)).to.be.greaterThan(100);
  });

  it('leaves elements without the class untouched', async () => {
    const el = await fixture(html`<a class="lr-brand lr-outlined" href="#x">Go</a>`);
    expect(getComputedStyle(el).display).to.equal('inline');
    expect(getComputedStyle(el).borderTopStyle).to.equal('none');
  });
});

const CARD_BASE_PROPERTIES = [
  'background-color',
  'border-top-color',
  'border-top-width',
  'border-top-left-radius',
  'box-shadow',
  'font-family',
] as const;

async function cardPair(appearance: string | null, dir = 'ltr') {
  const el = await fixture(html`
    <div dir=${dir}>
      <lr-card appearance=${appearance ?? 'outlined'}>Body</lr-card>
      <div class=${`lr-card${appearance ? ` lr-${appearance}` : ''}`}>Body</div>
    </div>
  `);
  const card = el.querySelector('lr-card')!;
  await (card as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  const body = card.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  return { component: base(card), body, plain: el.querySelector<HTMLElement>('div.lr-card')! };
}

describe('.lr-card', () => {
  afterEach(async () => {
    await resetMouse();
  });

  it('matches <lr-card> surface and body padding for every appearance', async () => {
    const mismatches: string[] = [];
    for (const appearance of [null, ...APPEARANCES]) {
      const { component, body, plain } = await cardPair(appearance);
      const want = pick(component, [...CARD_BASE_PROPERTIES, 'border-inline-start-width', 'border-inline-start-color']);
      const got = pick(plain, [...CARD_BASE_PROPERTIES, 'border-inline-start-width', 'border-inline-start-color']);
      for (const name of Object.keys(want)) {
        if (want[name] !== got[name]) mismatches.push(`${appearance ?? 'default'} ${name}: ${got[name]} != ${want[name]}`);
      }
      const padding = getComputedStyle(body).paddingInlineStart;
      if (getComputedStyle(plain).paddingInlineStart !== padding) mismatches.push(`${appearance ?? 'default'} padding`);
    }
    expect(mismatches).to.deep.equal([]);
  });

  it('draws the accent stripe on the inline start edge under RTL', async () => {
    const { component, plain } = await cardPair('accent', 'rtl');
    const style = getComputedStyle(plain);
    expect(style.borderRightWidth).to.equal(getComputedStyle(component).borderRightWidth);
    expect(parseFloat(style.borderRightWidth)).to.be.greaterThan(parseFloat(style.borderLeftWidth));
  });

  it('gives a linked card the actionable edge, hover border and inset focus ring', async () => {
    const el = await fixture(html`
      <div>
        <lr-card href="#card">Body</lr-card>
        <a class="lr-card" href="#card">Body</a>
      </div>
    `);
    const card = el.querySelector('lr-card')!;
    await (card as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const component = base(card);
    const link = el.querySelector<HTMLElement>('a.lr-card')!;
    link.addEventListener('click', (event) => event.preventDefault());
    expect(getComputedStyle(link).borderTopColor).to.equal(getComputedStyle(component).borderTopColor);
    expect(getComputedStyle(link).cursor).to.equal('pointer');
    const rest = getComputedStyle(link).borderTopColor;
    await hoverUntilMatched(link, 'pointer never reached the linked card');
    await waitUntil(() => getComputedStyle(link).borderTopColor !== rest, 'hover border never applied');
    await resetMouse();
    await focusByKeyboard(link);
    await waitUntil(() => link.matches(':focus-visible'), 'linked card never matched :focus-visible');
    expect(getComputedStyle(link).outlineStyle).to.equal('solid');
    expect(parseFloat(getComputedStyle(link).outlineOffset)).to.be.lessThan(0);
  });

  it('dims an aria-disabled linked card', async () => {
    const el = await fixture(html`<a class="lr-card" aria-disabled="true">Body</a>`);
    expect(Number(getComputedStyle(el).opacity)).to.be.lessThan(1);
    expect(getComputedStyle(el).cursor).to.equal('not-allowed');
  });
});
