import { expect } from '@open-wc/testing';

/** Checks the selected ARIA rules, including results that need manual review. */
export async function expectValidAriaRules(element: Element, rules: readonly string[]): Promise<void> {
  await expect(element).to.be.accessible({ ignoredRules: [...rules] });
  const axe = (window as Window & { axe?: typeof import('axe-core') }).axe;
  if (!axe) throw new Error('The accessibility scan must load axe before checking ARIA rules.');
  const results = await axe.run(element, { runOnly: [...rules] });
  for (const kind of ['violations', 'incomplete'] as const) {
    const findings = results[kind].flatMap((result) => result.nodes.map((node) => `${result.id}: ${JSON.stringify(node.target)}`));
    expect(findings, kind).to.deep.equal([]);
  }
}
