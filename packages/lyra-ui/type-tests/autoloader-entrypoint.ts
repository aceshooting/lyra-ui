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
  type LyraDefinitionRoot,
} from '../src/autoloader.js';
import { allDefined } from '../src/utilities/defined.js';

const root: LyraDefinitionRoot = document;
const options: AutoloaderOptions = {
  optionalPeers: new Set(['dompurify', 'postal-mime']),
  events: true,
};
const discovered: Promise<readonly AutoloadableTagName[]> = discover(root, options);
const started: Promise<readonly AutoloadableTagName[]> = start(root, { optionalPeers: 'all' });
const definitions: Promise<void> = allDefined(root);
const detail: AutoloaderEventDetail = {
  tag: 'lr-button',
  optionalPeers: [],
};
const errorDetail: AutoloaderErrorEventDetail = { ...detail, error: new Error('example') };
const event: AutoloaderEventMap['lr-autoload-error'] = new CustomEvent('lr-autoload-error', {
  detail: errorDetail,
});
const marker: string = AUTOLOADER_PENDING_ATTRIBUTE;
stop();

void [discovered, started, definitions, detail, errorDetail, event, marker];
