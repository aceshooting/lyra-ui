export type { AnchorResultDetail, TextSelectDetail } from '../internal/document-anchors.js';
export type { LyraSearchChangeDetail, LyraTextViewerTargetEventMap } from '../internal/text-viewer-target.js';
export {
  clearEmailDepsCache, getEmailDepsIfLoaded, loadEmailAndSanitizer, loadEmailDeps,
  type EmailDeps, type PostalAddressApi, type PostalAttachmentApi, type PostalMessageApi, type PostalMimeApi,
} from './viewers/email-viewer/email-loader.js';
export * from './viewers/email-viewer/email-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './viewers/email-viewer/email-viewer-register.js';
import { LyraEmailViewer } from './viewers/email-viewer/email-viewer.class.js';
defineElement('email-viewer', LyraEmailViewer);
