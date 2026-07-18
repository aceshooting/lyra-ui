import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

export interface EmailDeps {
  PostalMime: OptionalPeerApi | undefined;
  DOMPurify: OptionalPeerApi | undefined;
}

let depsPromise: Promise<EmailDeps> | undefined;
let resolvedDeps: EmailDeps | undefined;

export async function loadEmailAndSanitizer(
  importPostalMime: () => Promise<OptionalPeerApi> = () => import('postal-mime') as Promise<OptionalPeerApi>,
  importDompurify: () => Promise<OptionalPeerApi> = () => import('dompurify') as Promise<OptionalPeerApi>,
): Promise<EmailDeps> {
  let PostalMime: OptionalPeerApi | undefined;
  try {
    const module = await importPostalMime();
    PostalMime = module.default ?? module;
  } catch (error) {
    console.warn(
      '<lr-email-viewer> needs the optional peer dependency `postal-mime` to parse .eml messages — install it with `pnpm add postal-mime`:',
      error,
    );
  }

  let DOMPurify: OptionalPeerApi | undefined;
  try {
    const module = await importDompurify();
    DOMPurify = module.default ?? module;
  } catch (error) {
    console.warn(
      '<lr-email-viewer> needs the optional peer dependency `dompurify` to sanitize HTML message bodies — install it with `pnpm add dompurify`:',
      error,
    );
  }
  return { PostalMime, DOMPurify };
}

export function loadEmailDeps(): Promise<EmailDeps> {
  if (!depsPromise) {
    depsPromise = loadEmailAndSanitizer().then((result) => {
      resolvedDeps = result;
      return result;
    });
  }
  return depsPromise;
}

export function getEmailDepsIfLoaded(): EmailDeps | undefined {
  return resolvedDeps;
}

export function clearEmailDepsCache(): void {
  depsPromise = undefined;
  resolvedDeps = undefined;
}

/** @internal test-only hook to force a specific resolved dependency set (e.g. simulate a missing optional peer); pass `undefined` to reset to the real loader. */
export function __setEmailDepsForTesting(deps: EmailDeps | undefined): void {
  depsPromise = deps === undefined ? undefined : Promise.resolve(deps);
  resolvedDeps = deps;
}
