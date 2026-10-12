import { BROWSERS } from './results.mjs';
export function parseOptions(args) {
  const options = { profile: 'quick', browsers: ['chromium', 'firefox', 'webkit'], samples: 7, warmups: 1, timeoutMs: 30000, packageDir: null, output: null, scenarioIds: null, headless: true, softwareRendering: false, help: false };
  const fields = { '--profile': 'profile', '--browsers': 'browsers', '--samples': 'samples', '--warmups': 'warmups', '--timeout-ms': 'timeoutMs', '--package-dir': 'packageDir', '--output': 'output', '--scenarios': 'scenarioIds' };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--help') options.help = true;
    else if (flag === '--headed') options.headless = false;
    else if (flag === '--software-rendering') options.softwareRendering = true;
    else {
      const field = fields[flag], value = args[++index];
      if (!field || value === undefined || value.startsWith('--')) throw new Error('invalid-options');
      options[field] = ['samples', 'warmups', 'timeoutMs'].includes(field) ? Number(value) : ['browsers', 'scenarioIds'].includes(field) ? [...new Set(value.split(','))] : value;
    }
  }
  if (!['quick', 'stress'].includes(options.profile) || options.browsers.some(id => !BROWSERS.includes(id)) || !options.browsers.length || (options.scenarioIds && options.scenarioIds.some(id => !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)))) throw new Error('invalid-options');
  for (const [key, min, max] of [['samples', 3, 50], ['warmups', 0, 10], ['timeoutMs', 1000, 120000]]) if (!Number.isInteger(options[key]) || options[key] < min || options[key] > max) throw new Error('invalid-options');
  return options;
}
