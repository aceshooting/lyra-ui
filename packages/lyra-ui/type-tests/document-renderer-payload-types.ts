import {
  adaptDocumentRenderer,
  createDocumentRendererAdapter,
  snapshotLyraDocumentRendererPayload,
  type LyraAvDocumentRendererPayload,
  type LyraAdaptedDocumentRenderer,
  type LyraAdaptedDocumentRendererDefinition,
  type LyraDocumentFile,
  type LyraDocumentRendererAdapter,
  type LyraDocumentRendererAdapterDefinition,
  type LyraDocumentRendererDefinition,
  type LyraDocumentRendererPayload,
  type LyraDocumentRendererPayloadKind,
  type LyraDocumentRendererPayloadFor,
  type LyraGenericDocumentRendererPayload,
  type LyraResolvedDocumentRendererDefinition,
} from '../src/components/viewers/document-viewer/registry.js';

const file: LyraDocumentFile = {
  name: 'episode.mp3',
  mimeType: 'audio/mpeg',
  src: 'https://example.test/episode.mp3',
};

const legacyDefinition: LyraDocumentRendererDefinition = {
  render: (legacyFile: LyraDocumentFile) => legacyFile.name,
};

const avAdapter = createDocumentRendererAdapter({
  kind: 'av',
  adapt: (legacyFile, supplied) => supplied?.kind === 'av'
    ? supplied
    : { kind: 'av', file: legacyFile, cues: [], tracks: [] },
  capabilities: (payload) => ({ search: payload.cues.length > 0 }),
  render: (payload) => payload.tracks.length,
});

const adaptedDefinition: LyraDocumentRendererDefinition = { adapter: avAdapter };
const payload = snapshotLyraDocumentRendererPayload({
  kind: 'av',
  file,
  cues: [{ cueId: 'cue-1', start: 0, text: 'Transcript' }],
  tracks: [],
});

const legacyInvocation = adaptDocumentRenderer(legacyDefinition, file, payload);
const adaptedInvocation = adaptDocumentRenderer(adaptedDefinition, file, payload);

declare const canonicalTypes: [
  LyraDocumentFile,
  LyraDocumentRendererPayload,
  LyraGenericDocumentRendererPayload,
  LyraAvDocumentRendererPayload,
  LyraDocumentRendererPayloadKind,
  LyraDocumentRendererPayloadFor<'av'>,
  LyraDocumentRendererAdapter,
  LyraDocumentRendererAdapterDefinition<'av'>,
  LyraAdaptedDocumentRendererDefinition,
  LyraResolvedDocumentRendererDefinition,
  LyraAdaptedDocumentRenderer,
];

// @ts-expect-error DocumentFile was retired in favor of LyraDocumentFile.
import type { DocumentFile as RemovedDocumentFile } from '../src/components/viewers/document-viewer/registry.js';
// @ts-expect-error DocumentRendererDefinition was retired in favor of LyraDocumentRendererDefinition.
import type { DocumentRendererDefinition as RemovedDocumentRendererDefinition } from '../src/components/viewers/document-viewer/registry.js';
declare const retiredRendererNames: [RemovedDocumentFile, RemovedDocumentRendererDefinition];
void retiredRendererNames;

void canonicalTypes;
void legacyInvocation;
void adaptedInvocation;
