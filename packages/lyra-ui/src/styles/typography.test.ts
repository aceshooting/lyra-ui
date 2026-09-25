import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { TemplateResult } from 'lit';

import { setForcedColors } from '../../test/wtr-media.js';

import '../components/layout/card/card.js';

// The documented consumer order: a layered reset (Tailwind's theme/base) sorts BEFORE Lyra's layers
// and docs-authoring utilities after lr-utilities. WTR gives every test file a fresh page, so this
// statement is the first one the document sees and fixes the order for everything loaded later.
const CONSUMER_LAYER_ORDER =
  '@layer theme, base, lr-base, lr-theme, lr-theme-preset, components, lr-utilities, utilities, lr-overrides;';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const LONG_WORD = 'InternationalQuarterlyAnalyticalEngineResearchWithoutConvenientBreakpoints';

const injected: Element[] = [];

async function loadStylesheet(name: 'native.css' | 'utilities.css'): Promise<HTMLLinkElement> {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL(`./${name}`, import.meta.url).href;
  const settled = new Promise<void>((resolve, reject) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => reject(new Error(`Failed to load ${name}`)), { once: true });
  });
  document.head.append(link);
  injected.push(link);
  await settled;
  return link;
}

let themeSheetPromise: Promise<CSSStyleSheet> | undefined;

function themeSheet(): Promise<CSSStyleSheet> {
  themeSheetPromise ??= fetch(new URL('../theme.css', import.meta.url))
    .then((response) => response.text())
    .then((source) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(source);
      return sheet;
    });
  return themeSheetPromise;
}

/** Runs `body` with the production theme adopted, restoring the previous adopted sheets after. */
async function withTheme(body: () => Promise<void>): Promise<void> {
  const previous = document.adoptedStyleSheets;
  document.adoptedStyleSheets = [...previous, await themeSheet()];
  try {
    await body();
  } finally {
    document.adoptedStyleSheets = previous;
  }
}

function pick<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (found === null) throw new Error(`fixture is missing ${selector}`);
  return found;
}

const style = (root: ParentNode, selector: string): CSSStyleDeclaration =>
  getComputedStyle(pick(root, selector));

/** Splits a selector list at its top-level commas (commas inside :where()/:not() stay put). */
function selectorArms(selectorText: string): string[] {
  const arms: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of selectorText) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      arms.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  arms.push(current.trim());
  return arms;
}

async function utilitiesLayerRules(): Promise<CSSStyleRule[]> {
  const source = await fetch(new URL('./utilities.css', import.meta.url)).then((response) => response.text());
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(source);
  const layer = [...sheet.cssRules].find(
    (rule): rule is CSSLayerBlockRule => rule instanceof CSSLayerBlockRule && rule.name === 'lr-utilities',
  );
  if (layer === undefined) throw new Error('utilities.css has no lr-utilities layer block');
  return [...layer.cssRules].filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule);
}

/** The shared populated fixture; ids carry a prefix so several copies can share one document. */
function specimen(prefix: string): TemplateResult {
  return html`
    <article class="lr-prose lr-typography" aria-labelledby="${prefix}-title">
      <h1 id="${prefix}-title">Field notes from the orchard survey</h1>
      <p class="lr-text-xl lr-text-quiet">A season of measurements, summarised for the planning group.</p>
      <p>
        Readings were logged with <code>survey-cli</code> and cross-checked against the
        <a href="#${prefix}-table">summary table</a>. The raw export lives under
        <a href="#${prefix}-title"><code>exports/2026</code></a>.
      </p>
      <h2>Method</h2>
      <blockquote>Measure the same trees at the same hour, every week, whatever the weather.</blockquote>
      <ul>
        <li>Soil moisture at two depths</li>
        <li>
          Canopy temperature
          <ul>
            <li>Morning reading</li>
          </ul>
        </li>
      </ul>
      <ol>
        <li>Calibrate the probes</li>
        <li>Record the readings</li>
      </ol>
      <hr />
      <h3>Results</h3>
      <div class="lr-overflow-auto" role="region" aria-labelledby="${prefix}-caption" tabindex="0">
        <table id="${prefix}-table">
          <caption id="${prefix}-caption">Weekly averages per plot</caption>
          <thead>
            <tr>
              <th scope="col">Plot</th>
              <th scope="col">Moisture</th>
              <th scope="col">Temperature</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">North</th>
              <td>31%</td>
              <td>18 C</td>
            </tr>
            <tr>
              <th scope="row">South</th>
              <td>27%</td>
              <td>21 C</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h4>Notes</h4>
      <p class="lr-text-lg lr-font-semibold">Irrigation stays on the current schedule.</p>
      <p class="lr-text-sm lr-font-medium">Next review in four weeks.</p>
      <p class="lr-text-sm lr-text-quiet">Figures are rounded to the nearest unit.</p>
    </article>
  `;
}

before(async () => {
  const order = document.createElement('style');
  order.textContent = CONSUMER_LAYER_ORDER;
  document.head.append(order);
  injected.push(order);
  await loadStylesheet('native.css');
  await loadStylesheet('utilities.css');
});

after(() => {
  for (const node of injected.splice(0)) node.remove();
});

