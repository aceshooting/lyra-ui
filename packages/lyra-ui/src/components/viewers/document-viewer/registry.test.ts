import { expect } from '@open-wc/testing';
import {
  adaptDocumentRenderer,
  clearDocumentRenderers,
  createDocumentRendererAdapter,
  createDocumentRendererRegistry,
  findDocumentRenderer,
  getDefaultDocumentRendererRegistry,
  loadDocumentRenderer,
  registerDocumentRenderer,
  snapshotLyraDocumentRendererPayload,
  type DocumentFile,
  type DocumentRendererDefinition,
  type LyraAvDocumentRendererPayload,
} from './registry.js';
import type { LyraAnchor, LyraHighlight } from './anchors.js';

const PDF_FILE: DocumentFile = {
  name: 'report.pdf',
  mimeType: 'application/pdf',
  src: 'https://example.test/report.pdf',
};
const CSV_FILE: DocumentFile = {
  name: 'data.csv',
  mimeType: 'application/octet-stream',
  src: 'https://example.test/data.csv',
};

afterEach(() => {
  clearDocumentRenderers();
});

describe('exact mimeType dispatch', () => {
  it('finds a renderer registered under an exact mimeType key', () => {
    const def: DocumentRendererDefinition = { render: () => 'pdf-output' };
    registerDocumentRenderer('application/pdf', def);
    expect(findDocumentRenderer(PDF_FILE)?.render?.(PDF_FILE)).to.equal('pdf-output');
  });

  it('returns undefined when nothing is registered', () => {
    expect(findDocumentRenderer(PDF_FILE)).to.be.undefined;
  });

  it('registering the same key twice overwrites the previous definition', () => {
    const first: DocumentRendererDefinition = { render: () => 'first' };
    const second: DocumentRendererDefinition = { render: () => 'second' };
    registerDocumentRenderer('application/pdf', first);
    registerDocumentRenderer('application/pdf', second);
    expect(findDocumentRenderer(PDF_FILE)?.render?.(PDF_FILE)).to.equal('second');
  });
});

describe('matches() shape-based fallback dispatch', () => {
  it('falls back to a matches() scan when no exact mimeType key matches', () => {
    const def: DocumentRendererDefinition = {
      matches: (file) => file.name.toLowerCase().endsWith('.csv'),
      render: () => 'csv-output',
    };
    registerDocumentRenderer('lyra:csv', def);
    expect(findDocumentRenderer(CSV_FILE)?.render?.(CSV_FILE)).to.equal('csv-output');
  });

  it('an exact mimeType key match wins over a matches()-based entry', () => {
    const shapeDef: DocumentRendererDefinition = { matches: () => true, render: () => 'shape' };
    const exactDef: DocumentRendererDefinition = { render: () => 'exact' };
    registerDocumentRenderer('lyra:catch-all', shapeDef);
    registerDocumentRenderer('application/pdf', exactDef);
    expect(findDocumentRenderer(PDF_FILE)?.render?.(PDF_FILE)).to.equal('exact');
  });

  it('scans matches() entries in registration order, returning the first hit', () => {
    const first: DocumentRendererDefinition = { matches: () => true, render: () => 'first' };
    const second: DocumentRendererDefinition = { matches: () => true, render: () => 'second' };
    registerDocumentRenderer('lyra:first', first);
    registerDocumentRenderer('lyra:second', second);
    expect(findDocumentRenderer(CSV_FILE)?.render?.(CSV_FILE)).to.equal('first');
  });

  it('returns undefined when a non-empty registry has no exact key or matches() hit', () => {
    const def: DocumentRendererDefinition = {
      matches: (file) => file.name.toLowerCase().endsWith('.csv'),
      render: () => 'csv-output',
    };
    registerDocumentRenderer('lyra:csv', def);
    expect(findDocumentRenderer(PDF_FILE)).to.be.undefined;
  });
});

