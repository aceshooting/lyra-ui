import type {
  LyraCatalog as UtilityCatalog,
  LyraCatalogEntry as UtilityCatalogEntry,
} from '../src/utilities/catalog.js';
import type {
  LyraCatalog as ModelCatalog,
  LyraCatalogEntry as ModelCatalogEntry,
  LyraModelCatalogEntry,
} from '../src/components/conversation/model-select/model-select.js';
import type {
  LyraCatalog as VoiceCatalog,
  LyraCatalogEntry as VoiceCatalogEntry,
  LyraVoiceCatalogEntry,
} from '../src/components/conversation/voice-picker/voice-picker.js';
import type {
  LyraCatalog as ConversationCatalog,
  LyraCatalogEntry as ConversationCatalogEntry,
} from '../src/components/conversation/index.js';
import type {
  LyraCatalog as RootCatalog,
  LyraCatalogEntry as RootCatalogEntry,
} from '../src/lyra.js';

const basicEntries = [{ id: 'one', label: 'One' }] as const satisfies UtilityCatalog;
const stringCatalog = ['one', 'two'] as const satisfies UtilityCatalog;
const modelCatalog = [
  { id: 'gpt', label: 'GPT', icon: '✦' },
] as const satisfies UtilityCatalog<LyraModelCatalogEntry>;
const voiceCatalog = [
  { id: 'aria', label: 'Aria', language: 'en', previewUrl: 'https://example.test/aria.mp3' },
] as const satisfies UtilityCatalog<LyraVoiceCatalogEntry>;

const sharedCatalogs: [
  ModelCatalog<LyraModelCatalogEntry>,
  VoiceCatalog<LyraVoiceCatalogEntry>,
  ConversationCatalog,
  RootCatalog,
] = [modelCatalog, voiceCatalog, basicEntries, stringCatalog];

const sharedEntries: [
  UtilityCatalogEntry,
  ModelCatalogEntry,
  VoiceCatalogEntry,
  ConversationCatalogEntry,
  RootCatalogEntry,
] = [basicEntries[0], basicEntries[0], basicEntries[0], basicEntries[0], basicEntries[0]];

// The catalog is homogeneous: a string array or a typed object array, never a mixed array.
// @ts-expect-error Mixed shorthand/object catalogs are outside the public contract.
const mixedCatalog: UtilityCatalog = ['one', { id: 'two', label: 'Two' }];

// @ts-expect-error LyraModelCatalog was replaced by generic LyraCatalog in v9.
import type { LyraModelCatalog as RemovedGranularModelCatalog } from '../src/components/conversation/model-select/model-select.js';
// @ts-expect-error LyraVoiceCatalog was replaced by generic LyraCatalog in v9.
import type { LyraVoiceCatalog as RemovedGranularVoiceCatalog } from '../src/components/conversation/voice-picker/voice-picker.js';
// @ts-expect-error Old component-specific catalog aliases are absent from the curated root.
import type { LyraModelCatalog as RemovedRootModelCatalog } from '../src/lyra.js';
// @ts-expect-error Old component-specific catalog aliases are absent from the curated root.
import type { LyraVoiceCatalog as RemovedRootVoiceCatalog } from '../src/lyra.js';

void [sharedCatalogs, sharedEntries, mixedCatalog];
declare const removed: [
  RemovedGranularModelCatalog,
  RemovedGranularVoiceCatalog,
  RemovedRootModelCatalog,
  RemovedRootVoiceCatalog,
];
void removed;
