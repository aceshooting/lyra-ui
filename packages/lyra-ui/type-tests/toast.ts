import { LyraToast } from '../src/lyra.js';
import type { LyraToastEventMap, LyraToastOverflowDetail } from '../src/lyra.js';

const overflowDetail: LyraToastOverflowDetail = { count: 3 };
const overflowEvent: LyraToastEventMap['lr-toast-overflow'] = new CustomEvent(
  'lr-toast-overflow',
  { detail: overflowDetail },
);

declare const region: LyraToast;
region.addEventListener('lr-toast-overflow', (event) => {
  const count: number = event.detail.count;
  void count;
});

// @ts-expect-error - overflow counts are numeric, not display-ready strings.
const invalidDetail: LyraToastOverflowDetail = { count: '3' };

void overflowEvent;
void invalidDetail;
