/**
 * `waitUntil` from @open-wc/testing-helpers re-checks its predicate every 50 ms by default, so a
 * condition that turns true a millisecond after a check still costs a whole interval; across the
 * thousands of waits in this suite that quantization is a large share of the wall time. Poll every
 * 10 ms instead. Callers passing their own `interval` are unaffected and timeouts are unchanged.
 * A helper release that moves the default leaves this a no-op rather than breaking the run;
 * `scripts/full-engine-shard.test.mjs` fails when that happens.
 */
export const waitUntilPollIntervalPlugin = {
  name: 'lyra-wait-until-poll-interval',
  transform(context) {
    if (!context.response.is('js') || !context.path.includes('/testing-helpers/') || !context.path.endsWith('/src/helpers.js')) return;
    return context.body.replace(/\{\s*interval\s*=\s*50\s*,/u, '{ interval = 10,');
  },
};
