// `dist/phone-numbers.js`: a ready `<lr-phone-input>` adapter over the bundled `libphonenumber-js`
// (min metadata), for pages that cannot import the package themselves. Bundled by scripts/build.mjs.
import { loadLibphonenumberAdapter } from '../../lyra-ui/dist/components/forms/phone-input/phone-number-adapter.js';

export { loadLibphonenumberAdapter };

/** Resolves an adapter for `el.adapter`; the metadata chunk loads on the first call only. */
export const loadPhoneNumberAdapter = () => loadLibphonenumberAdapter(() => import('libphonenumber-js/min'));
