/** A `matchMedia` that reports `(forced-colors: active)` and defers every other query. */
export function forcedColorsMatchMedia(original: typeof window.matchMedia): typeof window.matchMedia {
  return ((query: string) => {
    if (query !== '(forced-colors: active)') return original(query);
    return {
      matches: true,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    };
  }) as typeof window.matchMedia;
}
