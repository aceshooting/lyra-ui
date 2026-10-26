const form = '<stack id="answer"><heading id="title">Review the answer</heading>'
  + '<text id="summary">This locally replayed answer contains a working review field.</text>'
  + '<input id="note" label="Review note" bindings={{"value":"/note"}} /></stack>';

export function tokenSchedule(source, { characters = 12, intervalMs = 8 } = {}) {
  if (!Number.isSafeInteger(characters) || characters < 1 || !Number.isFinite(intervalMs) || intervalMs < 0) throw new TypeError('Invalid token schedule.');
  const chunks = [];
  for (let start = 0; start < source.length; start += characters) chunks.push({ atMs: chunks.length * intervalMs, text: source.slice(start, start + characters) });
  return chunks;
}

/** Synthetic cadence, not recorded provider latency; each case admits the same complete form. */
export const WORKLOADS = Object.freeze({
  'chat-form': { title: 'Prose and a generated form at synthetic token cadence', source: `Review follows.\n\n\`\`\`lyra\n${form}\n\`\`\`\nThe answer is complete.`, characters: 12, intervalMs: 8 },
  'chat-long-prose': { title: 'Long prose preceding a generated form', source: `${'A bounded local explanation. '.repeat(300)}\n\`\`\`lyra\n${form}\n\`\`\`\nComplete.`, characters: 128, intervalMs: 4 },
  'chat-recorded-cadence': { title: 'Versioned authored synthetic recording at its original offsets', source: chatRecording.text, recording: chatRecording },
});

export function workloadSchedule(workload) {
  return workload.recording ? workload.recording.chunks : tokenSchedule(workload.source, workload);
}

export const METRIC_DEFINITIONS = Object.freeze({
  firstUsefulMs: 'Replay start until the first settling checkpoint with nonempty committed prose and a paint opportunity; not model first-token latency.',
  controlReadyMs: 'Replay start until the first settling checkpoint with a ready generated view and native input after a paint opportunity. Checkpoint sampling is an upper bound on actual first readiness.',
  parseControllerMs: 'Synchronous chat-controller push and finish work; includes parser, admission and projection, excludes rendering.',
  renderSettlingMs: 'Elapsed time awaiting transcript updates and a paint opportunity; includes frame waiting, not CPU-only rendering time.',
  litUpdates: 'Completed update calls on transcript, generated views, and their rendered Lyra children.',
  cls: 'Maximum CLS session window, excluding shifts marked hadRecentInput; unsupported is null.',
  longTaskCount: 'Observed main-thread tasks of at least 50 ms overlapping replay; a task can begin before local zero and include setup. Unsupported is null.',
  totalLongTaskMs: 'Sum of whole observed long-task durations overlapping the replay observer window; unsupported is null. This is not total main-thread time.',
  peakConnectedNodes: 'Maximum recursively counted fixture DOM nodes, including open shadow roots; not a heap measurement.',
  sourceCharactersAfterRelease: 'Logical controller transport source length after explicit host release; prose presentation remains and engines may share substring backing stores.',
  connectedNodesAfterDispose: 'Fixture DOM nodes remaining after application disposal, before harness cleanup; inert Lit comment markers can remain. Detached browser heap is not inferred.',
});
import chatRecording from '../../packages/lyra-gen/examples/recordings/chat-review.v1.json' with { type: 'json' };
