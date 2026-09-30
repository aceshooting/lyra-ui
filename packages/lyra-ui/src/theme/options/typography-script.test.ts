import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { applyLyraStyleScope, type LyraThemeTokens } from '../theme.js';
import '../../components/layout/card/card.js';
import '../../components/forms/textarea/textarea.js';
import type { LyraCard } from '../../components/layout/card/card.js';
import type { LyraTextarea } from '../../components/forms/textarea/textarea.js';

describe('script typography and line breaking', function () {
  this.retries(0);
  let presets: Record<string, LyraThemeTokens>;
  const sheets: HTMLLinkElement[] = [];
  before(async () => {
    const source = await import(new URL('../../../tokens/options/typography.json', import.meta.url).href);
    presets = source.default.presets;
    await Promise.all(['../../theme.css', '../../density.css', '../../styles/utilities.css', '../../styles/native.css'].map(path =>
      new Promise<void>((resolve, reject) => {
        const sheet = document.createElement('link');
        sheet.rel = 'stylesheet';
        sheet.href = new URL(path, import.meta.url).href;
        sheet.onload = () => resolve();
        sheet.onerror = () => reject(new Error(`Cannot load ${path}`));
        sheets.push(sheet);
        document.head.append(sheet);
      })));
  });
  after(() => sheets.forEach(sheet => sheet.remove()));

  it('preserves inherited wrapping when unset and applies scoped CJK policies across shadow and light DOM', async () => {
    const scope = await fixture<HTMLElement>(html`
      <section style="line-break:loose;word-break:break-all">
        <lr-card>日本語の文章、한국어 문장 · English</lr-card>
        <p class="lr-prose">日本語の文章、한국어 문장 · English</p>
        <div class="lr-native"><textarea aria-label="Text">日本語の文章、한국어 문장</textarea></div>
      </section>
    `);
    const card = scope.querySelector<LyraCard>('lr-card')!;
    await card.updateComplete;
    const targets = [card.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!,
      scope.querySelector<HTMLElement>('.lr-prose')!, scope.querySelector<HTMLTextAreaElement>('textarea')!];
    for (const target of targets) {
      expect(getComputedStyle(target).lineBreak).to.equal('loose');
      expect(getComputedStyle(target).wordBreak).to.equal('break-all');
    }
    try {
      for (const [preset, lineBreak, wordBreak] of [
        ['japanese', 'strict', 'normal'], ['korean', 'auto', 'keep-all'], ['thai', 'auto', 'normal'],
      ] as const) {
        applyLyraStyleScope(scope, { overrides: presets[preset] });
        for (const target of targets) {
          expect(getComputedStyle(target).lineBreak, preset).to.equal(lineBreak);
          expect(getComputedStyle(target).wordBreak, preset).to.equal(wordBreak);
        }
      }
    } finally { applyLyraStyleScope(scope, null); }
    for (const target of targets) {
      expect(getComputedStyle(target).lineBreak).to.equal('loose');
      expect(getComputedStyle(target).wordBreak).to.equal('break-all');
    }
  });

  it('keeps Urdu mixed-script editing inside 320px with live text zoom and restores the previous typography', async () => {
    const content = 'اُردُو زبان میں نئی معلومات اور کام کی تفصیل · English 123 · 日本語';
    const scope = await fixture<HTMLElement>(html`
      <section lang="ur" dir="rtl" style="inline-size:320px;max-inline-size:100%">
        <lr-textarea label="Text" .value=${content}></lr-textarea>
      </section>
    `);
    const textarea = scope.querySelector<LyraTextarea>('lr-textarea')!;
    await textarea.updateComplete;
    const field = textarea.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="textarea"]')!;
    const before = getComputedStyle(field).fontFamily;
    const rootFont = document.documentElement.style.fontSize;
    expect(presets['urdu'], 'Urdu is a distinct optional typography preset').to.be.an('object');
    try {
      for (const density of ['compact', 'touch'] as const) {
        applyLyraStyleScope(scope, { density, overrides: presets['urdu'] });
        for (const fontSize of ['16px', '32px', '16px']) {
          document.documentElement.style.fontSize = fontSize;
          await nextFrame();
          const style = getComputedStyle(field);
          expect(style.fontFamily).to.include('Noto Nastaliq Urdu');
          expect(Number.parseFloat(style.fontSize)).to.be.closeTo(Number.parseFloat(fontSize) * 0.875, 0.1);
          expect(Number.parseFloat(style.lineHeight)).to.be.closeTo(Number.parseFloat(style.fontSize) * 2.5, 0.1);
          expect(style.direction).to.equal('rtl');
          expect(field.scrollWidth).to.be.at.most(field.clientWidth + 1);
          expect(field.getBoundingClientRect().width).to.be.at.most(scope.getBoundingClientRect().width);
          expect(field.value).to.equal(content);
        }
      }
      expect(scope.lang).to.equal('ur');
      expect(scope.dir).to.equal('rtl');
    } finally {
      document.documentElement.style.fontSize = rootFont;
      applyLyraStyleScope(scope, null);
    }
    expect(getComputedStyle(field).fontFamily).to.equal(before);
  });
});
