/** The first mounted element under `root` whose `data-source-key` equals `key` literally, so selector
 *  punctuation, quotes and whitespace in a caller key never need escaping. */
export function findSourceRow<T extends HTMLElement = HTMLElement>(root: ParentNode, key: string): T | undefined {
  for (const row of root.querySelectorAll<T>('[data-source-key]')) {
    if (row.getAttribute('data-source-key') === key) return row;
  }
  return undefined;
}
