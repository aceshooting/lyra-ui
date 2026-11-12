import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { flattenCascadeLayers } from './happy-dom-shims.js';

const content = fc.array(fc.constantFrom('text', '{', '}', '@layer hidden{', ';', '\\', '"', "'"),
  { maxLength: 24 }).map(parts => parts.join(''));
const quoted = fc.tuple(fc.constantFrom('"', "'"), content).map(([quote, text]) =>
  `${quote}${text.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`)}${quote}`);

it('preserves escaped CSS strings while removing surrounding layers', () => {
  fc.assert(fc.property(quoted, literal => {
    const rule = `.sample::before{content:${literal};color:red}`;
    const flattened = flattenCascadeLayers(`@layer theme{${rule}}`);
    expect(flattened).to.equal(rule);
    expect(flattenCascadeLayers(flattened)).to.equal(rule);
  }), propertyRuns());
});

it('preserves comment contents that resemble layer syntax', () => {
  const commentText = fc.array(fc.constantFrom('text', '{', '}', '@layer ghost;', 'url(', '"', "'"),
    { maxLength: 24 }).map(parts => parts.join(''));
  fc.assert(fc.property(commentText, text => {
    const comment = `/*${text}*/`;
    const rule = `${comment}.sample{color:red}`;
    expect(flattenCascadeLayers(`@layer theme{${rule}}`)).to.equal(rule);
  }), propertyRuns());
});

it('unwraps layers without rewriting opaque unquoted URLs', () => {
  const urlText = fc.array(fc.constantFrom('image', '/', '{', '}', '@layer', ';', '.'),
    { minLength: 1, maxLength: 24 }).map(parts => parts.join(''));
  fc.assert(fc.property(fc.constantFrom('url', 'URL', 'uRl'), fc.constantFrom('', ' ', '\t'), urlText,
    (name, whitespace, text) => {
      const rule = `.sample{background:${name}(${whitespace}${text})}`;
      expect(flattenCascadeLayers(`@layer theme{${rule}}`)).to.equal(rule);
    }), propertyRuns());
});

for (const css of ['/* unfinished @layer ghost{', '.sample{content:"unfinished @layer ghost{}',
  '.sample{background:URL( @layer ghost{']) {
  it(`preserves an unfinished opaque token: ${css}`, () => {
    expect(flattenCascadeLayers(css)).to.equal(css);
    expect(flattenCascadeLayers(`@layer theme{${css}`)).to.equal(css);
  });
}

it('distinguishes layer directives from longer at-rule names and unfinished directives', () => {
  const otherRules = '@layered theme{.sample{color:red}}@layer-custom{.sample{color:blue}}';
  expect(flattenCascadeLayers(otherRules)).to.equal(otherRules);
  expect(flattenCascadeLayers(`${otherRules}@layer`)).to.equal(otherRules);
});

for (const header of ['/* ; */ theme', 'theme /* { } ; */', '/* @layer ghost{ */']) {
  it(`unwraps a layer whose header contains an opaque comment: ${header}`, () => {
    const rule = '.sample{color:red}';
    expect(flattenCascadeLayers(`@layer ${header}{${rule}}`)).to.equal(rule);
  });
}

for (const header of ['base, /* ; */ theme', 'base /* { } */ , theme']) {
  it(`drops the complete layer ordering statement with header ${header}`, () => {
    const rule = '.sample{color:red}';
    expect(flattenCascadeLayers(`@layer ${header};${rule}`)).to.equal(rule);
  });
}

it('keeps preceding rules when an unfinished layer header ends inside a comment', () => {
  const rule = '.sample{color:red}';
  expect(flattenCascadeLayers(`${rule}@layer theme /* ; {`)).to.equal(rule);
});

it('ignores comment punctuation while locating both kinds of layer-header boundary', () => {
  const headerText = fc.array(fc.constantFrom('word', ';', '{', '}', '@layer ghost', '/', '"', "'"),
    { maxLength: 24 }).map(parts => parts.join(''));
  fc.assert(fc.property(headerText, text => {
    const comment = `/*${text}*/`;
    const rule = '.sample{color:red}';
    expect(flattenCascadeLayers(`@layer ${comment} theme ${comment}{${rule}}`)).to.equal(rule);
    expect(flattenCascadeLayers(`@layer base, ${comment} theme ${comment};${rule}`)).to.equal(rule);
  }), propertyRuns());
});

it('preserves a valid unquoted URL with an escaped closing parenthesis followed by layer-like content', () => {
  const value = String.raw`url(https://example.invalid/a\)@layer{asset})`;
  expect(CSS.supports('background-image', value)).to.equal(true);
  const rule = `.sample{background-image:${value}}`;
  expect(flattenCascadeLayers(rule)).to.equal(rule);
  expect(flattenCascadeLayers(`@layer theme{${rule}}`)).to.equal(rule);
});

