import { expect, fixture, html } from '@open-wc/testing';
import { expectValidAriaRules } from '../../../../test/aria-rules.js';
import '../../lr-commit-card.js';
import type { LyraCommitCard } from '../../lr-commit-card.js';

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

it('chooses the file wording from the numeric file count', async () => {
  const card = await fixture<LyraCommitCard>(html`<lr-commit-card
    message="Update components"
    .files=${[{ path: 'one.ts', additions: 3, deletions: 2, status: 'modified' }]}
  ></lr-commit-card>`);
  const summary = () => card.shadowRoot!.querySelector('[part="diffstat"] .sr-only')?.textContent;
  const toggle = () => card.shadowRoot!.querySelector('[part="files-toggle"]')?.textContent?.trim();
  expect(summary()).to.equal('+3 -2 in 1 file');
  expect(toggle()).to.equal('1 changed file');
  card.filesExpanded = true;
  await card.updateComplete;
  expect(toggle()).to.equal('1 changed file');
  card.files = [
    { path: 'one.ts', additions: 3, deletions: 2, status: 'modified' },
    { path: 'two.ts', additions: 1, deletions: 0, status: 'added' },
  ];
  card.filesExpanded = false;
  await card.updateComplete;
  expect(summary()).to.equal('+4 -2 in 2 files');
  expect(toggle()).to.equal('2 changed files');
  card.strings = { commitCardChangedFiles: { one: 'one entry', other: 'several entries' } };
  await card.updateComplete;
  expect(toggle()).to.equal('several entries');
});
