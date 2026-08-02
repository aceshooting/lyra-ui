// Compatibility entry for applications that used the pre-split SSR loader. The hydration hook
// remains first, followed by the former root registration closure. New integrations should import
// `hydration.js` before their granular registrations and use `ssr.js` for server diagnostics.
import './hydration.js';
import './all.js';

export * from './lyra.js';
export * from './ssr.js';
