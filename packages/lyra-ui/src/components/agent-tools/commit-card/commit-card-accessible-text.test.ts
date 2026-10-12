import { expect, fixture, html } from '@open-wc/testing';
import { expectValidAriaRules } from '../../../../test/aria-rules.js';
import './commit-card.js';
import type { LyraCommitCard } from './commit-card.js';

it('exposes a localized diff summary as text without naming a generic span', async () => {
  const card = await fixture<LyraCommitCard>(html`<lr-commit-card
    message="Update components"
    .files=${[{ path: 'one.ts', additions: 3, deletions: 2, status: 'modified' }]}
    .strings=${{ commitCardDiffSummary: '{additions} added; {deletions} removed; {files} files' }}
  ></lr-commit-card>`);
  const summary = card.shadowRoot!.querySelector<HTMLElement>('[part="diffstat"]')!;
  expect(summary.textContent).to.include('3');
  await expectValidAriaRules(card, ['aria-prohibited-attr']);
  expect(summary.querySelector('.sr-only')?.textContent).to.equal('3 added; 2 removed; 1 files');
  expect(summary.querySelector('[part="additions"]')?.textContent).to.equal('+3');
  expect(summary.querySelector('[part="deletions"]')?.textContent).to.equal('-2');
  card.files = [];
  await card.updateComplete;
  expect(card.shadowRoot!.querySelector('[part="diffstat"]') === null).to.equal(true);
});

it('keeps expanded file status wording in the button content without naming a generic child', async () => {
  const card = await fixture<LyraCommitCard>(html`<lr-commit-card files-expanded
    .files=${[
      { path: 'one.ts', status: 'modified' },
      { path: 'two.ts', status: 'added' },
    ]}
    .strings=${{ gitStatusModified: 'Changed file', gitStatusAdded: 'New file' }}
  ></lr-commit-card>`);
  const statuses = Array.from(card.shadowRoot!.querySelectorAll<HTMLElement>('[part="file-status"]'));
  expect(statuses.length).to.equal(2);
  expect(statuses.map((status) => status.hasAttribute('aria-label'))).to.deep.equal([false, false]);
  expect(statuses.map((status) => status.querySelector('.sr-only')?.textContent)).to.deep.equal(['Changed file', 'New file']);
  expect(statuses.map((status) => status.querySelector('[aria-hidden="true"]')?.textContent)).to.deep.equal(['M', 'A']);
  await expectValidAriaRules(card, ['aria-prohibited-attr']);
});
