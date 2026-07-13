/**
 * The message keys used by Lyra's built-in labels. Applications can register
 * additional keys as well; components may use a component-specific key when
 * a message is not part of this common set.
 */
export type LyraMessageKey =
  | 'noData'
  | 'noColumns'
  | 'loadMore'
  | 'showAllColumns'
  | 'showFewerColumns'
  | 'clear'
  | 'openCalendar'
  | 'open'
  | 'close'
  | 'closeNavigation'
  | 'openNavigation'
  | 'resizeNavigation'
  | 'copy'
  | 'copyJson'
  | 'copied'
  | 'expand'
  | 'collapse'
  | 'expandMessage'
  | 'collapseMessage'
  | 'showMore'
  | 'showMoreCount'
  | 'showLess'
  | 'retry'
  | 'remove'
  | 'loading'
  | 'loadingDocument'
  | 'noMatches'
  | 'previous'
  | 'next'
  | 'cancel'
  | 'confirm'
  | 'search'
  | 'circularReference'
  | 'items'
  | 'item'
  | 'keys'
  | 'key'
  | 'trendOf'
  | 'wordCloud'
  | 'notInCatalog'
  | 'sendMessage'
  | 'stopGenerating'
  | 'dropzoneReleaseToAdd'
  | 'dropzoneRejectedType'
  | 'fileSizeUnitB'
  | 'fileSizeUnitKb'
  | 'fileSizeUnitMb'
  | 'fileSizeUnitGb'
  | 'fileSizeUnitTb'
  | 'chartCategory'
  | 'chartPointLabel'
  | 'resetZoom'
  | 'chatSending'
  | 'chatResponding'
  | 'chatFailedToSend'
  | 'chatFailedAnnounce'
  | 'chatCompleteAnnounce'
  | 'showMoreCollapsed'
  | 'expandCode'
  | 'collapseCode'
  | 'copyCode'
  | 'copiedToClipboard'
  | 'codeRegion'
  | 'codeRegionWithLanguage'
  | 'copyDiff'
  | 'jsonArray'
  | 'jsonObject'
  | 'jsonValue'
  | 'untitledSource'
  | 'sourcePageSuffix'
  | 'toolCall'
  | 'statusPending'
  | 'statusRunning'
  | 'statusSuccess'
  | 'statusError'
  | 'statusDenied'
  | 'maximize'
  | 'restore'
  | 'wordCloudWord'
  | 'wordCloudWords'
  | 'pollPause'
  | 'pollResume'
  | 'pollRefreshing'
  | 'pollPaused'
  | 'pollPausedAnnounce'
  | 'pollResumedAnnounce'
  | 'pollRefreshingAnnounce'
  | 'attachmentAdd'
  | 'attachmentTriggerFiles'
  | 'attachmentTriggerImage'
  | 'attachmentTriggerCamera'
  | 'attachmentMenuFiles'
  | 'attachmentMenuImage'
  | 'attachmentMenuCamera'
  | 'checkboxRequired'
  | 'switchRequired'
  | 'citationHighConfidence'
  | 'citationMediumConfidence'
  | 'citationLowConfidence'
  | 'citationVerified'
  | 'citationUnverified'
  | 'contextMeterUsed'
  | 'contextMeterUsedOfTotal'
  | 'untitledConversation'
  | 'dockPanelCollapse'
  | 'dockPanelExpand'
  | 'dockPanelResize'
  | 'documentPreviewAlt'
  | 'documentPreviewUrlNotAllowed'
  | 'documentPreviewFailedToLoad'
  | 'documentPreviewGenericError'
  | 'exportButtonLabel'
  | 'generationStatusToken'
  | 'generationStatusTokens';

export type LyraLocaleStrings = Partial<Record<LyraMessageKey, string>> & Record<string, string | undefined>;

