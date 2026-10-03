import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import type { ReactiveControllerHost } from 'lit';
import { invalidateLyraTheme, ThemeWatcher } from './theme-watcher.js';

function controllerHost(doc: Document): HTMLElement & ReactiveControllerHost {
  const element = doc.body.appendChild(doc.createElement('div'));
  return Object.assign(element, {
    addController(): void {}, removeController(): void {}, requestUpdate(): void {},
    updateComplete: Promise.resolve(true),
  });
}

describe('theme watcher CSSOM boundaries', () => {
  it('keeps DOM observation with a sealed setter and releases subscribers even if another runtime seals its installed method', async () => {
    const iframe = await fixture<HTMLIFrameElement>(html`<iframe title="Sealed theme realm"></iframe>`);
    const view = iframe.contentWindow as Window & typeof globalThis;
    const doc = iframe.contentDocument!;
    const setter = Object.getOwnPropertyDescriptor(view.CSSStyleDeclaration.prototype, 'cssText')!;
    Object.defineProperty(view.CSSStyleDeclaration.prototype, 'cssText', { ...setter, configurable: false });
    const host = controllerHost(doc);
    let calls = 0;
    const watcher = new ThemeWatcher(host, () => { calls += 1; });
    try {
      watcher.hostConnected();
      const installed = Object.getOwnPropertyDescriptor(view.CSSStyleSheet.prototype, 'insertRule')!;
      Object.defineProperty(view.CSSStyleSheet.prototype, 'insertRule', {
        ...installed, configurable: false, writable: false,
      });
      host.style.cssText = '--lr-theme-watcher-boundary:12px';
      await aTimeout(0);
      expect(calls).to.equal(1);
      expect(view.getComputedStyle(host).getPropertyValue('--lr-theme-watcher-boundary')).to.equal('12px');
      expect(() => watcher.hostDisconnected()).to.not.throw();
      host.style.cssText = '--lr-theme-watcher-boundary:16px';
      invalidateLyraTheme(doc);
      await aTimeout(0);
      expect(calls).to.equal(1);
      expect(view.getComputedStyle(host).getPropertyValue('--lr-theme-watcher-boundary')).to.equal('16px');
    } finally {
      watcher.hostDisconnected();
      // Non-configurable platform descriptors exist only in this disposable realm.
      iframe.remove();
    }
  });

  it('uses explicit invalidation for opaque sheets while filtering media changes from unrelated sheets', async () => {
    const iframe = await fixture<HTMLIFrameElement>(html`<iframe title="Opaque theme realm"></iframe>`);
    const view = iframe.contentWindow as Window & typeof globalThis;
    const doc = iframe.contentDocument!;
    const sheet = new view.CSSStyleSheet();
    sheet.replaceSync('div { --lr-theme-watcher-boundary:12px; }');
    doc.adoptedStyleSheets = [sheet];
    Object.defineProperty(sheet, 'cssRules', {
      configurable: true,
      get() { throw new DOMException('Cross-origin CSS rules are unavailable', 'SecurityError'); },
    });
    const unrelated = new view.CSSStyleSheet();
    const host = controllerHost(doc);
    let calls = 0;
    let observed = '';
    const watcher = new ThemeWatcher(host, () => {
      calls += 1;
      observed = view.getComputedStyle(host).getPropertyValue('--lr-theme-watcher-boundary');
    });
    try {
      expect(() => watcher.hostConnected()).to.not.throw();
      unrelated.media.appendMedium('print');
      await aTimeout(0);
      expect(calls).to.equal(0);
      invalidateLyraTheme(doc);
      await aTimeout(0);
      expect(calls).to.equal(1);
      expect(observed).to.equal('12px');
      sheet.replaceSync('div { --lr-theme-watcher-boundary:16px; }');
      await aTimeout(0);
      expect(calls).to.equal(2);
      expect(observed).to.equal('16px');
    } finally {
      watcher.hostDisconnected();
      Reflect.deleteProperty(sheet, 'cssRules');
      doc.adoptedStyleSheets = [];
      iframe.remove();
    }
  });
});
