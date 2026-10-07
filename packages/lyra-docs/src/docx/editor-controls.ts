/** Controls that only render once a document is open; the registration entry supplies their loaders. */
const loaders = new Map<string, () => Promise<unknown>>();

export function provideDocumentControls(entries: Readonly<Record<string, () => Promise<unknown>>>): void {
  for (const [name, load] of Object.entries(entries)) loaders.set(name, load);
}

export function loadDocumentControls(...names: string[]): Promise<unknown> {
  return Promise.all(names.map(name => {
    const load = loaders.get(name);
    loaders.delete(name);
    return load?.().catch(() => undefined);
  }));
}