describe('a custom registry (not the module-level default)', () => {
  it('dispatches against the passed-in registry instead of the default one', () => {
    const customRegistry = new Map<string, DocumentRendererDefinition>();
    const def: DocumentRendererDefinition = { render: () => 'custom' };
    customRegistry.set('application/pdf', def);
    expect(findDocumentRenderer(PDF_FILE, customRegistry)?.render?.(PDF_FILE)).to.equal('custom');
    expect(findDocumentRenderer(PDF_FILE)).to.be.undefined;
  });

  it('creates immutable instance snapshots that later registrations cannot mutate', () => {
    const def: DocumentRendererDefinition = { render: () => 'x' };
    registerDocumentRenderer('application/pdf', def);
    const snapshot = createDocumentRendererRegistry();
    expect(snapshot.get('application/pdf')?.render?.(PDF_FILE)).to.equal('x');
    expect((snapshot as unknown as { set?: unknown }).set).to.be.undefined;
    registerDocumentRenderer('text/csv', { render: () => 'later' });
    expect(snapshot.has('text/csv')).to.equal(false);
    expect(getDefaultDocumentRendererRegistry().has('text/csv')).to.equal(true);
  });

  it('normalizes MIME essence casing and parameters for exact lookup', () => {
    registerDocumentRenderer(' Application/PDF ; charset=binary ', { render: () => 'normalized' });
    expect(findDocumentRenderer({
      ...PDF_FILE,
      mimeType: 'APPLICATION/PDF; Charset=UTF-8',
    })?.render?.(PDF_FILE)).to.equal('normalized');
  });

  it('rejects empty keys and invalid direct/lazy definitions at construction', () => {
    expect(() => registerDocumentRenderer(' ', { render: () => 'x' })).to.throw(TypeError);
    expect(() => createDocumentRendererRegistry([
      ['application/x-invalid', {} as never],
    ])).to.throw(TypeError);
    expect(() => createDocumentRendererRegistry([
      ['application/x-invalid', { render: () => 'x', load: async () => ({ render: () => 'y' }) } as never],
    ])).to.throw(TypeError);
  });

  it('exposes the full ReadonlyMap surface (keys/values/entries/forEach/iteration)', () => {
    const registry = createDocumentRendererRegistry([
      ['application/pdf', { render: () => 'pdf' }],
      ['text/csv', { render: () => 'csv' }],
    ]);
    expect(registry.size).to.equal(2);
    expect([...registry.keys()].sort()).to.deep.equal(['application/pdf', 'text/csv']);
    expect([...registry.values()]).to.have.length(2);
    expect([...registry.entries()].map(([key]) => key).sort()).to.deep.equal(['application/pdf', 'text/csv']);

    const seenViaForEach: string[] = [];
    registry.forEach((_definition, key) => {
      seenViaForEach.push(key);
    });
    expect(seenViaForEach.sort()).to.deep.equal(['application/pdf', 'text/csv']);

    const seenViaIteration: string[] = [];
    for (const [key] of registry) seenViaIteration.push(key);
    expect(seenViaIteration.sort()).to.deep.equal(['application/pdf', 'text/csv']);
  });
});