it('recognizes the real URL boundary after an escaped backslash and still unwraps following layers', () => {
  const value = String.raw`url(https://example.invalid/a\\)`;
  expect(CSS.supports('background-image', value)).to.equal(true);
  const rule = `.sample{background-image:${value}}`;
  const next = '.next{color:red}';
  expect(flattenCascadeLayers(`@layer theme{${rule}}@layer later{${next}}`)).to.equal(rule + next);
});

it('preserves an unfinished unquoted URL whose final character is an escape', () => {
  const rule = '.sample{background:url(https://example.invalid/unfinished\\';
  expect(flattenCascadeLayers(rule)).to.equal(rule);
  expect(flattenCascadeLayers(`@layer theme{${rule}`)).to.equal(rule);
});

it('preserves escaped URL tokens independently of layer-like resource path segments', () => {
  const segments = fc.array(fc.constantFrom('path', String.raw`\)`, String.raw`\(`, String.raw`\\`, '@layer{asset}', ';', '/'),
    { minLength: 1, maxLength: 16 });
  fc.assert(fc.property(segments, parts => {
    const value = `url(https://example.invalid/${parts.join('')})`;
    expect(CSS.supports('background-image', value)).to.equal(true);
    const rule = `.sample{background-image:${value}}`;
    expect(flattenCascadeLayers(`@layer theme{${rule}}`)).to.equal(rule);
  }), propertyRuns());
});

for (const selector of [String.raw`.\@layer`, String.raw`.\{`, String.raw`.\}`]) {
  it(`preserves escaped syntax in the native-supported selector ${selector}`, () => {
    expect(CSS.supports(`selector(${selector})`)).to.equal(true);
    const rule = `${selector}{color:red}`;
    const after = '.after{color:blue}';
    expect(flattenCascadeLayers(rule)).to.equal(rule);
    expect(flattenCascadeLayers(`@layer theme{${rule}}${after}`)).to.equal(rule + after);
  });
}

it('unwraps a layer whose identifier contains an escaped semicolon', () => {
  const rule = '.sample{color:red}';
  const css = String.raw`@layer theme\;custom{${rule}}`;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  expect(sheet.cssRules.length).to.equal(1);
  const nested = (sheet.cssRules[0] as CSSGroupingRule).cssRules[0] as CSSStyleRule;
  expect(nested.selectorText).to.equal('.sample');
  expect(nested.style.color).to.equal('red');
  expect(flattenCascadeLayers(css)).to.equal(rule);
});

it('preserves escaped identifier tokens while removing real surrounding layers', () => {
  const identifier = fc.array(fc.constantFrom('name', String.raw`\@layer`, String.raw`\{`, String.raw`\}`, String.raw`\;`, String.raw`\\`),
    { minLength: 1, maxLength: 16 }).map(parts => `item${parts.join('')}`);
  fc.assert(fc.property(identifier, name => {
    const selector = `.${name}`;
    expect(CSS.supports(`selector(${selector})`)).to.equal(true);
    const rule = `${selector}{color:red}`;
    expect(flattenCascadeLayers(`@layer theme{${rule}}`)).to.equal(rule);
  }), propertyRuns());
});

for (const keyword of ['@LAYER', '@LaYeR', String.raw`@\6c ayer`, String.raw`@la\79 er`, String.raw`@\layer`, '@\\00006c\r\nayer']) {
  it(`unwraps the native-recognized cascade-layer keyword ${keyword}`, () => {
    const rule = '.sample{color:red}';
    const css = `${keyword} base, theme;${keyword} theme{${rule}}`;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    expect(sheet.cssRules.length).to.equal(2);
    const nested = (sheet.cssRules[1] as CSSGroupingRule).cssRules[0] as CSSStyleRule;
    expect(nested.selectorText).to.equal('.sample');
    expect(flattenCascadeLayers(css)).to.equal(rule);
  });
}

it('preserves an incomplete at-keyword escape without consuming preceding rules', () => {
  const css = '.sample{color:red}@lay\\';
  expect(flattenCascadeLayers(css)).to.equal(css);
});

for (const keyword of ['@layeré', String.raw`@layer\65 d`, '@layer文']) {
  it(`preserves the unknown at-rule ${keyword} so its contents remain inactive`, () => {
    const css = `${keyword}{.sample{color:red}}`;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    expect(sheet.cssRules.length).to.equal(0);
    expect(flattenCascadeLayers(css)).to.equal(css);
  });
}

it('recognizes cascade-layer keywords across CSS hexadecimal escapes and letter case', () => {
  const letters = [...'layer'].map(letter => fc.constantFrom(letter, letter.toUpperCase(),
    `\\${letter.charCodeAt(0).toString(16)} `, `\\${letter.toUpperCase().charCodeAt(0).toString(16).padStart(6, '0')}`));
  fc.assert(fc.property(fc.tuple(...letters), parts => {
    const rule = '.sample{color:red}';
    const css = `@${parts.join('')}  theme{${rule}}`;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    expect(sheet.cssRules.length).to.equal(1);
    expect(flattenCascadeLayers(css)).to.equal(rule);
  }), propertyRuns());
});
