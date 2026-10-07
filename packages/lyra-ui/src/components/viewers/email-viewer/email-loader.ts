import { loadDompurify } from '../../../internal/dompurify-loader.js';
import {
  createOptionalPeerLoader,
  type HtmlSanitizer,
} from '../../../internal/optional-peer-capabilities.js';

export interface PostalAddressApi {
  name?: string;
  address?: string;
  group?: PostalAddressApi[];
}

export interface PostalAttachmentApi {
  filename?: string | null;
  mimeType?: string;
  content: ArrayBuffer | Uint8Array | string;
}

export interface PostalMessageApi {
  html?: string;
  text?: string;
  from?: PostalAddressApi;
  to?: PostalAddressApi[];
  subject?: string;
  date?: string;
  attachments?: PostalAttachmentApi[];
}

export interface PostalMimeApi {
  parse(input: ArrayBuffer): Promise<PostalMessageApi>;
}

function isPostalMimeApi(value: unknown): value is PostalMimeApi {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'parse' in value &&
    typeof value.parse === 'function'
  );
}

export interface EmailDeps {
  PostalMime: PostalMimeApi | undefined;
  DOMPurify: HtmlSanitizer | undefined;
}

const postalMime = /* @__PURE__ */ createOptionalPeerLoader<PostalMimeApi>({
  load: () => import('postal-mime'),
  isCapability: isPostalMimeApi,
  warningKey: 'lyra-email-viewer-postal-mime-unavailable',
  warning: '<lr-email-viewer> could not load its optional postal-mime peer.',
});

let depsPromise: Promise<EmailDeps> | undefined;
let resolvedDeps: EmailDeps | undefined;

/** Loads both peers in parallel; a missing one resolves `undefined`. */
export async function loadEmailAndSanitizer(
  importPostalMime?: () => Promise<unknown>,
  importDompurify?: () => Promise<unknown>,
): Promise<EmailDeps> {
  const [PostalMime, DOMPurify] = await Promise.all([
    importPostalMime ? postalMime.loadWith(importPostalMime) : postalMime.get(),
    loadDompurify(importDompurify),
  ]);
  return { PostalMime: PostalMime ?? undefined, DOMPurify: DOMPurify ?? undefined };
}

/** Shared load; only a complete result is kept, so a missing peer is retried by the next call. */
export function loadEmailDeps(): Promise<EmailDeps> {
  depsPromise ??= loadEmailAndSanitizer().then((result) => {
    if (!result.PostalMime || !result.DOMPurify) depsPromise = undefined;
    resolvedDeps = result;
    return result;
  });
  return depsPromise;
}

export function getEmailDepsIfLoaded(): EmailDeps | undefined {
  return resolvedDeps;
}

export function clearEmailDepsCache(): void {
  depsPromise = undefined;
  resolvedDeps = undefined;
  postalMime.clear();
}

/** @internal test-only hook to force a specific resolved dependency set (e.g. simulate a missing optional peer); pass `undefined` to reset to the real loader. */
export function __setEmailDepsForTesting(deps: EmailDeps | undefined): void {
  depsPromise = deps === undefined ? undefined : Promise.resolve(deps);
  resolvedDeps = deps;
}