describe('loadDocumentRenderer()', () => {
  it('resolves a definition with no load() as itself', async () => {
    const def: DocumentRendererDefinition = { render: () => 'x' };
    expect((await loadDocumentRenderer(def)).render(PDF_FILE)).to.equal('x');
  });

  it('resolves a lazy definition via its load() function', async () => {
    const resolved: DocumentRendererDefinition = { render: () => 'lazy-output' };
    const def: DocumentRendererDefinition = { load: () => Promise.resolve(resolved) };
    expect((await loadDocumentRenderer(def)).render(PDF_FILE)).to.equal('lazy-output');
  });

  it('unwraps a { default } module-namespace shape from load()', async () => {
    const resolved: DocumentRendererDefinition = { render: () => 'lazy-output' };
    const def: DocumentRendererDefinition = { load: () => Promise.resolve({ default: resolved }) };
    expect((await loadDocumentRenderer(def)).render(PDF_FILE)).to.equal('lazy-output');
  });

  it('rejects a lazy adapter so its derived capabilities cannot conflict with legacy static ones', async () => {
    const adapter = createDocumentRendererAdapter({
      kind: 'document',
      adapt: (file) => ({ kind: 'document', file }),
      capabilities: () => ({ search: false }),
      render: (payload) => payload.file.name,
    });
    const invalid = {
      capabilities: { search: true },
      load: () => Promise.resolve({ adapter }),
    } as unknown as DocumentRendererDefinition;
    let rejection: unknown;
    await loadDocumentRenderer(invalid).catch((error: unknown) => {
      rejection = error;
    });
    expect(rejection).to.be.instanceOf(TypeError);
  });

  it('calls load() at most once for the same definition, caching by identity', async () => {
    let callCount = 0;
    const def: DocumentRendererDefinition = {
      load: () => {
        callCount++;
        return Promise.resolve({ render: () => 'x' });
      },
    };
    await loadDocumentRenderer(def);
    await loadDocumentRenderer(def);
    expect(callCount).to.equal(1);
  });

  it('does not cache a rejected load(), so a later call retries', async () => {
    let callCount = 0;
    const def: DocumentRendererDefinition = {
      load: () => {
        callCount++;
        return callCount === 1 ? Promise.reject(new Error('boom')) : Promise.resolve({ render: () => 'x' });
      },
    };
    await loadDocumentRenderer(def).catch(() => {});
    const resolved = await loadDocumentRenderer(def);
    expect(callCount).to.equal(2);
    expect(resolved.render!(PDF_FILE)).to.equal('x');
  });

  it('rejects when load() resolves to another lazy (non-direct) definition', async () => {
    const def: DocumentRendererDefinition = {
      load: () => Promise.resolve({ load: () => Promise.resolve({ render: () => 'never reached' }) } as never),
    };
    let rejection: unknown;
    await loadDocumentRenderer(def).catch((error: unknown) => {
      rejection = error;
    });
    expect(rejection).to.be.instanceOf(TypeError);
  });
});

describe('clearDocumentRenderers()', () => {
  it('empties the default registry so a later test starts clean', () => {
    registerDocumentRenderer('application/pdf', { render: () => 'x' });
    clearDocumentRenderers();
    expect(getDefaultDocumentRendererRegistry().size).to.equal(0);
    expect(findDocumentRenderer(PDF_FILE)).to.be.undefined;
  });
});

describe('DocumentFile/DocumentRendererDefinition widening', () => {
  it('DocumentFile accepts anchor/highlights/alt as optional fields', () => {
    const anchor: LyraAnchor = { kind: 'page', page: 3 };
    const highlights: LyraHighlight[] = [{ id: 'cite-1', anchor }];
    const file: import('./registry.js').DocumentFile = {
      name: 'report.pdf',
      mimeType: 'application/pdf',
      src: 'https://example.test/report.pdf',
      anchor,
      highlights,
      alt: 'Annual report',
    };
    expect(file.anchor).to.deep.equal(anchor);
    expect(file.highlights).to.deep.equal(highlights);
    expect(file.alt).to.equal('Annual report');
  });

  it('DocumentRendererDefinition accepts an optional capabilities declaration', () => {
    const def: import('./registry.js').DocumentRendererDefinition = {
      render: () => 'page renderer',
      capabilities: { anchors: ['page', 'text-quote'], textSelect: true },
    };
    expect(def.capabilities?.anchors).to.deep.equal(['page', 'text-quote']);
  });
});

