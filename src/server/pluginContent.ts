import { DESIGN_SKILL_MARKDOWN } from './skillContent.js';

export const DESIGN_PLUGIN_MARKETPLACE_NAME = '12ui';
export const DESIGN_PLUGIN_MARKETPLACE_DISPLAY_NAME = '12ui';
export const DESIGN_PLUGIN_NAME = '12ui-design';
export const DESIGN_PLUGIN_KEY = `${DESIGN_PLUGIN_NAME}@${DESIGN_PLUGIN_MARKETPLACE_NAME}`;

export const DESIGN_PLUGIN_MARKETPLACE_JSON = `${JSON.stringify({
  name: DESIGN_PLUGIN_MARKETPLACE_NAME,
  interface: {
    displayName: DESIGN_PLUGIN_MARKETPLACE_DISPLAY_NAME,
  },
  plugins: [
    {
      name: DESIGN_PLUGIN_NAME,
      source: {
        source: 'local',
        path: `./plugins/${DESIGN_PLUGIN_NAME}`,
      },
      policy: {
        installation: 'INSTALLED_BY_DEFAULT',
        authentication: 'ON_INSTALL',
      },
      category: 'Design',
    },
  ],
}, null, 2)}\n`;

export const designPluginJson = (version: string): string => `${JSON.stringify({
  name: DESIGN_PLUGIN_NAME,
  version,
  description: 'Create UI designs with the local 12ui Codex Design app and continue from handover assets.',
  author: {
    name: '12ui',
    email: 'support@12ui.com',
    url: 'https://12ui.com/',
  },
  homepage: 'https://12ui.com/',
  repository: 'https://github.com/just-every/12ui-codex',
  license: 'MIT',
  keywords: [
    '12ui',
    'design',
    'handover',
    'ui-generation',
    'codex',
  ],
  skills: './skills/',
  interface: {
    displayName: '12ui Design',
    shortDescription: 'Generate UI options and handoffs',
    longDescription: 'Use the local 12ui Codex Design app to generate visual UI options, select one in the browser, and continue implementation from 12ui handover assets.',
    developerName: '12ui',
    category: 'Design',
    capabilities: [
      'Interactive',
      'Write',
    ],
    websiteURL: 'https://12ui.com/',
    privacyPolicyURL: 'https://12ui.com/',
    termsOfServiceURL: 'https://12ui.com/',
    defaultPrompt: [
      'Create UI design options with 12ui',
      'Generate a 12ui handover for this app',
      'Explore visual directions before coding',
    ],
    brandColor: '#0f172a',
    composerIcon: './assets/12ui-icon.svg',
    logo: './assets/12ui-logo.svg',
    screenshots: [],
  },
}, null, 2)}\n`;

export const DESIGN_PLUGIN_SKILL_MARKDOWN = DESIGN_SKILL_MARKDOWN.replace(
  'Use the local 12ui Codex Design app to generate visual UI options, let the user choose in the browser, and continue implementation from the selected handover.',
  'Use the local 12ui Codex Design app to generate visual UI options, let the user choose in the browser, and continue implementation from the selected handover. This plugin skill is disabled by the installer so the plain $design skill remains the only autocomplete entry.',
);

export const DESIGN_PLUGIN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="12ui">
  <rect width="64" height="64" rx="14" fill="#0f172a"/>
  <path d="M16 18h13v28H23V24h-7v-6Zm21 0h12v6h-9c-2 0-3 1-3 3s1 3 3 3h4c5 0 8 3 8 8s-4 8-9 8H31v-6h11c2 0 4-1 4-3s-1-3-4-3h-4c-5 0-8-3-8-8s3-8 7-8Z" fill="#f8fafc"/>
  <circle cx="46" cy="20" r="4" fill="#38bdf8"/>
</svg>
`;

export const DESIGN_PLUGIN_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="12ui Design">
  <rect width="256" height="256" rx="48" fill="#0f172a"/>
  <path d="M56 72h54v112H84V96H56V72Zm90 0h52v24h-39c-8 0-13 5-13 13s5 13 13 13h18c22 0 37 14 37 32s-16 30-39 30h-51v-24h48c9 0 15-5 15-12s-5-12-15-12h-18c-21 0-35-14-35-34s12-30 27-30Z" fill="#f8fafc"/>
  <circle cx="196" cy="76" r="16" fill="#38bdf8"/>
  <path d="M64 202h128" stroke="#38bdf8" stroke-width="10" stroke-linecap="round"/>
</svg>
`;
