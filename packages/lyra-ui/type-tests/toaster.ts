import {
  toast,
  type LyraToastOptions,
  type ToastHandle,
  type ToastOptions,
} from '../src/components/overlays/toast/toaster.js';

const options: LyraToastOptions = {
  message: 'Saved',
  icon: (ownerDocument) => ownerDocument.createTextNode('✓'),
  ownerDocument: document,
};
const deprecatedOptions: ToastOptions = options;
const handle: ToastHandle = toast(options);

void deprecatedOptions;
void handle.item;
handle.dismiss();
