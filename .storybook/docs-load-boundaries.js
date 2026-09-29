/** Keep editable docs' lazy roots separate from their concurrent module preload. */
export function builderModulePreload(options, catalogNames = []) {
  if (options === false) return false;
  const existing = options && typeof options === 'object' ? options : {};
  return {
    ...existing,
    resolveDependencies(filename, dependencies, context) {
      const resolved = existing.resolveDependencies
        ? existing.resolveDependencies(filename, dependencies, context)
        : dependencies;
      // WebKit can retain a failed root module when preload and import race. Shared
      // dependencies and CSS still preload; unrelated imports keep Vite's behavior.
      const builderRoot = /(?:^|\/)ThemeBuilder\.stories(?:-[^/]+)?\.js$/.test(context.hostId) &&
        /(?:^|\/)view(?:-[^/]+)?\.js$/.test(filename);
      const basename = filename.slice(filename.lastIndexOf('/') + 1);
      const catalogRoot = /(?:^|\/)locale-loader(?:-[^/]+)?\.js$/.test(context.hostId) &&
        catalogNames.some(name => basename === `${name}.js` ||
          // The docs build uses Vite's eight-character content hash. A longer
          // suffix can name another catalog, rather than this catalog's chunk.
          (basename.startsWith(`${name}-`) && /^[\w-]{8}\.js$/.test(basename.slice(name.length + 1))));
      if (context.hostType === 'js' && (builderRoot || catalogRoot)) {
        return resolved.filter(dependency => dependency !== filename);
      }
      return resolved;
    },
  };
}

/** These modules must follow their import edges instead of the eager component chunk. */
export function isDeferredLocaleModule(id) {
  const normalized = id.replaceAll('\\', '/').split('?')[0];
  const marker = '/packages/lyra-ui/src/';
  const start = normalized.indexOf(marker);
  if (start === -1) return false;
  const relative = normalized.slice(start + marker.length);
  return relative.startsWith('translations/') || relative === 'locale-loader.ts' ||
    relative === 'internal/locale-loader.ts' || relative === 'internal/locale-loaders.generated.ts';
}

const builderStories = new Set([
  'theming-theme-builder--editor',
  'theming-theme-builder--rtl',
  'theming-theme-builder--long-labels',
]);

function hasEditableBuilder(view) {
  // Storybook updates the iframe URL before loading an incoming story, while the
  // outgoing story's DOM may still be connected.
  const selection = new URL(view.location.href).searchParams;
  if (!builderStories.has(selection.get('id')) || (selection.get('viewMode') ?? 'story') !== 'story') return false;
  return Array.from(view.document.querySelectorAll('[data-theme-builder]')).some(host =>
    host.isConnected && typeof host.themeBuilder?.change === 'function' && host.querySelector('.tb-builder'));
}

/** Recover stale deployment chunks once, preserving a mounted editor's local recovery. */
export function installDocsPreloadRecovery(view) {
  const recover = () => {
    if (hasEditableBuilder(view)) return;
    const key = 'lr-docs-reloaded-after-preload-error';
    if (!view.sessionStorage.getItem(key)) {
      view.sessionStorage.setItem(key, '1');
      view.location.reload();
    }
    // Do not preventDefault: the failed import must still reject for its caller.
  };
  view.addEventListener('vite:preloadError', recover);
  return () => view.removeEventListener('vite:preloadError', recover);
}
