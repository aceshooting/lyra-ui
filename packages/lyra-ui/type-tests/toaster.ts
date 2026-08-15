import {
  toast,
  type LyraToastOptions,
  type ToastHandle,
} from '../src/components/overlays/toast/toaster.js';

const options: LyraToastOptions = {
  message: 'Saved',
  icon: (ownerDocument) => ownerDocument.createTextNode('✓'),
  ownerDocument: document,
};
const handle: ToastHandle = toast(options);

void handle.item;
handle.dismiss();
