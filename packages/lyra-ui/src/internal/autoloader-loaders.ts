import { AUTOLOADER_TAG_SET, type AutoloadableTagName } from './autoloader-tags.js';
import { COMPONENT_LOADERS } from './component-loaders.generated.js';

type AutoloaderLoader = () => Promise<CustomElementConstructor>;

const constructorLoads = new Map<AutoloadableTagName, Promise<CustomElementConstructor>>();
const loaderOverrides = new Map<AutoloadableTagName, AutoloaderLoader>();

export function loadAutoloaderConstructor(
  tag: AutoloadableTagName,
): Promise<CustomElementConstructor> {
  const existing = constructorLoads.get(tag);
  if (existing) return existing;
  const loader = loaderOverrides.get(tag) ?? COMPONENT_LOADERS[tag];
  const pending = Promise.resolve().then(loader);
  constructorLoads.set(tag, pending);
  void pending.catch(() => {
    if (constructorLoads.get(tag) === pending) constructorLoads.delete(tag);
  });
  return pending;
}

type DefinitionClosures = Readonly<Record<string, readonly string[]>>;
let definitionClosures: Promise<DefinitionClosures> | undefined;
let definitionChildrenEnabled = true;

/**
 * The composed children a tag's registration entry defines along with it, leaves first, without
 * the tag itself. The table covers every tag, so it loads on the first definition rather than
 * with the autoloader; a failed load yields no children and retries on the next definition.
 */
export async function autoloaderDefinitionChildren(
  tag: AutoloadableTagName,
): Promise<readonly AutoloadableTagName[]> {
  if (!definitionChildrenEnabled) return [];
  definitionClosures ??= import('./scoped-definitions.generated.js').then(
    (module) => module.scopedDefinitionClosures,
    () => {
      definitionClosures = undefined;
      return {};
    },
  );
  const closures = await definitionClosures;
  const size = (name: string): number => closures[name]?.length ?? 0;
  return (closures[tag] ?? [])
    .filter((name): name is AutoloadableTagName => name !== tag && AUTOLOADER_TAG_SET.has(name))
    .sort((a, b) => size(a) - size(b));
}

/** Test seam for rejected-import retry coverage; not exposed through a package export. */
export function setAutoloaderLoaderForTesting(
  tag: AutoloadableTagName,
  loader: AutoloaderLoader | undefined,
): void {
  constructorLoads.delete(tag);
  if (loader) loaderOverrides.set(tag, loader);
  else loaderOverrides.delete(tag);
}

/**
 * Test seam: suites that define stand-in hosts in the global registry turn child definition off so
 * a host's real composed children do not leak into later cases; not exposed through a package export.
 */
export function setAutoloaderDefinitionChildrenForTesting(enabled: boolean): void {
  definitionChildrenEnabled = enabled;
}
