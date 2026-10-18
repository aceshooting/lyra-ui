/** Compact deterministic inputs shared by the list workloads; construct before timing. */
export function makeListInputs() {
  const padded = index => String(index).padStart(5, '0');
  const documents = Array.from({ length: 10000 }, (_, index) => ({
    id: `doc-${padded(index)}`, name: `Document ${padded(index)} Group${index % 10}`,
  }));
  const documentPages = [2, 7].map(group => documents.filter((_, index) => index % 10 === group).slice(0, 100));
  const examples = Array.from({ length: 10000 }, (_, index) => ({
    id: `example-${padded(index)}`, input: `Example ${padded(index)}`, tags: ['synthetic'],
  }));
  const source = Object.freeze({ id: 'source', name: 'Synthetic source' });
  const chunks = Array.from({ length: 10000 }, (_, index) => ({
    id: `chunk-${padded(index)}`, text: `Chunk ${padded(index)}`, score: 0.5, source,
  }));
  const first = Array.from({ length: 5000 }, (_, index) => ({
    id: `item-${padded(index)}`, document: { id: `document-${padded(index)}`, name: `Document ${padded(index)}` },
    stage: 'embedding', progress: 40,
  }));
  for (const item of first) { Object.freeze(item.document); Object.freeze(item); }
  const second = first.slice();
  second[0] = Object.freeze({ ...first[0], progress: 41 });
  Object.freeze(first);
  Object.freeze(second);
  return { documents, documentPages, examples, chunks, ticks: [first, second] };
}
