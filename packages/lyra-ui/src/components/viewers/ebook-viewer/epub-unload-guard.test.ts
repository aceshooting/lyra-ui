import { expect } from '@open-wc/testing';
import { guardEpubUnloadListener } from './epub-unload-guard.js';

function recordWindowListeners(): { types: string[]; restore: () => void } {
  const types: string[] = [];
  const original = window.addEventListener;
  window.addEventListener = function (this: Window, type: string, ...rest: unknown[]) {
    types.push(type);
    return (original as (...values: unknown[]) => void).call(this, type, ...rest);
  } as typeof window.addEventListener;
  return { types, restore: () => { delete (window as { addEventListener?: unknown }).addEventListener; } };
}

describe('guardEpubUnloadListener', () => {
  class FakeManager {
    registered: string[] = [];
    constructor(readonly options?: unknown) {}
    addEventListeners(stage?: unknown): unknown {
      window.addEventListener('unload', () => undefined);
      window.addEventListener('resize', () => undefined);
      this.registered.push('scroll');
      return stage;
    }
  }

  function capabilities(manager: unknown = 'default') {
    const settings: { manager: unknown } = { manager };
    return { settings, requireManager: (value: unknown) => (value === 'default' ? FakeManager : value) };
  }

  it('subclasses the selected manager and skips only the unload registration', () => {
    const rendition = capabilities();
    guardEpubUnloadListener(rendition);
    const Manager = rendition.settings.manager as typeof FakeManager;
    expect(Manager).to.not.equal('default');
    const manager = new Manager({ view: 'iframe' });
    expect(manager).to.be.instanceOf(FakeManager);
    expect(manager.options).to.deep.equal({ view: 'iframe' });
    const listeners = recordWindowListeners();
    try {
      expect(manager.addEventListeners('stage')).to.equal('stage');
    } finally {
      listeners.restore();
    }
    expect(listeners.types).to.deep.equal(['resize']);
    expect(manager.registered).to.deep.equal(['scroll']);
    expect(Object.hasOwn(window, 'addEventListener')).to.equal(false);
  });

  it('restores the window method even when upstream throws', () => {
    class ThrowingManager {
      addEventListeners(): never { throw new Error('upstream failure'); }
    }
    const rendition = capabilities(ThrowingManager);
    guardEpubUnloadListener(rendition);
    const Manager = rendition.settings.manager as typeof ThrowingManager;
    expect(Manager).to.not.equal(ThrowingManager);
    expect(() => new Manager().addEventListeners()).to.throw('upstream failure');
    expect(Object.hasOwn(window, 'addEventListener')).to.equal(false);
    expect(window.addEventListener).to.equal(EventTarget.prototype.addEventListener);
  });

  it('leaves settings without a writable manager data property untouched', () => {
    for (const settings of [null, undefined, 1, 'settings', {}]) {
      expect(() => guardEpubUnloadListener({ settings, requireManager: () => FakeManager })).not.to.throw();
    }
    const missingRequire = { manager: 'default' };
    guardEpubUnloadListener({ settings: missingRequire, requireManager: undefined });
    expect(missingRequire.manager).to.equal('default');
    const frozen = Object.freeze({ manager: 'default' });
    expect(() => guardEpubUnloadListener({ settings: frozen, requireManager: () => FakeManager })).not.to.throw();
    expect(frozen.manager).to.equal('default');
    let getterReads = 0;
    const accessor = { get manager() { getterReads += 1; return 'default'; } };
    guardEpubUnloadListener({ settings: accessor, requireManager: () => FakeManager });
    expect(getterReads).to.equal(0);
  });

  it('leaves a manager that is not a class with addEventListeners untouched', () => {
    for (const manager of [{ notAClass: true }, () => undefined, class Plain {}]) {
      const rendition = capabilities(manager);
      guardEpubUnloadListener(rendition);
      expect(rendition.settings.manager).to.equal(manager);
    }
  });
});
