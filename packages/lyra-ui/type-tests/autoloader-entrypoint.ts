import {
  AUTOLOADER_PENDING_ATTRIBUTE,
  discover,
  start,
  stop,
  type AutoloadableTagName,
  type AutoloaderEventDetail,
  type AutoloaderErrorEventDetail,
  type AutoloaderEventMap,
  type AutoloaderOptions,
  type AutoloaderTraversalErrorEventDetail,
  type LyraDefinitionRoot,
} from '../src/autoloader.js';
import { allDefined, type AllDefinedOptions } from '../src/utilities/defined.js';
import type { LyraGlobalEventMap } from '../src/events.js';

const root: LyraDefinitionRoot = document;
const options: AutoloaderOptions = {
  optionalPeers: new Set(['dompurify', 'postal-mime']),
  events: true,
  maxElements: 10_000,
  maxRoots: 2_000,
  maxDepth: 256,
  maxWork: 100_000,
  maxConcurrency: 16,
};
const discovered: Promise<readonly AutoloadableTagName[]> = discover(root, options);
const started: Promise<readonly AutoloadableTagName[]> = start(root, {
  optionalPeers: 'all',
});
const definitions: Promise<void> = allDefined(root);
const definitionLimits: AllDefinedOptions = {
  maxElements: 10_000,
  maxRoots: 2_000,
  maxDepth: 256,
  maxWork: 100_000,
  maxPasses: 100,
};
const boundedDefinitions: Promise<void> = allDefined(root, definitionLimits);
const detail: AutoloaderEventDetail = {
  tag: 'lr-button',
  optionalPeers: [],
};
const errorDetail: AutoloaderErrorEventDetail = {
  ...detail,
  error: new Error('example'),
};
const event: AutoloaderEventMap['lr-autoload-error'] = new CustomEvent('lr-autoload-error', {
  detail: errorDetail,
});
const traversalDetail: AutoloaderTraversalErrorEventDetail = {
  limit: 'maxElements',
  maximum: 10_000,
  error: new Error('example'),
};
const traversalEvent: AutoloaderEventMap['lr-autoload-traversal-error'] = new CustomEvent(
  'lr-autoload-traversal-error',
  { detail: traversalDetail },
);
const globalAutoloadEvent: LyraGlobalEventMap['lr-autoload-loaded'] = new CustomEvent('lr-autoload-loaded', {
  detail,
});
document.addEventListener('lr-autoload-traversal-error', (event) => {
  const maximum: number = event.detail.maximum;
  void maximum;
});
const marker: string = AUTOLOADER_PENDING_ATTRIBUTE;
stop();

void [
  discovered,
  started,
  definitions,
  boundedDefinitions,
  detail,
  errorDetail,
  event,
  traversalDetail,
  traversalEvent,
  globalAutoloadEvent,
  marker,
];
