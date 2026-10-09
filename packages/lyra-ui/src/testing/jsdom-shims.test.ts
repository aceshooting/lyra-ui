import { expect } from '@open-wc/testing';
import { installJsdomAdoptedStyleSheetsShim, installJsdomShims } from './jsdom-shims.js';

interface FakeSheetPrototype {
  replaceSync?: (text: string) => void;
  replace?: (text: string) => Promise<unknown>;
}

/** Prototypes shaped like jsdom 30: constructable sheets with replace()/replaceSync(), no adoptedStyleSheets. */
function jsdomLikeTargets(sheetMethods = true): {
  documentPrototype: object;
  shadowRootPrototype: object;
  styleSheetPrototype: FakeSheetPrototype;
  isJsdom: () => boolean;
} {
  const styleSheetPrototype: FakeSheetPrototype = sheetMethods
    ? { replaceSync(): void {}, replace(): Promise<unknown> { return Promise.resolve(this); } }
    : {};
  return { documentPrototype: {}, shadowRootPrototype: {}, styleSheetPrototype, isJsdom: () => true };
}

type Adopting = { adoptedStyleSheets: unknown[] };

describe('installJsdomAdoptedStyleSheetsShim', () => {
  it('adds an inert adoptedStyleSheets to Document and ShadowRoot, satisfying Lit\'s adoption check', () => {
    const targets = jsdomLikeTargets();
    const restore = installJsdomAdoptedStyleSheetsShim(targets);
    try {
      expect('adoptedStyleSheets' in targets.documentPrototype).to.equal(true);
      expect('adoptedStyleSheets' in targets.shadowRootPrototype).to.equal(true);
      expect('replace' in targets.styleSheetPrototype).to.equal(true);

      const root = Object.create(targets.shadowRootPrototype) as Adopting;
      const other = Object.create(targets.shadowRootPrototype) as Adopting;
      expect(root.adoptedStyleSheets).to.deep.equal([]);
      expect(root.adoptedStyleSheets === root.adoptedStyleSheets, 'one live array per root').to.equal(true);
      const first = { name: 'first' };
      const second = { name: 'second' };
      root.adoptedStyleSheets = [first];
      root.adoptedStyleSheets.push(second);
      expect(root.adoptedStyleSheets).to.deep.equal([first, second]);
      expect(other.adoptedStyleSheets, 'roots do not share sheets').to.deep.equal([]);

      const source = [first];
      root.adoptedStyleSheets = source;
      source.push(second);
      expect(root.adoptedStyleSheets, 'assignment copies, like the platform').to.deep.equal([first]);
      expect(() => { (root as { adoptedStyleSheets: unknown }).adoptedStyleSheets = null; }).to.throw(TypeError);
    } finally {
      restore();
    }
    expect('adoptedStyleSheets' in targets.documentPrototype).to.equal(false);
    expect('adoptedStyleSheets' in targets.shadowRootPrototype).to.equal(false);
  });

  it('keeps a jsdom release\'s own replace()/replaceSync() and adds inert ones only where missing', async () => {
    const native = jsdomLikeTargets();
    const { replaceSync, replace } = native.styleSheetPrototype;
    const restoreNative = installJsdomAdoptedStyleSheetsShim(native);
    expect(native.styleSheetPrototype.replaceSync === replaceSync).to.equal(true);
    expect(native.styleSheetPrototype.replace === replace).to.equal(true);
    restoreNative();
    expect(native.styleSheetPrototype.replaceSync === replaceSync).to.equal(true);

    const older = jsdomLikeTargets(false);
    const restore = installJsdomAdoptedStyleSheetsShim(older);
    try {
      const sheet = Object.create(older.styleSheetPrototype) as Required<FakeSheetPrototype>;
      expect(() => sheet.replaceSync(':host{display:block}')).to.not.throw();
      expect(await sheet.replace(':host{color:red}')).to.equal(sheet);
    } finally {
      restore();
    }
    expect('replace' in older.styleSheetPrototype).to.equal(false);
    expect('replaceSync' in older.styleSheetPrototype).to.equal(false);
  });

  it('installs once: a second call neither re-patches nor breaks the first restore', () => {
    const targets = jsdomLikeTargets();
    const restore = installJsdomAdoptedStyleSheetsShim(targets);
    const descriptor = Object.getOwnPropertyDescriptor(targets.documentPrototype, 'adoptedStyleSheets');
    installJsdomAdoptedStyleSheetsShim(targets)();
    expect(Object.getOwnPropertyDescriptor(targets.documentPrototype, 'adoptedStyleSheets')).to.deep.equal(descriptor);
    restore();
    expect('adoptedStyleSheets' in targets.documentPrototype).to.equal(false);
  });

  it('is a no-op outside jsdom, and wherever adoptedStyleSheets already exists', () => {
    const notJsdom = { ...jsdomLikeTargets(), isJsdom: () => false };
    installJsdomAdoptedStyleSheetsShim(notJsdom)();
    expect('adoptedStyleSheets' in notJsdom.documentPrototype).to.equal(false);

    const supported = jsdomLikeTargets();
    const own = Object.defineProperty({}, 'adoptedStyleSheets', { configurable: true, get: () => [] });
    const restore = installJsdomAdoptedStyleSheetsShim({ ...supported, documentPrototype: own });
    expect('adoptedStyleSheets' in supported.shadowRootPrototype).to.equal(false);
    restore();
    expect('adoptedStyleSheets' in own, 'restore never removes a native property').to.equal(true);
  });

  it('leaves a real browser untouched, including through installJsdomShims()', () => {
    const documentDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'adoptedStyleSheets');
    const shadowDescriptor = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets');
    const { replace, replaceSync } = CSSStyleSheet.prototype;
    const restore = installJsdomShims();
    try {
      expect(Object.getOwnPropertyDescriptor(Document.prototype, 'adoptedStyleSheets')).to.deep.equal(documentDescriptor);
      expect(Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets')).to.deep.equal(shadowDescriptor);
      expect(CSSStyleSheet.prototype.replace === replace && CSSStyleSheet.prototype.replaceSync === replaceSync).to.equal(true);
    } finally {
      restore();
    }
    expect(Object.getOwnPropertyDescriptor(Document.prototype, 'adoptedStyleSheets')).to.deep.equal(documentDescriptor);
  });
});
