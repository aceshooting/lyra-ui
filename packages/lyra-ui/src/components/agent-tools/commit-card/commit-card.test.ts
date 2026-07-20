import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './commit-card.js';
import type { LyraCommitCard } from './commit-card.js';
import { styles } from './commit-card.styles.js';

describe('lr-commit-card', () => {
  it('defaults to filesCollapsed=true and copyable=true', async () => {
    const el = (await fixture(html`<lr-commit-card></lr-commit-card>`)) as LyraCommitCard;
    expect(el.filesCollapsed).to.be.true;
    expect(el.copyable).to.be.true;
  });

  it('parses the literal files-collapsed="false" and copyable="false" attributes (not just property bindings)', async () => {
    const el = (await fixture(html`
      <lr-commit-card files-collapsed="false" copyable="false" hash="abcdef1"
        .files=${[{ path: 'a.ts', additions: 1, deletions: 0 }]}
      ></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    expect(el.filesCollapsed).to.be.false;
    expect(el.copyable).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="file"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="copy-button"]').length).to.equal(0);
  });

  it('lets a host aria-label override the default computed commitCardLabel', async () => {
    const withoutOverride = (await fixture(html`<lr-commit-card></lr-commit-card>`)) as LyraCommitCard;
    await withoutOverride.updateComplete;
    const defaultLabel = withoutOverride.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label');
    expect(defaultLabel).to.be.a('string').and.not.equal('');

    const withOverride = (await fixture(
      html`<lr-commit-card aria-label="Commit abc123"></lr-commit-card>`,
    )) as LyraCommitCard;
    await withOverride.updateComplete;
    expect(withOverride.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Commit abc123',
    );
  });

  it('abbreviates hash to 7 chars for display but copies the full hash', async () => {
    const el = (await fixture(
      html`<lr-commit-card hash="abcdef1234567890" copyable></lr-commit-card>`,
    )) as LyraCommitCard;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="hash"]')!.textContent!.trim()).to.equal('abcdef1');
    const listener = oneEvent(el, 'lr-copy');
    (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    const event = (await listener) as CustomEvent<{ text: string }>;
    expect(event.detail.text).to.equal('abcdef1234567890');
  });

  it('splits message into subject (first line) and body (remaining lines)', async () => {
    const el = (await fixture(
      html`<lr-commit-card message="Fix bug\n\nDetails about the fix"></lr-commit-card>`,
    )) as LyraCommitCard;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="subject"]')!.textContent).to.equal('Fix bug');
    expect(el.shadowRoot!.querySelector('[part="body"]')!.textContent!.trim()).to.equal('Details about the fix');
  });

  it('renders the aggregate diffstat with a non-color-only accessible label', async () => {
    const el = (await fixture(html`
      <lr-commit-card
        .files=${[
          { path: 'a.ts', additions: 3, deletions: 1, status: 'modified' },
          { path: 'b.ts', additions: 5, deletions: 0, status: 'added' },
        ]}
      ></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    const diffstat = el.shadowRoot!.querySelector('[part="diffstat"]')!;
    expect(diffstat.textContent).to.include('8');
    expect(diffstat.textContent).to.include('1');
    expect(diffstat.getAttribute('aria-label')).to.be.a('string').and.not.equal('');
  });

  it('files list starts collapsed and toggles via files-toggle, emitting lr-toggle', async () => {
    const el = (await fixture(html`
      <lr-commit-card .files=${[{ path: 'a.ts', additions: 1, deletions: 0 }]}></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="file"]').length).to.equal(0);
    const toggle = el.shadowRoot!.querySelector('[part="files-toggle"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lr-toggle');
    toggle.click();
    const event = (await listener) as CustomEvent<{ collapsed: boolean }>;
    expect(event.detail.collapsed).to.be.false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="file"]').length).to.equal(1);
  });

  it('emits lr-file-select with the path when a file row is activated', async () => {
    const el = (await fixture(html`
      <lr-commit-card .files=${[{ path: 'a.ts', additions: 1, deletions: 0 }]} .filesCollapsed=${false}></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="file"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lr-file-select');
    row.click();
    const event = (await listener) as CustomEvent<{ path: string }>;
    expect(event.detail.path).to.equal('a.ts');
  });

  it('renders a timestamp inside a <time datetime> element', async () => {
    const el = (await fixture(
      html`<lr-commit-card .timestamp=${1700000000000}></lr-commit-card>`,
    )) as LyraCommitCard;
    await el.updateComplete;
    const time = el.shadowRoot!.querySelector('[part="time"] time')!;
    expect(time.getAttribute('datetime')).to.be.a('string').and.not.equal('');
  });

  it('omits the time segment (never throws) for a non-finite timestamp, and clamps a negative one to epoch 0', async () => {
    const nonFinite = (await fixture(
      html`<lr-commit-card .timestamp=${Number.NaN}></lr-commit-card>`,
    )) as LyraCommitCard;
    // `new Date(NaN).toISOString()` throws a RangeError -- fixture()/updateComplete resolving at
    // all (rather than rejecting) is itself proof render() didn't hit that path.
    await nonFinite.updateComplete;
    expect(nonFinite.shadowRoot!.querySelector('[part="time"]')).to.not.exist;

    const negative = (await fixture(
      html`<lr-commit-card .timestamp=${-5000}></lr-commit-card>`,
    )) as LyraCommitCard;
    await negative.updateComplete;
    const time = negative.shadowRoot!.querySelector('[part="time"] time')!;
    expect(time).to.exist;
    expect(time.getAttribute('datetime')).to.equal(new Date(0).toISOString());
  });

  it('is accessible with hash, message, author, timestamp, and files', async () => {
    const el = (await fixture(html`
      <lr-commit-card
        hash="abcdef1234567890"
        message="Fix bug"
        author="Ada"
        .timestamp=${1700000000000}
        .files=${[{ path: 'a.ts', additions: 1, deletions: 0, status: 'modified' }]}
      ></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('routes localized strings through a .strings override, reaching the rendered DOM', async () => {
    const el = (await fixture(html`
      <lr-commit-card
        hash="abcdef1"
        .files=${[{ path: 'a.ts', additions: 1, deletions: 0 }]}
        .strings=${{
          commitCardLabel: 'Fiche de commit',
          commitCardCopyHash: 'Copier le hash',
          commitCardShowFiles: 'Afficher {count} fichiers',
        }}
      ></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Fiche de commit');
    expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.getAttribute('aria-label')).to.equal(
      'Copier le hash',
    );
    expect(el.shadowRoot!.querySelector('[part="files-toggle"]')!.textContent!.trim()).to.equal(
      'Afficher 1 fichiers',
    );
  });

  it('defaults to compact=false and appearance="card", keeping the pre-existing border/padding', async () => {
    const el = (await fixture(html`<lr-commit-card></lr-commit-card>`)) as LyraCommitCard;
    await el.updateComplete;
    expect(el.compact).to.be.false;
    expect(el.appearance).to.equal('card');
    expect(el.hasAttribute('compact')).to.be.false;
    expect(el.getAttribute('appearance')).to.equal('card');
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    expect(base.paddingTop).to.equal('12px'); // --lr-space-m
    expect(base.borderTopWidth).to.equal('1px');
  });

  it('reflects compact and tightens the base padding, keeping the border', async () => {
    const el = (await fixture(html`<lr-commit-card compact></lr-commit-card>`)) as LyraCommitCard;
    await el.updateComplete;
    expect(el.hasAttribute('compact')).to.be.true;
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    expect(base.paddingTop).to.equal('8px'); // --lr-space-s
    expect(base.borderTopWidth).to.equal('1px');
  });

  it('lets a consumer retune --lr-commit-card-compact-padding without re-declaring the rule', async () => {
    const el = (await fixture(html`<lr-commit-card compact></lr-commit-card>`)) as LyraCommitCard;
    el.style.setProperty('--lr-commit-card-compact-padding', '3px');
    await el.updateComplete;
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    expect(base.paddingTop).to.equal('3px');
  });

  it('drops border, padding and radius under appearance="plain", winning over compact when both are set', async () => {
    const el = (await fixture(
      html`<lr-commit-card compact appearance="plain"></lr-commit-card>`,
    )) as LyraCommitCard;
    await el.updateComplete;
    expect(el.getAttribute('appearance')).to.equal('plain');
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    expect(base.borderTopWidth).to.equal('0px');
    expect(base.borderTopLeftRadius).to.equal('0px');
    expect(base.paddingTop).to.equal('0px');
  });

  it('orders :host([appearance="plain"]) after :host([compact]) so the equal-specificity reset wins', () => {
    const css = styles.cssText;
    const compactAt = css.indexOf(':host([compact])');
    const plainAt = css.indexOf(":host([appearance='plain'])");
    expect(compactAt).to.be.greaterThan(-1);
    expect(plainAt).to.be.greaterThan(-1);
    expect(plainAt).to.be.greaterThan(compactAt);
  });

  it('is accessible in the populated compact + plain states', async () => {
    const compactEl = (await fixture(
      html`<lr-commit-card compact hash="abcdef1" message="Fix bug" author="Ada"></lr-commit-card>`,
    )) as LyraCommitCard;
    await expect(compactEl).to.be.accessible();

    const plainEl = (await fixture(
      html`<lr-commit-card appearance="plain" hash="abcdef1" message="Fix bug" author="Ada"></lr-commit-card>`,
    )) as LyraCommitCard;
    await expect(plainEl).to.be.accessible();
  });

  it('gives files-toggle, file, and copy-button a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='files-toggle'\]:hover/);
    expect(css).to.match(/\[part='file'\]:hover/);
    expect(css).to.match(/\[part='copy-button'\]:hover/);
  });
});
