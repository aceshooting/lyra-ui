import '@aceshooting/lyra-ui/theme.css';
import { mountRecordedReplay } from '../../../packages/lyra-gen/examples/recorded-replay.ts';
import recording from '../../../packages/lyra-gen/examples/recordings/chat-review.v1.json' with { type: 'json' };

const root = document.querySelector('main');
let interruptAt;
const demo = mountRecordedReplay(root, recording, { onChunk(index) {
  if (index === interruptAt) { interruptAt = undefined; demo.interrupt(); }
} });
window.__recordedReplay = {
  demo,
  interruptAfter(index) { interruptAt = index; },
  snapshot() { return JSON.stringify(demo.snapshot); },
};
