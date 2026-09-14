import { expect } from '@open-wc/testing';
import {
  autocorrectConverter,
  declaredDefaultConverter,
  literalSetConverter,
  optionalLiteralSetConverter,
  presenceTrueDefaultBooleanConverter,
  spellcheckConverter,
  spellcheckFromAttributeConverter,
  trueDefaultBooleanConverter,
  trueDefaultBooleanFromAttributeConverter,
  trueDefaultSpellcheckConverter,
} from './converters.js';

it("restores declared defaults from removal without suppressing initial reflection", () => {
  const stringDefault = declaredDefaultConverter("outlined");
  expect(stringDefault.fromAttribute?.(null, undefined)).to.equal("outlined");
  expect(stringDefault.fromAttribute?.("filled", undefined)).to.equal("filled");
  expect(stringDefault.toAttribute?.("outlined", undefined)).to.equal(
    "outlined"
  );

  const numberDefault = declaredDefaultConverter(6);
  expect(numberDefault.fromAttribute?.(null, undefined)).to.equal(6);
  expect(numberDefault.fromAttribute?.("8", undefined)).to.equal(8);
  expect(numberDefault.toAttribute?.(6, undefined)).to.equal(6);
});

it('shares one closed-set normalization path across attributes, reflection, and property writes', () => {
  const converter = literalSetConverter(['idle', 'active'] as const, 'idle');

  expect(converter.fromAttribute?.('active', undefined)).to.equal('active');
  expect(converter.fromAttribute?.('foreign', undefined)).to.equal('idle');
  expect(converter.fromAttribute?.(null, undefined)).to.equal('idle');
  expect(converter.toAttribute?.('active', undefined)).to.equal('active');
  expect(converter.normalize('foreign')).to.equal('idle');
  expect(converter.normalize(undefined)).to.equal('idle');
  const host = document.createElement("div");
  host.setAttribute("state", "foreign");
  expect(converter.normalizeReflected(host, "state", "foreign")).to.equal(
    "idle"
  );
  expect(host.getAttribute("state")).to.equal("idle");
  expect(Object.isFrozen(converter)).to.equal(true);
});

it('rejects malformed closed-set converter declarations', () => {
  expect(() => literalSetConverter(['idle', 'idle'] as const, 'idle')).to.throw(TypeError);
  expect(() => literalSetConverter(['idle', 'active'] as const, 'missing' as 'idle')).to.throw(TypeError);
});

it('resolves an unsupported opt-in value to absent rather than to a member', () => {
  const converter = optionalLiteralSetConverter(['rtl', 'ltr'] as const);

  expect(converter.fromAttribute?.('rtl', undefined)).to.equal('rtl');
  expect(converter.fromAttribute?.('sideways', undefined)).to.equal(undefined);
  expect(converter.fromAttribute?.(null, undefined)).to.equal(undefined);
  expect(converter.toAttribute?.('ltr', undefined)).to.equal('ltr');
  // A member that resolves to absent must serialize to null, so Lit removes the attribute instead
  // of writing the string "undefined" into markup.
  expect(converter.toAttribute?.(undefined, undefined)).to.equal(null);
  expect(converter.normalize('sideways')).to.equal(undefined);
  expect(converter.normalize(42)).to.equal(undefined);
  expect(Object.isFrozen(converter)).to.equal(true);
});

it('removes a stale attribute when an opt-in write resolves to absent, and repairs a foreign one', () => {
  const converter = optionalLiteralSetConverter(['rtl', 'ltr'] as const);
  const host = document.createElement('div');

  host.setAttribute('countdown', 'sideways');
  expect(converter.normalizeReflected(host, 'countdown', 'sideways')).to.equal(undefined);
  expect(host.hasAttribute('countdown'), 'the stale attribute is removed').to.equal(false);

  host.setAttribute('countdown', 'sideways');
  expect(converter.normalizeReflected(host, 'countdown', 'ltr')).to.equal('ltr');
  expect(host.getAttribute('countdown'), 'the foreign attribute is repaired').to.equal('ltr');

  // An absent attribute stays absent: adding it is Lit's reflection job, not the converter's.
  host.removeAttribute('countdown');
  expect(converter.normalizeReflected(host, 'countdown', 'rtl')).to.equal('rtl');
  expect(host.hasAttribute('countdown'), 'no attribute is invented').to.equal(false);
});

it('rejects a malformed opt-in closed-set declaration', () => {
  expect(() => optionalLiteralSetConverter(['rtl', 'rtl'] as const)).to.throw(TypeError);
});

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

it('serializes autocorrect through its enumerated on/off vocabulary', () => {
  expect(autocorrectConverter.fromAttribute?.(null, undefined)).to.equal(true);
  expect(autocorrectConverter.fromAttribute?.('on', undefined)).to.equal(true);
  expect(autocorrectConverter.fromAttribute?.('false', undefined)).to.equal(false);
  expect(autocorrectConverter.fromAttribute?.('off', undefined)).to.equal(false);
  expect(autocorrectConverter.toAttribute?.(true, undefined)).to.equal('on');
  expect(autocorrectConverter.toAttribute?.(false, undefined)).to.equal('off');
});
