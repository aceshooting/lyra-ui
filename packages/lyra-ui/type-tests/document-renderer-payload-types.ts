import {
  adaptDocumentRenderer,
  createDocumentRendererAdapter,
  snapshotLyraDocumentRendererPayload,
  type DocumentFile,
  type DocumentRendererDefinition,
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

const file: DocumentFile = {
  name: 'episode.mp3',
  mimeType: 'audio/mpeg',
  src: 'https://example.test/episode.mp3',
};

const legacyDefinition: DocumentRendererDefinition = {
  render: (legacyFile: DocumentFile) => legacyFile.name,
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

void canonicalTypes;
void legacyInvocation;
void adaptedInvocation;