const DEFAULT_STRINGS: Record<LyraMessageKey, string> = {
  noData: 'No data',
  noColumns: 'No columns configured',
  loadMore: 'Load more',
  showAllColumns: 'Show all columns',
  showFewerColumns: 'Show fewer columns',
  clear: 'Clear',
  openCalendar: 'Open calendar',
  open: 'Open',
  close: 'Close',
  closeNavigation: 'Close navigation',
  openNavigation: 'Open navigation',
  resizeNavigation: 'Resize navigation',
  copy: 'Copy',
  copyJson: 'Copy JSON to clipboard',
  copied: 'Copied!',
  expand: 'Expand',
  collapse: 'Collapse',
  expandMessage: 'Expand message',
  collapseMessage: 'Collapse message',
  showMore: 'Show more',
  showMoreCount: 'Show {count} more',
  showLess: 'Show less',
  retry: 'Retry',
  remove: 'Remove',
  loading: 'Loading…',
  loadingDocument: 'Loading document…',
  noMatches: 'No matches',
  previous: 'Previous',
  next: 'Next',
  cancel: 'Cancel',
  confirm: 'Confirm',
  search: 'Search',
  circularReference: 'Circular reference',
  items: 'items',
  item: 'item',
  keys: 'keys',
  key: 'key',
  trendOf: 'Trend of {count} values, last {value}',
  wordCloud: 'Word cloud of {count} {word}',
  notInCatalog: 'not in catalog',
  sendMessage: 'Send message',
  stopGenerating: 'Stop generating',
  dropzoneReleaseToAdd: 'Release to add the file.',
  dropzoneRejectedType: 'This file type is not accepted.',
  fileSizeUnitB: 'B',
  fileSizeUnitKb: 'KB',
  fileSizeUnitMb: 'MB',
  fileSizeUnitGb: 'GB',
  fileSizeUnitTb: 'TB',
  chartCategory: 'Category',
  chartPointLabel: 'Point {n}',
  resetZoom: 'Reset zoom',
  chatSending: 'Sending…',
  chatResponding: 'Responding…',
  chatFailedToSend: 'Failed to send',
  chatFailedAnnounce: 'Message failed to send.',
  chatCompleteAnnounce: 'Message complete.',
  showMoreCollapsed: '+{count}',
  expandCode: 'Expand code',
  collapseCode: 'Collapse code',
  copyCode: 'Copy code',
  copiedToClipboard: 'Copied! to clipboard',
  codeRegion: 'Code',
  codeRegionWithLanguage: '{language} code',
  copyDiff: 'Copy diff',
  jsonArray: 'array',
  jsonObject: 'object',
  jsonValue: 'value',
  untitledSource: 'Untitled source',
  sourcePageSuffix: '{base} — p. {page}',
  toolCall: 'Tool call',
  statusPending: 'Pending',
  statusRunning: 'Running',
  statusSuccess: 'Success',
  statusError: 'Error',
  statusDenied: 'Denied',
  maximize: 'Maximize',
  restore: 'Restore',
  wordCloudWord: 'word',
  wordCloudWords: 'words',
  pollPause: 'Pause',
  pollResume: 'Resume',
  pollRefreshing: 'Refreshing…',
  pollPaused: 'Paused',
  pollPausedAnnounce: 'Paused.',
  pollResumedAnnounce: 'Resumed.',
  pollRefreshingAnnounce: 'Refreshing now.',
  attachmentAdd: 'Add attachment',
  attachmentTriggerFiles: 'Attach files',
  attachmentTriggerImage: 'Attach an image',
  attachmentTriggerCamera: 'Use camera',
  attachmentMenuFiles: 'Upload files',
  attachmentMenuImage: 'Upload a photo',
  attachmentMenuCamera: 'Take a photo',
  checkboxRequired: 'Please check this box if you want to continue.',
  switchRequired: 'Please turn this on.',
  citationHighConfidence: 'High confidence',
  citationMediumConfidence: 'Medium confidence',
  citationLowConfidence: 'Low confidence',
  citationVerified: 'Verified',
  citationUnverified: 'Unverified',
  contextMeterUsed: '{used} used',
  contextMeterUsedOfTotal: '{used} of {total} used',
  untitledConversation: 'Untitled conversation',
  dockPanelCollapse: 'Collapse panel',
  dockPanelExpand: 'Expand panel',
  dockPanelResize: 'Resize panel',
  documentPreviewAlt: 'Document preview',
  documentPreviewUrlNotAllowed: 'Document URL is not allowed.',
  documentPreviewFailedToLoad: 'Failed to load document.',
  documentPreviewGenericError: 'Something went wrong.',
  exportButtonLabel: 'Export',
  generationStatusToken: 'token',
  generationStatusTokens: 'tokens',
};

