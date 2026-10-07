import { chartSyncStyles } from './chart-sync.styles.js';

const sheets = new WeakMap<Document, CSSStyleSheet>();

/** Installs sync chrome only while a chart belongs to a sync group. */
export function adoptChartSyncStyles(host: HTMLElement): () => void {
  const root = host.shadowRoot;
  if (!root) return () => undefined;
  const doc = host.ownerDocument;
  const ownerWindow = doc.defaultView as (Window & typeof globalThis) | null;
  const Sheet = ownerWindow?.CSSStyleSheet;
  if (Sheet && 'adoptedStyleSheets' in root) {
    try {
      let sheet = sheets.get(doc);
      if (!sheet) {
        sheet = new Sheet();
        sheet.replaceSync(chartSyncStyles.cssText);
        sheets.set(doc, sheet);
      }
      if (!root.adoptedStyleSheets.includes(sheet))
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      return () => {
        root.adoptedStyleSheets = root.adoptedStyleSheets.filter((candidate) => candidate !== sheet);
      };
    } catch {
      // Fall back to Lit's nonce-aware style-element path below.
    }
  }

  const style = doc.createElement('style');
  const nonce = (ownerWindow as (Window & { litNonce?: string }) | null)?.litNonce ??
    (globalThis as typeof globalThis & { litNonce?: string }).litNonce;
  if (nonce) style.setAttribute('nonce', nonce);
  style.textContent = chartSyncStyles.cssText;
  root.append(style);
  return () => style.remove();
}