describe('payload and definition validation guards', () => {
  it('rejects a non-object payload', () => {
    expect(() => snapshotLyraDocumentRendererPayload(null as never)).to.throw(TypeError);
    expect(() => snapshotLyraDocumentRendererPayload('x' as never)).to.throw(TypeError);
  });

  it('rejects a payload with an unsupported kind', () => {
    expect(() => snapshotLyraDocumentRendererPayload({
      kind: 'bogus',
      file: PDF_FILE,
    } as never)).to.throw(TypeError);
  });

  it('rejects a payload file that is missing required string fields', () => {
    expect(() => snapshotLyraDocumentRendererPayload({
      kind: 'document',
      file: null,
    } as never)).to.throw(TypeError);
    expect(() => snapshotLyraDocumentRendererPayload({
      kind: 'document',
      file: { name: 'report.pdf' },
    } as never)).to.throw(TypeError);
  });

  it('rejects an invalid capabilities declaration on a direct renderer', () => {
    expect(() => createDocumentRendererRegistry([
      ['application/x-invalid', {
        render: () => 'x',
        capabilities: { anchors: 'not-an-array' },
      } as never],
    ])).to.throw(TypeError);
    expect(() => createDocumentRendererRegistry([
      ['application/x-invalid', {
        render: () => 'x',
        capabilities: { anchors: [1, 2] },
      } as never],
    ])).to.throw(TypeError);
    expect(() => createDocumentRendererRegistry([
      ['application/x-invalid', {
        render: () => 'x',
        capabilities: { search: 'yes' },
      } as never],
    ])).to.throw(TypeError);
    expect(() => createDocumentRendererRegistry([
      ['application/x-invalid', {
        render: () => 'x',
        capabilities: { textSelect: 'yes' },
      } as never],
    ])).to.throw(TypeError);
  });

  it('rejects a matches declaration that is not a function', () => {
    expect(() => createDocumentRendererRegistry([
      ['application/x-invalid', { render: () => 'x', matches: 'not-a-function' } as never],
    ])).to.throw(TypeError);
  });

  it('rejects a non-object definition', () => {
    expect(() => registerDocumentRenderer('application/x-invalid', 'not-an-object' as never)).to.throw(TypeError);
  });

  it('rejects an adapter-shaped value not created via createDocumentRendererAdapter()', () => {
    expect(() => createDocumentRendererRegistry([
      ['application/x-invalid', { adapter: { kind: 'document', adapt: () => {}, capabilities: () => {}, render: () => {} } } as never],
    ])).to.throw(TypeError);
  });

  it('createDocumentRendererAdapter() rejects an invalid adapter definition', () => {
    const valid = {
      kind: 'document' as const,
      adapt: (file: DocumentFile) => ({ kind: 'document' as const, file }),
      capabilities: () => undefined,
      render: () => 'x',
    };
    expect(() => createDocumentRendererAdapter({ ...valid, kind: 'bogus' } as never)).to.throw(TypeError);
    expect(() => createDocumentRendererAdapter({ ...valid, adapt: 'not-a-function' } as never)).to.throw(TypeError);
    expect(() => createDocumentRendererAdapter({ ...valid, capabilities: 'not-a-function' } as never)).to.throw(TypeError);
    expect(() => createDocumentRendererAdapter({ ...valid, render: 'not-a-function' } as never)).to.throw(TypeError);
  });

  it('adaptDocumentRenderer() rejects a still-lazy (load-only) definition', () => {
    const lazy: DocumentRendererDefinition = { load: () => Promise.resolve({ render: () => 'x' }) };
    expect(() => adaptDocumentRenderer(lazy as never, PDF_FILE)).to.throw(TypeError);
  });

  it('adaptDocumentRenderer() defaults an unsupplied payload to a document-kind snapshot of the file', () => {
    const definition: DocumentRendererDefinition = { render: (file) => file.name };
    const adapted = adaptDocumentRenderer(definition, PDF_FILE);
    expect(adapted.payload.kind).to.equal('document');
    expect(adapted.payload.file.name).to.equal(PDF_FILE.name);
    expect(Object.isFrozen(adapted.payload)).to.equal(true);
  });
});

