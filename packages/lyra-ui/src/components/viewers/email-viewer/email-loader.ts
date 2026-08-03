import {
  isHtmlSanitizer,
  resolveOptionalPeerCapability,
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

let depsPromise: Promise<EmailDeps> | undefined;
let resolvedDeps: EmailDeps | undefined;

export async function loadEmailAndSanitizer(
  importPostalMime: () => Promise<unknown> = () => import('postal-mime'),
  importDompurify: () => Promise<unknown> = () => import('dompurify'),
): Promise<EmailDeps> {
  let PostalMime: PostalMimeApi | undefined;
  try {
    PostalMime = resolveOptionalPeerCapability(await importPostalMime(), isPostalMimeApi) ?? undefined;
  } catch (error) {
    console.warn(
      '<lr-email-viewer> needs the optional peer dependency `postal-mime` to parse .eml messages — install it with `pnpm add postal-mime`:',
      error,
    );
  }

  let DOMPurify: HtmlSanitizer | undefined;
  try {
    DOMPurify = resolveOptionalPeerCapability(await importDompurify(), isHtmlSanitizer) ?? undefined;
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
