import { expect, oneEvent } from '@open-wc/testing';

/** Resolve the structural cell and its separate native action inside a viewer's virtual list. */
export function highlightedCellAction(host: HTMLElement): { cell: HTMLElement; action: HTMLButtonElement; root: ShadowRoot } {
  const list = host.shadowRoot!.querySelector('lr-virtual-list')!;
  const root = list.shadowRoot!;
  const cell = root.querySelector<HTMLElement>('[part~="cell-highlight"]')!;
  expect(cell != null).to.equal(true);
  expect(cell.getAttribute('role')).to.equal('cell');
  expect(cell.hasAttribute('tabindex')).to.be.false;
  const action = cell.querySelector<HTMLButtonElement>('[part="cell-highlight-action"]')!;
  expect(action != null).to.equal(true);
  expect(action.tagName).to.equal('BUTTON');
  return { cell, action, root };
}

export async function assertHighlightedCellActivation(
  host: HTMLElement,
  options: { id: string; name?: string; hitArea?: string },
): Promise<void> {
  const { action } = highlightedCellAction(host);
  if (options.name !== undefined) expect(action.getAttribute('aria-label')).to.equal(options.name);
  if (options.hitArea !== undefined) {
    expect(getComputedStyle(action).minInlineSize).to.equal(options.hitArea);
    expect(getComputedStyle(action).minBlockSize).to.equal(options.hitArea);
  }
  const listener = oneEvent(host, 'lr-highlight-activate');
  action.click();
  const event = (await listener) as CustomEvent<{ highlightId: string }>;
  expect(event.detail).to.deep.equal({ highlightId: options.id });
}