describe('LyraDocumentRendererPayload adapters', () => {
  it('snapshots and hard-bounds AV cue/track collections and their retained records', () => {
    const cues = Array.from({ length: 10_005 }, (_unused, index) => ({
      cueId: `cue-${index}`,
      start: index,
      text: index === 0
        ? 't'.repeat(120_000)
        : index === 10_004
          ? 'Only omitted content is searchable'
          : '',
      ...(index === 0 ? { speaker: 's'.repeat(5_000) } : {}),
    }));
    const tracks = Array.from({ length: 70 }, (_unused, index) => ({
      src: `${'x'.repeat(20_000)}-${index}.vtt`,
      kind: 'captions' as const,
      srclang: index === 0 ? 'e'.repeat(200) : 'en',
      label: index === 0 ? 'l'.repeat(5_000) : `Track ${index}`,
    }));

    const payload = snapshotLyraDocumentRendererPayload({
      kind: 'av',
      file: PDF_FILE,
      cues,
      tracks,
    });

    expect(payload.kind).to.equal('av');
    const av = payload as LyraAvDocumentRendererPayload;
    expect(av.cues).to.have.length(10_000);
    expect(av.tracks).to.have.length(64);
    expect(av.cues[0]!.text).to.have.length(100_000);
    expect(av.cues[0]!.speaker).to.have.length(4_096);
    expect(av.tracks[0]!.src.length).to.be.at.most(16_384);
    expect(av.tracks[0]!.srclang).to.have.length(128);
    expect(av.tracks[0]!.label).to.have.length(4_096);
    expect(Object.isFrozen(av)).to.equal(true);
    expect(Object.isFrozen(av.file)).to.equal(true);
    expect(Object.isFrozen(av.cues)).to.equal(true);
    expect(Object.isFrozen(av.cues[0]!)).to.equal(true);
    expect(Object.isFrozen(av.tracks)).to.equal(true);
    expect(Object.isFrozen(av.tracks[0]!)).to.equal(true);

    cues[0]!.text = 'mutated after assignment';
    tracks[0]!.label = 'mutated after assignment';
    expect(av.cues[0]!.text[0]).to.equal('t');
    expect(av.tracks[0]!.label[0]).to.equal('l');
  });

  it('keeps an ordinary render(file) callback on the legacy DocumentFile path', () => {
    let received: DocumentFile | undefined;
    const definition: DocumentRendererDefinition = {
      render: (file) => {
        received = file;
        return file.name;
      },
    };
    const supplied = snapshotLyraDocumentRendererPayload({
      kind: 'av',
      file: PDF_FILE,
      cues: [{ cueId: 'cue-1', start: 0, text: 'Searchable' }],
      tracks: [],
    });

    const file = {
      ...PDF_FILE,
      highlights: [
        { id: '', anchor: { kind: 'page' as const, page: 1 } },
        { id: ' finding ', label: 'First', anchor: { kind: 'page' as const, page: 2 } },
        { id: 'finding', label: 'Later', anchor: { kind: 'page' as const, page: 3 } },
      ],
    };
    const adapted = adaptDocumentRenderer(definition, file, supplied);
    expect(adapted.render()).to.equal('report.pdf');
    expect(received).not.to.equal(file);
    expect(received?.highlights?.map((highlight) => highlight.id)).to.deep.equal(['finding']);
    expect(received?.highlights?.[0]?.label).to.equal('First');
    expect(adapted.capabilities).to.equal(undefined);
  });

  it('normalizes payload-file highlight identities before adaptation', () => {
    const payload = snapshotLyraDocumentRendererPayload({
      kind: 'document',
      file: {
        ...PDF_FILE,
        highlights: [
          { id: '', anchor: { kind: 'page', page: 1 } },
          { id: ' finding ', label: 'First', anchor: { kind: 'page', page: 2 } },
          { id: 'finding', label: 'Later', anchor: { kind: 'page', page: 3 } },
        ],
      },
    });

    expect(payload.file.highlights?.map((highlight) => highlight.id)).to.deep.equal(['finding']);
    expect(payload.file.highlights?.[0]?.label).to.equal('First');
  });

  it('snapshots adapter callbacks and freezes the factory-created adapter', () => {
    let receivedFile: DocumentFile | undefined;
    const authoring = {
      kind: 'document' as const,
      adapt: (file: DocumentFile) => {
        receivedFile = file;
        return { kind: 'document' as const, file };
      },
      capabilities: () => ({ search: false }),
      render: (payload: import('./registry.js').LyraGenericDocumentRendererPayload) => payload.file.name,
    };
    const adapter = createDocumentRendererAdapter(authoring);
    authoring.render = () => 'mutated callback';

    expect(Object.isFrozen(adapter)).to.equal(true);
    const rawFile: DocumentFile = {
      ...PDF_FILE,
      highlights: [
        { id: ' finding ', anchor: { kind: 'page', page: 2 } },
        { id: 'finding', anchor: { kind: 'page', page: 3 } },
      ],
    };
    expect(adaptDocumentRenderer({ adapter }, rawFile).render()).to.equal('report.pdf');
    expect(receivedFile).not.to.equal(rawFile);
    expect(receivedFile?.highlights?.map((highlight) => highlight.id)).to.deep.equal(['finding']);
  });

  it('derives AV capabilities only from the retained adapter payload', () => {
    const adapter = createDocumentRendererAdapter({
      kind: 'av',
      adapt: (file, supplied) => supplied?.kind === 'av'
        ? supplied
        : { kind: 'av', file, cues: [], tracks: [] },
      capabilities: (payload) => ({
        anchors: ['time-range'],
        search: payload.cues.some((cue) => Boolean(cue.text.trim() || cue.speaker?.trim())),
      }),
      render: (payload) => payload.cues.length,
    });
    const definition: DocumentRendererDefinition = { adapter };
    const omittedSearchableCue = snapshotLyraDocumentRendererPayload({
      kind: 'av',
      file: PDF_FILE,
      cues: [
        ...Array.from({ length: 10_000 }, (_unused, index) => ({
          cueId: `empty-${index}`,
          start: index,
          text: '',
        })),
        { cueId: 'omitted-searchable', start: 10_000, text: 'Needle' },
      ],
      tracks: [],
    });

    const bounded = adaptDocumentRenderer(definition, PDF_FILE, omittedSearchableCue);
    expect(bounded.capabilities).to.deep.equal({ anchors: ['time-range'], search: false });
    expect(bounded.render()).to.equal(10_000);

    const searchable = adaptDocumentRenderer(definition, PDF_FILE, {
      kind: 'av',
      file: PDF_FILE,
      cues: [{ cueId: 'speaker-only', start: 0, text: '', speaker: 'Host' }],
      tracks: [],
    });
    expect(searchable.capabilities).to.deep.equal({ anchors: ['time-range'], search: true });
    expect(Object.isFrozen(searchable.capabilities)).to.equal(true);
    expect(Object.isFrozen(searchable.capabilities!.anchors!)).to.equal(true);
  });

  it('rejects an adapter whose returned discriminator differs from its declared kind', () => {
    const adapter = createDocumentRendererAdapter({
      kind: 'av',
      adapt: (file) => ({ kind: 'document', file }) as never,
      capabilities: () => ({ anchors: ['time-range'] }),
      render: () => 'unreachable',
    });
    expect(() => adaptDocumentRenderer({ adapter }, PDF_FILE)).to.throw(TypeError);
  });

  it('requires exactly one direct render, payload adapter, or lazy loader', () => {
    const adapter = createDocumentRendererAdapter({
      kind: 'document',
      adapt: (file) => ({ kind: 'document', file }),
      capabilities: () => undefined,
      render: () => 'document',
    });
    expect(() => createDocumentRendererRegistry([
      ['application/x-invalid', { adapter, render: () => 'ambiguous' } as never],
    ])).to.throw(TypeError);
    expect(() => createDocumentRendererRegistry([
      ['application/x-invalid', { adapter, capabilities: { search: true } } as never],
    ])).to.throw(TypeError);
  });
});
