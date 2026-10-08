import { LyraAlert } from '../src/components/overlays/alert/alert.class.js';
import { LyraAlert as GranularLyraAlert } from '../src/components/overlays/alert/alert.js';
import { LyraAlert as FamilyLyraAlert } from '../src/components/overlays/index.js';
import type {
  AlertCountdown } from '../src/components/overlays/alert/alert.class.js';
import type {
  AlertVariant,
  LyraAlertEventMap,
} from '../src/lyra.js';

const granularConstructor: typeof LyraAlert = GranularLyraAlert;
const familyConstructor: typeof LyraAlert = FamilyLyraAlert;
void granularConstructor;
void familyConstructor;

declare const alert: LyraAlert;
alert.open = true;
alert.closable = true;
alert.duration = Infinity;
alert.countdown = 'rtl';
alert.variant = 'primary';

const countdown: AlertCountdown = alert.countdown;
const variant: AlertVariant = alert.variant;
void countdown;
void variant;

const showCompletion: Promise<void> = alert.show();
const hideCompletion: Promise<void> = alert.hide();
const toastCompletion: Promise<void> = alert.toast();
void showCompletion;
void hideCompletion;
void toastCompletion;

alert.addEventListener('lr-after-hide', (event) => {
  const detail: null = event.detail;
  void detail;
});

const afterHide: LyraAlertEventMap['lr-after-hide'] | undefined = undefined;
void afterHide;

// Both the Shoelace spelling and Lyra's shared brand spelling are accepted.
alert.variant = 'brand';
alert.variant = 'primary';
// @ts-expect-error Countdown accepts only the two documented physical directions.
alert.countdown = 'inline-start';
