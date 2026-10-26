import { defineElement } from '@aceshooting/lyra-ui/utilities/prefix.js';
import { LyraGenViewElement } from './gen-view.class.js';

defineElement('gen-view', LyraGenViewElement);
export { LyraGenViewElement } from './gen-view.class.js';
export type { LyraGenReady, LyraGenViewStatus, LyraGenConfirmation, LyraGenStateChange, LyraGenViewEventMap } from './gen-view.class.js';