describe('typography role classes', () => {
  it('gives any element a heading level look', async () => {
    const el = await fixture(html`
      <div>
        <p id="r1" class="lr-heading-1">One</p>
        <p id="r2" class="lr-heading-2">Two</p>
        <p id="r3" class="lr-heading-3">Three</p>
        <p id="r4" class="lr-heading-4">Four</p>
      </div>
    `);
    const expected = [
      ['#r1', '32px', '700'],
      ['#r2', '28px', '600'],
      ['#r3', '20px', '600'],
      ['#r4', '18px', '600'],
    ] as const;
    for (const [selector, size, weight] of expected) {
      expect(style(el, selector).fontSize, `${selector} size`).to.equal(size);
      expect(style(el, selector).fontWeight, `${selector} weight`).to.equal(weight);
    }
    expect(style(el, '#r1').lineHeight).to.equal('40px');
    if (CSS.supports('text-wrap-style', 'balance')) {
      expect(style(el, '#r1').getPropertyValue('text-wrap-style')).to.equal('balance');
    }
  });

  it('draws the heading-2 rule under its padding', async () => {
    const el = await fixture(html`<p class="lr-heading-2">Section</p>`);
    const computed = getComputedStyle(el);
    expect(computed.borderBottomWidth).to.equal('1px');
    expect(computed.borderBottomStyle).to.equal('solid');
    expect(computed.paddingBottom).to.equal('8px');
  });

  it('never sets an outer margin from a role class, and hover only thickens the link underline', async () => {
    const rules = await utilitiesLayerRules();
    const roleRules = rules.filter((rule) =>
      selectorArms(rule.selectorText).some(
        (arm) => /^:where\(\.lr-(heading-[1-4]|inline-code)/.test(arm) || /^:where\(a\) :where\(\.lr-inline-code/.test(arm),
      ),
    );
    expect(roleRules.length, 'role rules found').to.be.greaterThan(5);
    for (const rule of roleRules) {
      const margins = [...rule.style].filter((property) => property.startsWith('margin'));
      expect(margins, rule.selectorText).to.deep.equal([]);
    }

    const hoverRules = rules.filter((rule) => rule.selectorText.includes('a[href]') && rule.selectorText.includes(':hover'));
    expect(hoverRules.length, 'one link hover rule').to.equal(1);
    expect([...hoverRules[0]!.style]).to.deep.equal(['text-decoration-thickness']);

    const el = await fixture(html`<div><h2 class="lr-heading-4">Outside any scope</h2></div>`);
    expect(style(el, 'h2').marginBlockStart).to.not.equal('0px');
  });

  it('reads heading tracking from the hook, then the theme input, then normal', async () => {
    const el = await fixture(html`
      <div>
        <p id="unset" class="lr-heading-2">Unset</p>
        <div id="input" style="--lr-theme-heading-letter-spacing: -0.4px">
          <p class="lr-heading-2">Role</p>
          <div class="lr-typography"><h3>Scope</h3></div>
        </div>
        <div
          id="hook"
          style="--lr-theme-heading-letter-spacing: -0.4px; --lr-heading-letter-spacing: -0.5px"
        >
          <p class="lr-heading-2">Role</p>
          <div class="lr-typography"><h3>Scope</h3></div>
        </div>
      </div>
    `);
    expect(style(el, '#unset').letterSpacing).to.equal('normal');
    expect(style(el, '#input > p').letterSpacing).to.equal('-0.4px');
    expect(style(el, '#input h3').letterSpacing).to.equal('-0.4px');
    expect(style(el, '#hook > p').letterSpacing).to.equal('-0.5px');
    expect(style(el, '#hook h3').letterSpacing).to.equal('-0.5px');
  });
});

describe('typography scope', () => {
  it('sizes bare headings and lets them inherit colour', async () => {
    const el = await fixture(html`
      <div class="lr-typography" style="color: rgb(1, 2, 3)">
        <h1>One</h1>
        <h2>Two</h2>
        <h3>Three</h3>
        <h4>Four</h4>
        <h5>Five</h5>
        <h6>Six</h6>
      </div>
    `);
    const sizes = ['32px', '28px', '20px', '18px', '16px', '13px'];
    sizes.forEach((size, index) => {
      expect(style(el, `h${index + 1}`).fontSize, `h${index + 1}`).to.equal(size);
    });
    expect(style(el, 'h1').fontWeight).to.equal('700');
    expect(style(el, 'h2').color).to.equal(getComputedStyle(el).color);
  });

  it('sets paragraph leading and wraps long words in text blocks', async () => {
    const el = await fixture(html`
      <div class="lr-typography">
        <p id="p" style="inline-size: 100px">${LONG_WORD}</p>
        <ul>
          <li id="li" style="inline-size: 100px">${LONG_WORD}</li>
        </ul>
        <blockquote id="bq" style="inline-size: 100px">${LONG_WORD}</blockquote>
        <h2 id="h2" style="inline-size: 100px">${LONG_WORD}</h2>
      </div>
    `);
    expect(style(el, '#p').lineHeight).to.equal('25.6px');
    for (const selector of ['#p', '#li', '#bq', '#h2']) {
      const block = pick(el, selector);
      expect(block.scrollWidth, selector).to.be.at.most(block.clientWidth);
    }
  });

  it('spaces every direct child and doubles the space before headings', async () => {
    const el = await fixture(html`
      <div class="lr-typography">
        <p id="first">First</p>
        <p id="second">Second</p>
        <div id="wrap" class="lr-overflow-auto">
          <table>
            <tbody>
              <tr><td>Cell</td></tr>
            </tbody>
          </table>
        </div>
        <p id="after-wrap">After the wrapper</p>
        <hr id="rule" />
        <p id="after-rule">After the rule</p>
        <h2 id="h2-after-p">Heading</h2>
        <div id="plain">Plain block</div>
        <h2 id="h2-after-div">Heading</h2>
      </div>
    `);
    expect(style(el, '#first').marginBlockStart).to.equal('0px');
    expect(style(el, '#first').marginBlockEnd).to.equal('0px');
    for (const selector of ['#second', '#wrap', '#after-wrap', '#rule', '#after-rule']) {
      expect(style(el, selector).marginBlockStart, selector).to.equal('16px');
    }
    expect(style(el, '#h2-after-p').marginBlockStart).to.equal('32px');
    expect(style(el, '#h2-after-div').marginBlockStart).to.equal('32px');

    (el as HTMLElement).style.setProperty('--lr-prose-flow-space', '17px');
    expect(style(el, '#second').marginBlockStart).to.equal('17px');
    expect(style(el, '#h2-after-p').marginBlockStart).to.equal('34px');
  });

  it('leaves named-slot direct children of a scope host out of the flow', async () => {
    const el = await fixture(html`
      <div>
        <div id="host" class="lr-typography" style="--lr-prose-flow-space: 17px">
          <h3 id="slot-first" slot="header">Header chrome</h3>
          <p id="body">Body</p>
          <h2 id="slot-heading" slot="aside">Aside chrome</h2>
          <p id="slot-p" slot="footer">Footer chrome</p>
        </div>
        <h3 id="bare-h3">Bare</h3>
        <h2 id="bare-h2">Bare</h2>
        <p id="bare-p">Bare</p>
      </div>
    `);
    expect(style(el, '#slot-first').marginBlockStart).to.equal(style(el, '#bare-h3').marginBlockStart);
    expect(style(el, '#slot-first').marginBlockEnd).to.equal(style(el, '#bare-h3').marginBlockEnd);
    expect(style(el, '#slot-heading').marginBlockStart).to.equal(style(el, '#bare-h2').marginBlockStart);
    expect(style(el, '#slot-p').marginBlockStart).to.equal(style(el, '#bare-p').marginBlockStart);
    expect(style(el, '#bare-p').marginBlockStart, 'control differs from the flow space').to.not.equal('17px');
  });

  it('gives the blockquote a light logical edge, inherited colour and italics', async () => {
    const el = await fixture(html`
      <div class="lr-typography" style="color: rgb(1, 2, 3)">
        <blockquote>Quoted</blockquote>
      </div>
    `);
    const quote = style(el, 'blockquote');
    expect(quote.borderLeftWidth).to.equal('2px');
    expect(quote.borderLeftStyle).to.equal('solid');
    expect(quote.paddingLeft).to.equal('16px');
    expect(quote.marginLeft).to.equal('0px');
    expect(quote.marginRight).to.equal('0px');
    expect(quote.fontStyle).to.equal('italic');
    expect(quote.color).to.equal('rgb(1, 2, 3)');

    (el as HTMLElement).style.setProperty('--lr-prose-quote-border-width', '5px');
    expect(style(el, 'blockquote').borderLeftWidth).to.equal('5px');
  });

  it('restates list markers, indent and item rhythm, keeping an authored type', async () => {
    const el = await fixture(html`
      <div class="lr-typography">
        <ul id="ul">
          <li id="li-1">One</li>
          <li id="li-2">
            Two
            <ul id="nested-ul"><li>Nested</li></ul>
          </li>
          <li>
            <ol id="mid-ol">
              <li><ul id="deep-ul"><li>Deep</li></ul></li>
            </ol>
          </li>
        </ul>
        <ol id="ol"><li>One</li></ol>
        <ol id="roman" type="i"><li>One</li></ol>
        <ul id="squares" type="square"><li>One</li></ul>
      </div>
    `);
    expect(style(el, '#ul').paddingInlineStart).to.equal('32px');
    expect(style(el, '#ol').paddingInlineStart).to.equal('32px');
    expect(style(el, '#li-1').marginBlockStart).to.equal('0px');
    expect(style(el, '#li-2').marginBlockStart).to.equal('8px');
    expect(style(el, '#nested-ul').marginBlockStart).to.equal('8px');
    expect(style(el, '#ul').listStyleType).to.equal('disc');
    expect(style(el, '#ol').listStyleType).to.equal('decimal');
    expect(style(el, '#nested-ul').listStyleType).to.equal('circle');
    expect(style(el, '#deep-ul').listStyleType).to.equal('square');
    expect(style(el, '#roman').listStyleType).to.equal('lower-roman');
    expect(style(el, '#squares').listStyleType).to.equal('square');
  });

  function expectChip(computed: CSSStyleDeclaration, size: string, label: string): void {
    expect(computed.fontFamily, `${label} family`).to.contain('monospace');
    expect(computed.fontSize, `${label} size`).to.equal(size);
    expect(computed.fontWeight, `${label} weight`).to.equal('600');
    expect(computed.paddingTop, `${label} padding-top`).to.equal('2px');
    expect(computed.paddingBottom, `${label} padding-bottom`).to.equal('2px');
    expect(computed.paddingLeft, `${label} padding-left`).to.equal('4px');
    expect(computed.paddingRight, `${label} padding-right`).to.equal('4px');
    expect(computed.borderTopLeftRadius, `${label} radius`).to.equal('2px');
    expect(computed.backgroundColor, `${label} background`).to.not.equal(TRANSPARENT);
  }

  it('turns inline code into a chip that scales with its text', async () => {
    const el = await fixture(html`
      <div class="lr-typography">
        <p><code id="code">inline</code></p>
        <h1><code id="heading-code">big</code></h1>
      </div>
    `);
    expectChip(style(el, '#code'), '14px', 'paragraph code');
    expectChip(style(el, '#heading-code'), '28px', 'heading code');
  });

  it('leaves code inside pre without a chip', async () => {
    const el = await fixture(html`
      <div class="lr-typography">
        <pre><code>block</code></pre>
      </div>
    `);
    const code = style(el, 'code');
    expect(code.backgroundColor).to.equal(TRANSPARENT);
    expect(code.paddingTop).to.equal('0px');
    expect(code.paddingLeft).to.equal('0px');
  });

  it('applies the same chip through lr-inline-code outside a scope', async () => {
    const el = await fixture(html`
      <div>
        <p><code id="code" class="lr-inline-code">inline</code></p>
        <p><span id="span" class="lr-inline-code">span</span></p>
      </div>
    `);
    expectChip(style(el, '#code'), '14px', 'code');
    expectChip(style(el, '#span'), '14px', 'span');
  });

  it('borders, pads and stripes tables, keeping authored alignment', async () => {
    const el = await fixture(html`
      <div class="lr-typography">
        <table>
          <thead>
            <tr><th id="th">Head</th><th>Head 2</th></tr>
          </thead>
          <tbody>
            <tr id="odd"><td id="td">A</td><td id="centred" align="center">B</td></tr>
            <tr id="even"><td>C</td><td>D</td></tr>
          </tbody>
        </table>
      </div>
    `);
    const cell = style(el, '#td');
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      expect(cell.getPropertyValue(`border-${side.toLowerCase()}-width`), side).to.equal('1px');
      expect(cell.getPropertyValue(`border-${side.toLowerCase()}-style`), side).to.equal('solid');
    }
    expect(cell.paddingTop).to.equal('8px');
    expect(cell.paddingLeft).to.equal('16px');
    expect(style(el, '#th').fontWeight).to.equal('700');
    expect(style(el, '#th').textAlign).to.equal('start');
    expect(style(el, '#odd').backgroundColor).to.equal(TRANSPARENT);
    expect(style(el, '#even').backgroundColor).to.not.equal(style(el, '#odd').backgroundColor);
    expect(cell.textAlign).to.equal('start');
    expect(style(el, '#centred').textAlign).to.not.equal('start');
  });
});

describe('typography precedence', () => {
  it('combines with lr-prose: typography element looks and heading space win', async () => {
    const el = await fixture(html`
      <article class="lr-prose lr-typography">
        <h1 id="h1">Title</h1>
        <p>Text</p>
        <h2 id="h2">Section</h2>
        <blockquote id="bq">Quote</blockquote>
        <h4 id="h4">Minor</h4>
        <span id="quiet" class="lr-text-quiet">Quiet probe</span>
      </article>
    `);
    expect(style(el, '#h1').fontWeight).to.equal('700');
    expect(style(el, '#bq').borderLeftWidth).to.equal('2px');
    expect(style(el, '#bq').fontStyle).to.equal('italic');
    expect(style(el, '#bq').color).to.not.equal(style(el, '#quiet').color);
    expect(style(el, '#h4').fontSize).to.equal('18px');
    expect(style(el, '#h2').marginBlockStart).to.equal('32px');
  });

  it('beats lr-native heading weight and quote colour', async () => {
    const el = await fixture(html`
      <div class="lr-native">
        <div id="scope" class="lr-typography">
          <h1 id="h1">Title</h1>
          <blockquote id="bq">Quote</blockquote>
        </div>
      </div>
    `);
    expect(style(el, '#h1').fontWeight).to.equal('700');
    expect(style(el, '#bq').color).to.equal(style(el, '#scope').color);
  });

  it('lets a role class beat the lr-prose element look', async () => {
    const el = await fixture(html`
      <article class="lr-prose"><h3 class="lr-heading-1">Role wins</h3></article>
    `);
    expect(style(el, 'h3').fontSize).to.equal('32px');
    expect(style(el, 'h3').fontWeight).to.equal('700');
  });

  it('lets later text and font utilities modify a role class', async () => {
    const el = await fixture(html`
      <div>
        <p id="quiet-role" class="lr-heading-2 lr-text-quiet">Quiet heading</p>
        <span id="quiet" class="lr-text-quiet">Quiet probe</span>
        <p id="medium-role" class="lr-heading-2 lr-font-medium">Medium heading</p>
      </div>
    `);
    expect(style(el, '#quiet-role').color).to.equal(style(el, '#quiet').color);
    expect(style(el, '#medium-role').fontWeight).to.equal('500');
  });

  it('lets an explicit role beat the element level inside the scope', async () => {
    const el = await fixture(html`
      <div class="lr-typography">
        <h3 id="h3-as-1" class="lr-heading-1">Three as one</h3>
        <h2 id="h2-as-4" class="lr-heading-4">Two as four</h2>
        <h4 id="h4-as-2" class="lr-heading-2">Four as two</h4>
        <p id="p-as-1" class="lr-heading-1">Paragraph as one</p>
      </div>
    `);
    const threeAsOne = style(el, '#h3-as-1');
    expect(threeAsOne.fontSize).to.equal('32px');
    expect(threeAsOne.fontWeight).to.equal('700');
    expect(threeAsOne.borderBottomWidth).to.equal('0px');
    const twoAsFour = style(el, '#h2-as-4');
    expect(twoAsFour.fontSize).to.equal('18px');
    expect(twoAsFour.fontWeight).to.equal('600');
    expect(twoAsFour.borderBottomWidth).to.equal('0px');
    expect(twoAsFour.paddingBottom).to.equal('0px');
    const fourAsTwo = style(el, '#h4-as-2');
    expect(fourAsTwo.fontSize).to.equal('28px');
    expect(fourAsTwo.borderBottomWidth).to.equal('1px');
    expect(style(el, '#p-as-1').lineHeight).to.equal('40px');
  });

  it('lets lr-center size and centre scope blocks', async () => {
    const el = await fixture(html`
      <div class="lr-typography" style="inline-size: 1000px; --lr-content-max-inline-size: 400px">
        <blockquote id="bq" class="lr-center">Centred quote</blockquote>
        <table id="table" class="lr-center">
          <tbody>
            <tr><td>Cell</td></tr>
          </tbody>
        </table>
      </div>
    `);
    for (const selector of ['#bq', '#table']) {
      const computed = style(el, selector);
      const start = parseFloat(computed.marginInlineStart);
      const end = parseFloat(computed.marginInlineEnd);
      const width = pick(el, selector).getBoundingClientRect().width;
      expect(start, `${selector} start margin`).to.be.greaterThan(0);
      expect(start, `${selector} margins equal`).to.be.closeTo(end, 0.5);
      expect(start + end + width, `${selector} fills the scope`).to.be.closeTo(1000, 1);
    }
    expect(style(el, '#bq').inlineSize).to.equal('400px');
    expect(pick(el, '#table').getBoundingClientRect().width).to.be.closeTo(400, 1);
  });

  it('keeps unlayered consumer CSS authoritative over a late utilities copy', async () => {
    const consumer = document.createElement('style');
    consumer.textContent = '.lr-heading-1 { font-size: 11px; }';
    document.head.append(consumer);
    let late: HTMLLinkElement | undefined;
    try {
      late = await loadStylesheet('utilities.css');
      const el = await fixture(html`<p class="lr-heading-1">Consumer wins</p>`);
      expect(getComputedStyle(el).fontSize).to.equal('11px');
    } finally {
      late?.remove();
      consumer.remove();
    }
  });

  it('leaves lr-prose and unclassed markup exactly as before', async () => {
    const el = await fixture(html`
      <div>
        <article class="lr-prose" style="--lr-theme-color-brand-fill-loud: rgb(7, 8, 9)">
          <h1 id="h1">One</h1>
          <h2 id="h2">Two</h2>
          <h3 id="h3">Three</h3>
          <h4 id="h4">Four</h4>
          <blockquote id="bq">Quote</blockquote>
          <ul id="ul"><li>Item</li></ul>
          <p><code id="code">code</code> <a id="a" href="#target">link</a></p>
          <table>
            <tbody>
              <tr><td id="td">Cell</td></tr>
            </tbody>
          </table>
          <div>Wrapper</div>
          <p id="after-div">After a wrapper</p>
          <span id="quiet" class="lr-text-quiet">Quiet probe</span>
        </article>
        <div id="bare">
          <h1 id="bare-h1">One</h1>
          <h2 id="bare-h2">Two</h2>
          <h4 id="bare-h4">Four</h4>
          <blockquote id="bare-bq">Quote</blockquote>
          <ul id="bare-ul"><li>Item</li></ul>
          <p id="bare-p">Paragraph</p>
          <a id="bare-a" href="#target">link</a>
          <code id="bare-code">code</code>
        </div>
      </div>
    `);
    expect(style(el, '#h1').fontSize).to.equal('32px');
    expect(style(el, '#h1').fontWeight).to.equal('600');
    expect(style(el, '#h2').fontSize).to.equal('28px');
    expect(style(el, '#h2').borderBottomWidth).to.equal('0px');
    expect(style(el, '#h3').fontSize).to.equal('20px');
    expect(style(el, '#h4').fontSize).to.equal(style(el, '#bare-h4').fontSize);
    expect(style(el, '#bq').borderLeftWidth).to.equal('3px');
    expect(style(el, '#bq').fontStyle).to.equal('normal');
    expect(style(el, '#bq').color).to.equal(style(el, '#quiet').color);
    expect(style(el, '#ul').paddingInlineStart).to.equal('40px');
    expect(style(el, '#code').backgroundColor).to.equal(TRANSPARENT);
    expect(style(el, '#td').borderTopWidth).to.equal('0px');
    expect(style(el, '#a').color).to.equal('rgb(7, 8, 9)');
    expect(style(el, '#a').textDecorationThickness).to.equal('auto');
    expect(style(el, '#after-div').marginBlockStart).to.equal('0px');

    // No class at all: user-agent values.
    expect(style(el, '#bare-h1').fontSize).to.equal('32px');
    expect(style(el, '#bare-h1').fontWeight).to.equal('700');
    expect(style(el, '#bare-h2').fontSize).to.equal('24px');
    expect(style(el, '#bare-h2').borderBottomWidth).to.equal('0px');
    expect(style(el, '#bare-bq').marginInlineStart).to.equal('40px');
    expect(style(el, '#bare-bq').fontStyle).to.equal('normal');
    expect(style(el, '#bare-ul').paddingInlineStart).to.equal('40px');
    expect(style(el, '#bare-ul').listStyleType).to.equal('disc');
    expect(style(el, '#bare-p').marginBlockStart).to.equal('16px');
    expect(style(el, '#bare-a').textDecorationThickness).to.equal('auto');
    expect(style(el, '#bare-code').backgroundColor).to.equal(TRANSPARENT);
  });
});

describe('typography tokens, themes and environments', () => {
  it('resolves light and dark theme values through the token chain', async () => {
    await withTheme(async () => {
      const el = await fixture(html`
        <div>
          <article id="light" class="lr-prose lr-typography">
            <h2>Heading</h2>
            <p><code>chip</code> <a href="#target">link</a></p>
            <table>
              <tbody>
                <tr><td>Odd</td></tr>
                <tr class="even"><td>Even</td></tr>
              </tbody>
            </table>
          </article>
          <div class="lr-dark">
            <article id="dark" class="lr-prose lr-typography">
              <h2>Heading</h2>
              <p><code>chip</code> <a href="#target">link</a></p>
              <table>
                <tbody>
                  <tr><td>Odd</td></tr>
                  <tr class="even"><td>Even</td></tr>
                </tbody>
              </table>
            </article>
          </div>
        </div>
      `);
      const expected = {
        light: ['rgb(237, 238, 241)', 'rgb(26, 26, 26)', 'rgb(246, 248, 250)', 'rgb(138, 138, 144)', 'rgb(26, 26, 26)', 'rgb(3, 94, 198)'],
        dark: ['rgb(44, 46, 49)', 'rgb(242, 242, 242)', 'rgb(34, 39, 46)', 'rgb(107, 107, 116)', 'rgb(242, 242, 242)', 'rgb(91, 158, 255)'],
      } as const;
      for (const [mode, [codeBg, codeText, stripe, rule, heading, link]] of Object.entries(expected)) {
        const scope = pick(el, `#${mode}`);
        expect(style(scope, 'code').backgroundColor, `${mode} chip fill`).to.equal(codeBg);
        expect(style(scope, 'code').color, `${mode} chip text`).to.equal(codeText);
        expect(style(scope, '.even').backgroundColor, `${mode} stripe`).to.equal(stripe);
        expect(style(scope, 'h2').borderBottomColor, `${mode} h2 rule`).to.equal(rule);
        expect(style(scope, 'h2').color, `${mode} heading`).to.equal(heading);
        expect(style(scope, 'a').color, `${mode} link`).to.equal(link);
      }
    });
  });

  it('reads the decorative subtle border tier before the control border', async () => {
    const el = await fixture(html`
      <div class="lr-typography" style="--lr-theme-color-surface-border-subtle: rgb(1, 2, 3)">
        <h2>Heading</h2>
        <blockquote>Quote</blockquote>
        <table>
          <tbody>
            <tr><td>Cell</td></tr>
          </tbody>
        </table>
      </div>
    `);
    const edges = (): string[] => [
      style(el, 'h2').borderBottomColor,
      style(el, 'blockquote').borderLeftColor,
      style(el, 'td').borderTopColor,
    ];
    expect(edges()).to.deep.equal(['rgb(1, 2, 3)', 'rgb(1, 2, 3)', 'rgb(1, 2, 3)']);
    (el as HTMLElement).style.setProperty('--lr-color-border-subtle', 'rgb(4, 5, 6)');
    expect(edges()).to.deep.equal(['rgb(4, 5, 6)', 'rgb(4, 5, 6)', 'rgb(4, 5, 6)']);
  });

  it('keeps rules, edges, the mono face and link underlines under forced colors', async function () {
    const el = await fixture(html`
      <div class="lr-typography">
        <h2>Heading</h2>
        <blockquote>Quote</blockquote>
        <p><code>chip</code> <a href="#target">link</a></p>
      </div>
    `);
    let honoured = false;
    try {
      try {
        await setForcedColors('active');
        await waitUntil(() => matchMedia('(forced-colors: active)').matches, 'forced colors never matched', {
          timeout: 1000,
        });
        honoured = true;
      } catch {
        honoured = false;
      }
      if (!honoured) this.skip();
      expect(style(el, 'h2').borderBottomWidth).to.equal('1px');
      expect(style(el, 'h2').borderBottomStyle).to.equal('solid');
      expect(style(el, 'blockquote').borderLeftWidth).to.equal('2px');
      expect(style(el, 'code').fontFamily).to.contain('monospace');
      expect(style(el, 'a').textDecorationLine).to.equal('underline');
    } finally {
      await setForcedColors('none').catch(() => undefined);
    }
  });

  it('mirrors edges and indents under RTL', async () => {
    const el = await fixture(html`
      <div class="lr-typography" dir="rtl">
        <blockquote>Quote</blockquote>
        <ul><li>Item</li></ul>
        <h2>Heading</h2>
        <p class="lr-heading-2">Role</p>
      </div>
    `);
    expect(style(el, 'blockquote').borderRightWidth).to.equal('2px');
    expect(style(el, 'blockquote').borderLeftWidth).to.equal('0px');
    expect(style(el, 'ul').paddingRight).to.equal('32px');
    expect(style(el, 'ul').paddingLeft).to.equal('0px');
    expect(style(el, 'h2').borderBottomWidth).to.equal('1px');
    expect(style(el, '.lr-heading-2').borderBottomWidth).to.equal('1px');
  });

  it('drops tracking for cursive scripts and italics where no true italic exists', async () => {
    const el = await fixture(html`
      <div>
        <div id="ar" class="lr-typography" lang="ar" style="--lr-heading-letter-spacing: -0.5px">
          <h2>Heading</h2>
          <p class="lr-heading-2">Role</p>
          <blockquote>Quote</blockquote>
        </div>
        <div id="ja" class="lr-typography" lang="ja">
          <blockquote>Quote</blockquote>
        </div>
        <div id="de" class="lr-typography" lang="de" style="--lr-heading-letter-spacing: -0.5px">
          <h2>Heading</h2>
          <blockquote>Quote</blockquote>
        </div>
      </div>
    `);
    expect(style(el, '#ar h2').letterSpacing).to.equal('normal');
    expect(style(el, '#ar .lr-heading-2').letterSpacing).to.equal('normal');
    expect(style(el, '#ar blockquote').fontStyle).to.equal('normal');
    expect(style(el, '#ja blockquote').fontStyle).to.equal('normal');
    expect(style(el, '#de blockquote').fontStyle).to.equal('italic');
    expect(style(el, '#de h2').letterSpacing).to.equal('-0.5px');
  });

  it('scrolls a wide table inside its wrapper at 320px and hints fragmentation', async () => {
    const columns = Array.from({ length: 8 }, (_, index) => `UninterruptedColumnLabel${index}`);
    const el = await fixture(html`
      <div id="frame" style="inline-size: 320px">
        <div class="lr-typography">
          <h2 id="h2">Quarterly figures</h2>
          <div id="wrap" class="lr-overflow-auto" role="region" aria-label="Quarterly figures" tabindex="0">
            <table>
              <thead>
                <tr>${columns.map((label) => html`<th scope="col">${label}</th>`)}</tr>
              </thead>
              <tbody>
                <tr id="row">${columns.map((label) => html`<td>${label}</td>`)}</tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `);
    const wrap = pick(el, '#wrap');
    expect(wrap.scrollWidth).to.be.greaterThan(wrap.clientWidth);
    expect((el as HTMLElement).scrollWidth).to.be.at.most((el as HTMLElement).clientWidth);
    if (CSS.supports('break-after', 'avoid')) {
      expect(style(el, '#h2').breakAfter).to.equal('avoid');
    }
    if (CSS.supports('break-inside', 'avoid')) {
      expect(style(el, '#row').breakInside).to.equal('avoid');
    }
  });

  it('keeps a populated specimen accessible in light mode', async () => {
    await withTheme(async () => {
      const el = await fixture(html`<div>${specimen('axe-light')}</div>`);
      await expect(el).to.be.accessible();
    });
  });

  it('keeps a populated specimen accessible in dark mode', async () => {
    await withTheme(async () => {
      const el = await fixture(html`
        <div
          class="lr-dark"
          style="background: var(--lr-theme-color-surface-default); color: var(--lr-theme-color-text-normal)"
        >
          ${specimen('axe-dark')}
        </div>
      `);
      await expect(el).to.be.accessible();
    });
  });

  it('keeps a populated specimen accessible under RTL Arabic', async () => {
    await withTheme(async () => {
      const el = await fixture(html`<div dir="rtl" lang="ar">${specimen('axe-rtl')}</div>`);
      await expect(el).to.be.accessible();
    });
  });

  it('survives a layered CSS reset declared before the Lyra layers', async () => {
    const reset = document.createElement('style');
    reset.textContent =
      '@layer base { *, ::before, ::after { margin: 0; padding: 0; border: 0 solid; box-sizing: border-box } ' +
      'h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit } ol, ul, menu { list-style: none } ' +
      'a { color: inherit; text-decoration: inherit } table { border-collapse: collapse; border-color: inherit; text-indent: 0 } }';
    document.head.append(reset);
    try {
      const el = await fixture(html`
        <div class="lr-typography">
          <p id="p1">First paragraph with a <a href="#target">link</a>.</p>
          <p id="p2">Second paragraph</p>
          <ul><li>Item</li></ul>
          <ol><li>Step</li></ol>
          <h2>Heading</h2>
          <blockquote>Quote</blockquote>
          <table>
            <tbody>
              <tr><td>Cell</td></tr>
            </tbody>
          </table>
        </div>
      `);
      expect(style(el, 'ul').listStyleType).to.equal('disc');
      expect(style(el, 'ol').listStyleType).to.equal('decimal');
      expect(style(el, 'ul').paddingInlineStart).to.equal('32px');
      expect(style(el, 'a').textDecorationLine).to.equal('underline');
      expect(style(el, 'a').color).to.not.equal(style(el, '#p1').color);
      expect(style(el, 'h2').fontSize).to.equal('28px');
      expect(style(el, 'h2').fontWeight).to.equal('600');
      expect(style(el, 'h2').borderBottomWidth).to.equal('1px');
      expect(style(el, 'blockquote').borderLeftWidth).to.equal('2px');
      expect(style(el, 'blockquote').paddingLeft).to.equal('16px');
      expect(style(el, '#p2').marginBlockStart).to.equal('16px');
      expect(style(el, 'td').borderTopWidth).to.equal('1px');
    } finally {
      reset.remove();
    }
  });

  it('lets headings and quotes inherit colour while the chip keeps its paired colour', async () => {
    const el = await fixture(html`
      <div style="color: rgb(1, 2, 3)">
        <p id="role" class="lr-heading-2">Role</p>
        <div class="lr-typography">
          <h2 id="h2">Heading</h2>
          <blockquote id="bq">Quote</blockquote>
          <p><a id="link" href="#target"><code id="link-code">code</code></a></p>
        </div>
        <a href="#target" style="color: rgb(4, 5, 6)"><code id="outside-code" class="lr-inline-code">code</code></a>
        <p><code id="plain-chip" class="lr-inline-code">chip</code></p>
      </div>
    `);
    expect(style(el, '#role').color).to.equal('rgb(1, 2, 3)');
    expect(style(el, '#h2').color).to.equal('rgb(1, 2, 3)');
    expect(style(el, '#bq').color).to.equal('rgb(1, 2, 3)');
    expect(style(el, '#link-code').color).to.equal(style(el, '#link').color);
    expect(style(el, '#outside-code').color).to.equal('rgb(4, 5, 6)');
    expect(style(el, '#plain-chip').color).to.not.equal('rgb(1, 2, 3)');
  });

  it('skips named-slot component chrome', async () => {
    const el = await fixture(html`
      <div class="lr-typography">
        <lr-card>
          <h2 slot="header">Card title</h2>
          <p>Card body</p>
        </lr-card>
      </div>
    `);
    await (pick(el, 'lr-card') as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const heading = style(el, 'h2');
    expect(heading.borderBottomWidth).to.equal('0px');
    expect(heading.paddingBottom).to.equal('0px');
    expect(heading.fontSize).to.not.equal('28px');
  });

  it('opts a boundary subtree out while it keeps its flow slot and role classes', async () => {
    const el = await fixture(html`
      <div class="lr-typography">
        <p>Before the boundary</p>
        <div id="boundary" class="lr-not-typography">
          <ul id="tags" class="lr-cluster">
            <li>Alpha</li>
            <li id="tag-2">Beta</li>
          </ul>
          <h2 id="boundary-h2">Embedded</h2>
          <blockquote id="boundary-bq">Quote</blockquote>
          <a id="boundary-link" href="#target">Link</a>
          <span id="boundary-role" class="lr-heading-2">Role</span>
          <table>
            <tbody>
              <tr><td>Odd</td></tr>
              <tr id="boundary-even"><td>Even</td></tr>
            </tbody>
          </table>
        </div>
        <blockquote id="boundary-self" class="lr-not-typography">Quote boundary</blockquote>
        <p><a id="scope-link" href="#target">Scope link</a></p>
      </div>
    `);
    expect(style(el, '#tags').paddingInlineStart).to.equal('40px');
    expect(style(el, '#tag-2').marginBlockStart).to.equal('0px');
    expect(style(el, '#boundary-h2').borderBottomWidth).to.equal('0px');
    expect(style(el, '#boundary-h2').fontSize).to.not.equal('28px');
    expect(style(el, '#boundary-bq').fontStyle).to.equal('normal');
    expect(style(el, '#boundary-link').textDecorationThickness).to.not.equal(
      style(el, '#scope-link').textDecorationThickness,
    );
    expect(style(el, '#boundary').marginBlockStart).to.equal('16px');
    expect(style(el, '#boundary-role').fontSize).to.equal('28px');
    expect(style(el, '#boundary-even').backgroundColor).to.equal(TRANSPARENT);
    expect(style(el, '#boundary-self').fontStyle).to.equal('normal');
    expect(style(el, '#boundary-self').borderLeftWidth).to.equal('0px');
  });

  it('keeps a scope nested inside a boundary off, flow spacing included', async () => {
    const el = await fixture(html`
      <div class="lr-typography" style="--lr-prose-flow-space: 40px">
        <p>Outer</p>
        <div class="lr-not-typography">
          <div class="lr-typography">
            <p id="inner-first">First</p>
            <p id="inner-second">Second</p>
            <h2 id="inner-h2">Heading</h2>
          </div>
        </div>
        <p id="outer-second">Outer again</p>
      </div>
    `);
    expect(style(el, '#outer-second').marginBlockStart, 'outer scope control').to.equal('40px');
    expect(style(el, '#inner-first').marginBlockStart).to.equal('16px');
    expect(style(el, '#inner-second').marginBlockStart).to.equal('16px');
    expect(style(el, '#inner-h2').marginBlockStart).to.not.equal('80px');
    expect(style(el, '#inner-h2').borderBottomWidth).to.equal('0px');
  });

  it('falls back to the lr-prose look where typography steps aside', async () => {
    const el = await fixture(html`
      <article class="lr-prose lr-typography">
        <p>Intro</p>
        <div class="lr-not-typography"><h2 id="boundary-h2">Embedded</h2></div>
        <lr-card><h2 id="card-h2" slot="header">Card</h2></lr-card>
      </article>
    `);
    await (pick(el, 'lr-card') as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    for (const selector of ['#boundary-h2', '#card-h2']) {
      expect(style(el, selector).fontSize, selector).to.equal('28px');
      expect(style(el, selector).fontWeight, selector).to.equal('600');
      expect(style(el, selector).borderBottomWidth, selector).to.equal('0px');
    }
  });

  it('respects an inherited nowrap on a role class', async () => {
    const el = await fixture(html`
      <div class="lr-text-nowrap" style="inline-size: 60px">
        <span class="lr-heading-4">several words here</span>
      </div>
    `);
    const span = pick(el, 'span');
    if (CSS.supports('text-wrap-mode', 'nowrap')) {
      expect(getComputedStyle(span).getPropertyValue('text-wrap-mode')).to.equal('nowrap');
    }
    expect(span.getClientRects().length).to.equal(1);
  });

  it('never styles the scope marker element itself', async () => {
    const el = await fixture(html`
      <div>
        <blockquote id="marker-bq" class="lr-typography">Quote</blockquote>
        <h2 id="marker-h2" class="lr-typography">Heading</h2>
        <h2 id="bare-h2">Heading</h2>
        <table id="marker-table" class="lr-typography">
          <tbody>
            <tr><td>Cell</td></tr>
          </tbody>
        </table>
        <a id="marker-a" class="lr-typography" href="#target">Link</a>
        <a id="bare-a" href="#target">Link</a>
      </div>
    `);
    expect(style(el, '#marker-bq').fontStyle).to.equal('normal');
    expect(style(el, '#marker-bq').borderLeftWidth).to.equal('0px');
    expect(style(el, '#marker-h2').fontSize).to.equal(style(el, '#bare-h2').fontSize);
    expect(style(el, '#marker-h2').borderBottomWidth).to.equal('0px');
    expect(style(el, '#marker-table').borderCollapse).to.equal('separate');
    expect(style(el, '#marker-a').textDecorationThickness).to.equal(style(el, '#bare-a').textDecorationThickness);
  });
});
