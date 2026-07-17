import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './commit-card.js';
import type { LyraCommitCard } from './commit-card.js';

describe('lyra-commit-card', () => {
  it('defaults to filesCollapsed=true and copyable=true', async () => {
    const el = (await fixture(html`<lyra-commit-card></lyra-commit-card>`)) as LyraCommitCard;
    expect(el.filesCollapsed).to.be.true;
    expect(el.copyable).to.be.true;
  });

  it('abbreviates hash to 7 chars for display but copies the full hash', async () => {
    const el = (await fixture(
      html`<lyra-commit-card hash="abcdef1234567890" copyable></lyra-commit-card>`,
    )) as LyraCommitCard;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="hash"]')!.textContent!.trim()).to.equal('abcdef1');
    const listener = oneEvent(el, 'lyra-copy');
    (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    const event = (await listener) as CustomEvent<{ text: string }>;
    expect(event.detail.text).to.equal('abcdef1234567890');
  });

  it('splits message into subject (first line) and body (remaining lines)', async () => {
    const el = (await fixture(
      html`<lyra-commit-card message="Fix bug\n\nDetails about the fix"></lyra-commit-card>`,
    )) as LyraCommitCard;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="subject"]')!.textContent).to.equal('Fix bug');
    expect(el.shadowRoot!.querySelector('[part="body"]')!.textContent!.trim()).to.equal('Details about the fix');
  });

  it('renders the aggregate diffstat with a non-color-only accessible label', async () => {
    const el = (await fixture(html`
      <lyra-commit-card
        .files=${[
          { path: 'a.ts', additions: 3, deletions: 1, status: 'modified' },
          { path: 'b.ts', additions: 5, deletions: 0, status: 'added' },
        ]}
      ></lyra-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    const diffstat = el.shadowRoot!.querySelector('[part="diffstat"]')!;
    expect(diffstat.textContent).to.include('8');
    expect(diffstat.textContent).to.include('1');
    expect(diffstat.getAttribute('aria-label')).to.be.a('string').and.not.equal('');
  });

  it('files list starts collapsed and toggles via files-toggle, emitting lyra-toggle', async () => {
    const el = (await fixture(html`
      <lyra-commit-card .files=${[{ path: 'a.ts', additions: 1, deletions: 0 }]}></lyra-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="file"]').length).to.equal(0);
    const toggle = el.shadowRoot!.querySelector('[part="files-toggle"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lyra-toggle');
    toggle.click();
    const event = (await listener) as CustomEvent<{ collapsed: boolean }>;
    expect(event.detail.collapsed).to.be.false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="file"]').length).to.equal(1);
  });

  it('emits lyra-file-select with the path when a file row is activated', async () => {
    const el = (await fixture(html`
      <lyra-commit-card .files=${[{ path: 'a.ts', additions: 1, deletions: 0 }]} .filesCollapsed=${false}></lyra-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="file"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lyra-file-select');
    row.click();
    const event = (await listener) as CustomEvent<{ path: string }>;
    expect(event.detail.path).to.equal('a.ts');
  });

  it('renders a timestamp inside a <time datetime> element', async () => {
    const el = (await fixture(
      html`<lyra-commit-card .timestamp=${1700000000000}></lyra-commit-card>`,
    )) as LyraCommitCard;
    await el.updateComplete;
    const time = el.shadowRoot!.querySelector('[part="time"] time')!;
    expect(time.getAttribute('datetime')).to.be.a('string').and.not.equal('');
  });

  it('is accessible with hash, message, author, timestamp, and files', async () => {
    const el = (await fixture(html`
      <lyra-commit-card
        hash="abcdef1234567890"
        message="Fix bug"
        author="Ada"
        .timestamp=${1700000000000}
        .files=${[{ path: 'a.ts', additions: 1, deletions: 0, status: 'modified' }]}
      ></lyra-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