const locales = new Map<string, LyraLocaleStrings>();
const listeners = new Set<() => void>();
let activeLocale = '';

function normalizeLocale(locale: string): string {
  return locale.trim().replace(/_/g, '-').toLowerCase();
}

function localeCandidates(locale: string): string[] {
  const normalized = normalizeLocale(locale);
  const candidates: string[] = [];
  if (normalized) candidates.push(normalized);
  const language = normalized.split('-')[0];
  if (language && language !== normalized) candidates.push(language);
  if (!candidates.includes('en')) candidates.push('en');
  return candidates;
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** Register or extend messages for a locale. */
export function registerLyraLocale(locale: string, strings: LyraLocaleStrings): void {
  const key = normalizeLocale(locale);
  if (!key) throw new TypeError('A locale is required.');
  locales.set(key, { ...(locales.get(key) ?? {}), ...strings });
  if (normalizeLocale(activeLocale) === key || normalizeLocale(activeLocale).startsWith(`${key}-`)) notify();
}

/** Set the page-level locale used by Lyra components without an explicit locale. */
export function setLyraLocale(locale: string): void {
  const next = locale.trim();
  if (activeLocale === next) return;
  activeLocale = next;
  notify();
}

/** Return the current page-level locale. */
export function getLyraLocale(): string {
  return activeLocale;
}

/** Subscribe to locale changes. The returned function is safe to call repeatedly. */
export function subscribeLyraLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function inheritedLocale(host: Element): string {
  const explicit = host.getAttribute('locale') || host.getAttribute('lang');
  if (explicit) return explicit;
  let parent = host.parentElement;
  while (parent) {
    const locale = parent.getAttribute('locale') || parent.getAttribute('lang');
    if (locale) return locale;
    parent = parent.parentElement;
  }
  if (typeof document !== 'undefined') {
    return document.documentElement.getAttribute('lang') || activeLocale || 'en';
  }
  return activeLocale || 'en';
}

/** Resolve the locale inherited by a component host. */
export function resolveLyraLocale(host: Element): string {
  return inheritedLocale(host);
}

/** Resolve the direction inherited by a component host. */
export function resolveLyraDirection(host: Element): 'ltr' | 'rtl' {
  const explicit = host.getAttribute('dir');
  if (explicit === 'rtl' || explicit === 'ltr') return explicit;
  if (typeof getComputedStyle === 'function') return getComputedStyle(host).direction === 'rtl' ? 'rtl' : 'ltr';
  return 'ltr';
}

/**
 * Resolve a message for a component. An explicit per-component override wins,
 * followed by a non-empty component property fallback, registered locale
 * messages, and finally the built-in English message.
 */
export function resolveLyraString(
  host: Element,
  key: string,
  overrides?: LyraLocaleStrings,
  fallback?: string,
  values?: Record<string, string | number>,
): string {
  const own = overrides?.[key];
  let message = own ?? fallback;
  if (message === undefined) {
    for (const candidate of localeCandidates(resolveLyraLocale(host))) {
      const registered = locales.get(candidate)?.[key];
      if (registered !== undefined) {
        message = registered;
        break;
      }
    }
  }
  message ??= DEFAULT_STRINGS[key as LyraMessageKey] ?? key;
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? `{${name}}`));
}

export const LYRA_DEFAULT_STRINGS = DEFAULT_STRINGS;
