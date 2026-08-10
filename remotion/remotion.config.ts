import { Config } from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');
// The pre-installed Playwright Chromium renders these clips; nothing is
// downloaded at render time (the sandbox blocks Remotion's browser fetch).
Config.setBrowserExecutable('/opt/pw-browsers/chromium');
Config.setChromeMode('chrome-for-testing');
