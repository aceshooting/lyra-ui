import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

let papa: Promise<OptionalPeerApi | null> | undefined;

export async function loadPapaParseDeps(
  importPapaparse: () => Promise<{ default: OptionalPeerApi }> = () =>
    import('papaparse') as Promise<{ default: OptionalPeerApi }>,
): Promise<OptionalPeerApi | null> {
  try {
    return (await importPapaparse()).default;
  } catch (error) {
    console.warn(
      '<lyra-dataset-viewer> needs the optional peer dependency `papaparse` to parse delimited text — install it with `pnpm add papaparse`:',
      error,
    );
    return null;
  }
}

export function loadPapaParse(): Promise<OptionalPeerApi | null> {
  if (!papa) papa = loadPapaParseDeps();
  return papa;
}

export function clearPapaParseCache(): void {
  papa = undefined;
}
