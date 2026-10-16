import { expect } from '@open-wc/testing';
import { accessibleName } from './accessible-name.js';

export interface ReviewedLabel {
  /** The exact control whose additional content is not its visible label. */
  target: Element;
  /** Visible label nodes, in their rendered reading order. */
  label: readonly Element[];
  /** Why the remaining content is descriptive, symbolic, or excluded from rendering. */
  reason: string;
}

/** Finds explicitly reviewed controls through composed component shadow roots. */
export function reviewComponentLabels(
  root: Element, tag: string, control: string, label: string, reason: string,
): ReviewedLabel[] {
  const reviews: ReviewedLabel[] = [];
  const collect = (scope: ShadowRoot): void => {
    for (const target of scope.querySelectorAll(control)) {
      reviews.push({ target, label: [...target.querySelectorAll(label)], reason });
    }
    for (const descendant of scope.querySelectorAll('*')) {
      if (descendant.shadowRoot) collect(descendant.shadowRoot);
    }
  };
  const visit = (element: Element): void => {
    if (element.localName === tag && element.shadowRoot) {
      collect(element.shadowRoot);
    }
    for (const child of element.children) visit(child);
    if (element.shadowRoot) for (const child of element.shadowRoot.children) visit(child);
  };
  visit(root);
  return reviews;
}

const words = (text: string): string => text.normalize('NFKD').toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Rechecks the label-in-name rule after an ordinary scan that ignores only that rule.
 * ACT 2ee8b8 assumes all visible inner text is a label. Reviewed descriptions and
 * symbolic content can violate that assumption; exact controls still have to retain
 * their visible label in their computed name. Unreviewed violations always fail.
 * https://www.w3.org/WAI/standards-guidelines/act/rules/2ee8b8/proposed/#assumptions
 */
export async function expectLabelInName(element: Element, reviews: readonly ReviewedLabel[]): Promise<void> {
  const axe = (window as Window & { axe?: typeof import('axe-core') }).axe;
  if (!axe) throw new Error('Run the ordinary accessibility assertion before reviewing labels.');
  const results = await axe.run(element, {
    runOnly: ['label-content-name-mismatch'],
    elementRef: true,
  });
  const reviewed = new Set<Element>();
  for (const review of reviews) {
    expect(review.reason.trim().length, 'A label review needs a reason').to.be.greaterThan(0);
    expect(review.target.isConnected, review.reason).to.equal(true);
    expect(review.label.length, review.reason).to.be.greaterThan(0);
    for (const node of review.label) {
      expect(node.getClientRects().length, `${review.reason}: label must be rendered`).to.be.greaterThan(0);
      expect(getComputedStyle(node).visibility, `${review.reason}: label must be visible`).to.equal('visible');
    }
    const label = words(review.label.map((node) => node.textContent ?? '').join(' '));
    expect(label.length, review.reason).to.be.greaterThan(0);
    const name = words(accessibleName(review.target));
    expect(` ${name} `.includes(` ${label} `), `${review.reason}: visible label "${label}" in name "${name}"`).to.equal(true);
    reviewed.add(review.target);
  }
  const failures = results.violations.flatMap((result) => result.nodes
    .filter((node) => !node.element || !reviewed.has(node.element))
    .map((node) => `${result.id}: ${JSON.stringify(node.target)}`));
  expect(failures, 'Unreviewed label-in-name violations').to.deep.equal([]);
}
