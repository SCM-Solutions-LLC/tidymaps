import { Config } from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');
// A pre-installed browser renders these clips; nothing is downloaded at
// render time. render-steps.mjs reads REMOTION_BROWSER and
// REMOTION_CHROME_MODE; Playwright's chrome-headless-shell (mode
// "headless-shell") is the one that renders every key without retries on a
// Mac. The path below is the sandbox's Chromium and only applies to the CLI.
Config.setBrowserExecutable(process.env.REMOTION_BROWSER || '/opt/pw-browsers/chromium');
Config.setChromeMode((process.env.REMOTION_CHROME_MODE as 'chrome-for-testing' | 'headless-shell') || 'chrome-for-testing');
