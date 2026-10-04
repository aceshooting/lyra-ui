import type { ImageInsertionProfileDependencies } from './eigenpal-image-insertion-profile.js';
import type { OoxmlNode } from '@docx-editor.dev/core/store';

type Store = typeof import('@docx-editor.dev/core/store');
export interface ImageInsertionEngine extends ImageInsertionProfileDependencies {
  readonly TreePackageStore: Store['TreePackageStore'];
  readonly writeOoxmlPackage: Store['writeOoxmlPackage'];
  readonly readZip: Store['readZip'];
}
export function deriveImageInsertionEngine(blank: () => Uint8Array,
  store: Pick<Store, 'readZip' | 'readOoxmlPart' | 'TreePackageStore' | 'writeOoxmlPackage'>): ImageInsertionEngine | undefined {
  try {
    if (![blank, store.readZip, store.readOoxmlPart, store.TreePackageStore, store.writeOoxmlPackage].every(value => typeof value === 'function')) return undefined;
    const bytes = blank(); if (bytes.length > 65536) return undefined;
    const zip = store.readZip(bytes); if (!zip.ok) return undefined;
    const styles = zip.entries.get('/word/styles.xml'); if (!styles || styles.length > 32768) return undefined;
    const parsed = store.readOoxmlPart(new TextDecoder('utf-8', { fatal: true }).decode(styles),
      { name: '/word/styles.xml', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml' },
      { maxBytes: 32768, maxElements: 1024 });
    if (!parsed.ok) return undefined;
    const stack: { node: OoxmlNode; depth: number }[] = [{ node: parsed.part.root, depth: 0 }];
    const seen = new Set<OoxmlNode>();
    while (stack.length) {
      const { node, depth } = stack.pop()!;
      if (seen.has(node) || seen.size >= 1024 || depth > 32) return undefined;
      seen.add(node);
      if (node.kind === 'textValue') continue;
      if (node.attributes.length > 64 || Object.keys(node.namespaceBindings).length > 16 ||
          node.children.length > 1024 - seen.size - stack.length) return undefined;
      for (const child of node.children) stack.push({ node: child, depth: depth + 1 });
    }
    return Object.freeze({ defaultStylesPart: parsed.part, readOoxmlPart: store.readOoxmlPart,
      TreePackageStore: store.TreePackageStore, writeOoxmlPackage: store.writeOoxmlPackage, readZip: store.readZip });
  } catch { return undefined; }
}
