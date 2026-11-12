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
