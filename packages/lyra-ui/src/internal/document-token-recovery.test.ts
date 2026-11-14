import { expect } from '@open-wc/testing';
import { adoptLyraTokens, hasLyraTokens } from './document-tokens.js';
import { DOCUMENT_TOKEN_CSS } from './document-tokens.generated.js';

function frame() {
  const element = document.createElement('iframe');
  document.body.append(element);
  return { element, doc: element.contentDocument!, view: element.contentWindow! };
}
function restore(target: object, key: PropertyKey, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else Reflect.deleteProperty(target, key);
}
function space(doc: Document): string {
  return doc.defaultView!.getComputedStyle(doc.body).getPropertyValue('--lr-space-m').trim();
}

describe('document token capability recovery', () => {
  it('leaves a parsed document untouched and provides tokens when its content moves into a browsing context', () => {
    const parsed = new DOMParser().parseFromString('<main>Content</main>', 'text/html');
    expect(hasLyraTokens(parsed)).to.equal(false);
    adoptLyraTokens(parsed);
    expect(hasLyraTokens(parsed)).to.equal(false);
    expect(parsed.body.textContent).to.equal('Content');
    const { element, doc } = frame();
    try {
      doc.body.append(doc.adoptNode(parsed.querySelector('main')!));
      adoptLyraTokens(doc);
      expect(hasLyraTokens(doc)).to.equal(true);
      expect(doc.querySelector('main')!.textContent).to.equal('Content');
      expect(space(doc)).to.equal('0.75rem');
    } finally { element.remove(); }
  });

  it('rechecks stylesheet construction capability after an unavailable first adoption', () => {
    const { element, doc, view } = frame();
    const descriptor = Object.getOwnPropertyDescriptor(view, 'CSSStyleSheet');
    try {
      Object.defineProperty(view, 'CSSStyleSheet', { configurable: true, value: undefined });
      adoptLyraTokens(doc);
      expect(hasLyraTokens(doc)).to.equal(false);
      expect(doc.adoptedStyleSheets.length).to.equal(0);
      restore(view, 'CSSStyleSheet', descriptor);
      adoptLyraTokens(doc);
      expect(hasLyraTokens(doc)).to.equal(true);
      expect(space(doc)).to.equal('0.75rem');
      const count = doc.adoptedStyleSheets.length;
      adoptLyraTokens(doc);
      expect(doc.adoptedStyleSheets.length).to.equal(count);
    } finally { restore(view, 'CSSStyleSheet', descriptor); element.remove(); }
  });

  for (const initiallyApplies of [false, true]) {
    it(`recovers a temporarily unreadable stylesheet that ${initiallyApplies ? 'already provides tokens' : 'later provides tokens'}`, () => {
      const { element, doc } = frame();
      const style = doc.createElement('style');
      style.textContent = initiallyApplies ? DOCUMENT_TOKEN_CSS : 'body { color: rgb(1, 2, 3); }';
      doc.head.append(style);
      const sheet = style.sheet!;
      const descriptor = Object.getOwnPropertyDescriptor(sheet, 'cssRules');
      let attempts = 0;
      try {
        Object.defineProperty(sheet, 'cssRules', { configurable: true, get() {
          attempts++; throw new DOMException('Stylesheet is not readable', 'SecurityError');
        } });
        adoptLyraTokens(doc);
        expect(attempts).to.be.greaterThan(0);
        expect(hasLyraTokens(doc)).to.equal(true);
        expect(space(doc)).to.equal('0.75rem');
        if (!initiallyApplies) {
          const own = [...doc.adoptedStyleSheets];
          expect(own.length).to.be.greaterThan(0);
          restore(sheet, 'cssRules', descriptor);
          const template = new doc.defaultView!.CSSStyleSheet();
          template.replaceSync(DOCUMENT_TOKEN_CSS);
          for (const rule of Array.from(template.cssRules)) sheet.insertRule(rule.cssText, sheet.cssRules.length);
          adoptLyraTokens(doc);
          expect(own.filter(value => !doc.adoptedStyleSheets.includes(value)).length).to.equal(1);
          expect(space(doc)).to.equal('0.75rem');
        }
        style.remove();
        adoptLyraTokens(doc);
        expect(hasLyraTokens(doc)).to.equal(true);
        expect(doc.adoptedStyleSheets.length).to.be.greaterThan(0);
        expect(space(doc)).to.equal('0.75rem');
      } finally { restore(sheet, 'cssRules', descriptor); element.remove(); }
    });
  }

  it('provides usable tokens after the initial computed-style probe is unavailable', () => {
    const { element, doc, view } = frame();
    const descriptor = Object.getOwnPropertyDescriptor(view, 'getComputedStyle');
    let attempts = 0;
    try {
      Object.defineProperty(view, 'getComputedStyle', { configurable: true, value: () => {
        attempts++; throw new DOMException('Style probe unavailable', 'InvalidStateError');
      } });
      adoptLyraTokens(doc);
      expect(attempts).to.be.greaterThan(0);
      restore(view, 'getComputedStyle', descriptor);
      expect(hasLyraTokens(doc)).to.equal(true);
      expect(space(doc)).to.equal('0.75rem');
      const count = doc.adoptedStyleSheets.length;
      adoptLyraTokens(doc);
      expect(doc.adoptedStyleSheets.length).to.equal(count);
    } finally { restore(view, 'getComputedStyle', descriptor); element.remove(); }
  });
});
