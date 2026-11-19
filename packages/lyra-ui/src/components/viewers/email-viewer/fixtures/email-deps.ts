import { __setDompurifyImporterForTesting } from '../../../../internal/dompurify-loader.js';
import { clearEmailDepsCache, postalMime, type EmailDeps } from '../email-loader.js';

export function setEmailDeps(deps?: EmailDeps): void {
  clearEmailDepsCache();
  postalMime.override(deps && (() => Promise.resolve(deps.PostalMime)));
  __setDompurifyImporterForTesting(deps && (() => Promise.resolve(deps.DOMPurify)));
}
