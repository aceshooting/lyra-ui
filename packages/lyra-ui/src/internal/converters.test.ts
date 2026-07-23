import { expect } from '@open-wc/testing';
import {
  presenceTrueDefaultBooleanConverter,
  spellcheckConverter,
  spellcheckFromAttributeConverter,
  trueDefaultBooleanConverter,
  trueDefaultBooleanFromAttributeConverter,
  trueDefaultSpellcheckConverter,
} from './converters.js';

it('parses true-defaulting booleans while honoring the literal false attribute', () => {
  expect(trueDefaultBooleanConverter.fromAttribute?.(null, undefined)).to.equal(true);
  expect(trueDefaultBooleanConverter.fromAttribute?.('', undefined)).to.equal(true);
  expect(trueDefaultBooleanConverter.fromAttribute?.('true', undefined)).to.equal(true);
  expect(trueDefaultBooleanConverter.fromAttribute?.('false', undefined)).to.equal(false);
  expect(trueDefaultBooleanConverter.toAttribute?.(true, undefined)).to.equal(null);
  expect(trueDefaultBooleanConverter.toAttribute?.(false, undefined)).to.equal('false');
});

it('provides a parse-only true-default converter for non-reflected properties', () => {
  expect(trueDefaultBooleanFromAttributeConverter.fromAttribute?.(null, undefined)).to.equal(true);
  expect(trueDefaultBooleanFromAttributeConverter.fromAttribute?.('false', undefined)).to.equal(false);
  expect(trueDefaultBooleanFromAttributeConverter.toAttribute).to.equal(undefined);
});

it('preserves presence-style reflection where that is the existing public contract', () => {
  expect(presenceTrueDefaultBooleanConverter.fromAttribute?.('false', undefined)).to.equal(false);
  expect(presenceTrueDefaultBooleanConverter.toAttribute?.(true, undefined)).to.equal('');
  expect(presenceTrueDefaultBooleanConverter.toAttribute?.(false, undefined)).to.equal(null);
});

it('parses spellcheck using the browser-compatible false vocabulary', () => {
  expect(spellcheckConverter.fromAttribute?.(null, undefined)).to.equal(true);
  expect(spellcheckConverter.fromAttribute?.('', undefined)).to.equal(true);
  expect(spellcheckConverter.fromAttribute?.('true', undefined)).to.equal(true);
  expect(spellcheckConverter.fromAttribute?.('false', undefined)).to.equal(false);
  expect(spellcheckConverter.toAttribute?.(true, undefined)).to.equal('true');
  expect(spellcheckConverter.toAttribute?.(false, undefined)).to.equal('false');
  expect(trueDefaultSpellcheckConverter.toAttribute?.(true, undefined)).to.equal(null);
  expect(trueDefaultSpellcheckConverter.toAttribute?.(false, undefined)).to.equal('false');
  expect(spellcheckFromAttributeConverter.fromAttribute?.('false', undefined)).to.equal(false);
  expect(spellcheckFromAttributeConverter.toAttribute).to.equal(undefined);
});
