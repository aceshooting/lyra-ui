import { junitReporter } from '@web/test-runner-junit-reporter';

/** Keep Web Test Runner's JUnit format while including its root-level test results. */
export function completeJunitReporter(options) {
  const reporter = junitReporter(options);
  return {
    ...reporter,
    onTestRunFinished(run) {
      const sessions = run.sessions.map(session => {
        const root = session.testResults;
        if (!root?.tests?.length) return session;
        return {
          ...session,
          testResults: {
            ...root,
            tests: [],
            suites: [
              { name: '', tests: root.tests, suites: [] },
              ...(root.suites ?? []),
            ],
          },
        };
      });
      return reporter.onTestRunFinished.call(reporter, { ...run, sessions });
    },
  };
}
