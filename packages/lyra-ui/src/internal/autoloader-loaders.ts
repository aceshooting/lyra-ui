import {
  AUTOLOADER_MANIFEST,
  type AutoloaderManifestEntry,
} from './autoloader-manifest.js';
import type { AutoloadableTagName } from './autoloader-tags.js';

const constructorLoads = new Map<AutoloadableTagName, Promise<CustomElementConstructor>>();
const loaderOverrides = new Map<AutoloadableTagName, AutoloaderManifestEntry['load']>();

export function loadAutoloaderConstructor(
  tag: AutoloadableTagName,
): Promise<CustomElementConstructor> {
  const existing = constructorLoads.get(tag);
  if (existing) return existing;
  const loader = loaderOverrides.get(tag) ?? AUTOLOADER_MANIFEST[tag].load;
  const pending = Promise.resolve().then(loader);
  constructorLoads.set(tag, pending);
  void pending.catch(() => {
    if (constructorLoads.get(tag) === pending) constructorLoads.delete(tag);
  });
  return pending;
}

/** Test seam for rejected-import retry coverage; not exposed through a package export. */
export function setAutoloaderLoaderForTesting(
  tag: AutoloadableTagName,
  loader: AutoloaderManifestEntry['load'] | undefined,
): void {
  constructorLoads.delete(tag);
  if (loader) loaderOverrides.set(tag, loader);
  else loaderOverrides.delete(tag);
}
