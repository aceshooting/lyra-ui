import type { DocxPaintDetail, DocxRevision } from './types.js';

const pageSelector = '.docx-page[data-page-index]';
const paintedSelector = pageSelector + '[data-materialized="true"]';
const paragraphSelector = ':scope > .docx-page-content > .docx-paragraph-fragment';

/** Decorate materialized body paragraphs before publishing a coalesced paint notification. */
export function observeParagraphPaint(mount: HTMLElement, revision: DocxRevision,
  readIndexes: () => ReadonlyMap<string, number> | null, notify: (detail: DocxPaintDetail) => void) {
  const view = mount.ownerDocument.defaultView!;
  const pending = new Set<Element>();
  const affected = new Set<number>();
  let frame: number | null = null, active = true;
  let indexes: ReadonlyMap<string, number> | null = null, refreshIndexes = true;
  const addIndex = (value: string | null) => {
    if (value === null || value === '') return;
    const index = Number(value);
    if (Number.isSafeInteger(index) && index >= 0) affected.add(index);
  };
  const add = (page: Element) => {
    addIndex(page.getAttribute('data-page-index'));
    if (mount.contains(page)) pending.add(page);
    else pending.delete(page);
  };
  const flush = () => {
    frame = null;
    if (!active || (!pending.size && !affected.size)) return;
    if (refreshIndexes) { indexes = readIndexes(); refreshIndexes = false; }
    for (const page of pending) {
      if (!mount.contains(page) || !page.matches(paintedSelector)) continue;
      for (const fragment of page.querySelectorAll(paragraphSelector)) {
        const paragraphId = fragment.getAttribute('data-paragraph-id');
        const index = paragraphId ? indexes?.get(paragraphId) : undefined;
        const value = index === undefined ? null : String(index);
        if (fragment.getAttribute('data-lr-block-index') === value) continue;
        if (value === null) fragment.removeAttribute('data-lr-block-index');
        else fragment.setAttribute('data-lr-block-index', value);
        addIndex(page.getAttribute('data-page-index'));
      }
    }
    const pageIndexes = [...affected].sort((a, b) => a - b);
    pending.clear();
    affected.clear();
    if (active && pageIndexes.length) notify(Object.freeze({ revision, pageIndexes: Object.freeze(pageIndexes) }));
  };
  const schedule = () => {
    if ((pending.size || affected.size) && frame === null) frame = view.requestAnimationFrame(flush);
  };
  const collect = (node: Node) => {
    if (!(node instanceof view.Element)) return;
    if (node.matches(paintedSelector)) add(node);
    else for (const page of node.querySelectorAll(paintedSelector)) add(page);
  };
  const observer = new view.MutationObserver(records => {
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
      if (record.attributeName === 'data-page-index' && target?.matches('.docx-page')) addIndex(record.oldValue);
      const page = target?.closest(pageSelector);
      if (page) {
        add(page);
        continue;
      }
      for (const removed of record.removedNodes) collect(removed);
      for (const added of record.addedNodes) collect(added);
    }
    schedule();
  });
  observer.observe(mount, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeOldValue: true, attributeFilter: ['data-materialized', 'data-page-index', 'data-paragraph-id'] });
  const refresh = (next: DocxRevision) => {
    revision = next;
    refreshIndexes = true;
    // Unchanged page nodes can keep their paragraph identities while an earlier edit shifts their indexes.
    for (const page of mount.querySelectorAll(paintedSelector)) pending.add(page);
    schedule();
  };
  for (const page of mount.querySelectorAll(paintedSelector)) add(page);
  schedule();
  return {
    refresh,
    disconnect() {
      active = false;
      observer.disconnect();
      if (frame !== null) view.cancelAnimationFrame(frame);
      pending.clear();
      affected.clear();
    },
  };
}
