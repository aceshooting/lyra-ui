import { expect } from '@open-wc/testing';
import { toast } from './toaster.js';

const TOAST_TAG = 'lr-toast';
const TOAST_ITEM_TAG = 'lr-toast-item';

/** True once the browser has actually fetched a module whose URL ends with `suffix` -- the
 *  reliable proxy for "reached by the static import graph" under `@web/test-runner`'s unbundled
 *  ESM serving, where every distinct specifier is its own HTTP resource. */
function fetchedModuleEnding(suffix: string): boolean {
  return performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(suffix));
}

describe('toaster() lazy element loading', () => {
  it('never fetches the toast/toast-item class modules merely by importing the helper', () => {
    expect(
      fetchedModuleEnding('/toast.class.ts'),
      'importing toaster.js alone must not pull in toast.class.ts',
    ).to.equal(false);
    expect(
      fetchedModuleEnding('/toast-item.class.ts'),
      'importing toaster.js alone must not pull in toast-item.class.ts',
    ).to.equal(false);
    expect(customElements.get(TOAST_TAG), 'lr-toast must stay unregistered').to.equal(undefined);
    expect(customElements.get(TOAST_ITEM_TAG), 'lr-toast-item must stay unregistered').to.equal(undefined);
  });

  it('fetches and registers both elements once toast() actually runs, and dismiss() still resolves', async () => {
    const handle = toast('hello');
    const item = await handle.item;
    expect(fetchedModuleEnding('/toast.class.ts'), 'toast() must load toast.class.ts').to.equal(true);
    expect(fetchedModuleEnding('/toast-item.class.ts'), 'toast() must load toast-item.class.ts').to.equal(
      true,
    );
    expect(customElements.get(TOAST_TAG)).to.not.equal(undefined);
    expect(customElements.get(TOAST_ITEM_TAG)).to.not.equal(undefined);
    handle.dismiss();
    item.remove();
  });
});
