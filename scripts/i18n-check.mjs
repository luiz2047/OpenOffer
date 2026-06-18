#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { importTsModule } from './i18n/load-ts-module.mjs';

const root = process.cwd();
const { resources } = await importTsModule(path.join(root, 'src/i18n/resources.ts'));

const MAX_STRING_CODEPOINTS = 2000;
const PLURAL_SUFFIX_RE = /_(zero|one|two|few|many|other)$/;
const failures = [];

function fail(message) {
  failures.push(message);
}

function flatten(value, prefix = '', out = {}) {
  if (typeof value === 'string') {
    out[prefix] = value;
    return out;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`Catalog leaf ${prefix || '<root>'} must be a string or object`);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

function pluralBase(key) {
  return key.replace(PLURAL_SUFFIX_RE, '');
}

function placeholders(value) {
  return [...value.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)]
    .map((match) => match[1])
    .sort();
}

function sameArray(a, b) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

const en = flatten(resources.en.translation);
const ru = flatten(resources.ru.translation);

for (const [key, value] of Object.entries(en)) {
  if ([...value].length > MAX_STRING_CODEPOINTS) {
    fail(`en:${key} exceeds ${MAX_STRING_CODEPOINTS} code points`);
  }

  const base = pluralBase(key);
  const hasPlural = base !== key;
  const ruCandidates = hasPlural
    ? Object.entries(ru).filter(([ruKey]) => pluralBase(ruKey) === base)
    : [[key, ru[key]]].filter(([, ruValue]) => typeof ruValue === 'string');

  if (ruCandidates.length === 0) {
    fail(`Missing ru translation for ${key}`);
    continue;
  }

  const enPlaceholders = placeholders(value);
  for (const [ruKey, ruValue] of ruCandidates) {
    if ([...ruValue].length > MAX_STRING_CODEPOINTS) {
      fail(`ru:${ruKey} exceeds ${MAX_STRING_CODEPOINTS} code points`);
    }
    const ruPlaceholders = placeholders(ruValue);
    if (!sameArray(enPlaceholders, ruPlaceholders)) {
      fail(`Placeholder mismatch for ${ruKey}: en=[${enPlaceholders.join(',')}] ru=[${ruPlaceholders.join(',')}]`);
    }
  }
}

for (const ruKey of Object.keys(ru)) {
  const base = pluralBase(ruKey);
  const hasMatchingEnglishKey = en[ruKey] || Object.keys(en).some((enKey) => pluralBase(enKey) === base);
  if (!hasMatchingEnglishKey) {
    fail(`Extra ru key without English source: ${ruKey}`);
  }
}

const migratedStringGuards = [
  {
    file: 'src/components/SettingsOverlay.tsx',
    forbidden: [
      'General settings',
      'Open OpenOffer when you log in',
      'Do not save meetings',
      'Interface language',
      'AI Response Language',
      'You are currently using OpenOffer version',
      'Interface Opacity',
      'Process Disguise',
      'What to answer?',
      'Follow Up Question',
      'Ask anything on screen or conversation',
    ],
  },
  {
    file: 'src/components/Launcher.tsx',
    forbidden: [
      'Profile Intel',
      'Manage your persona, career history, and active job description.',
      'Custom instructions and formulas designed for different meeting contexts.',
      'Synced with calendar',
    ],
  },
  {
    file: 'src/components/NativelyInterface.tsx',
    forbidden: [
      'What to answer?',
      'Follow Up Question',
      'Transcription Not Configured',
      'No STT provider selected. Open Settings',
      'Ask anything on screen or conversation',
    ],
  },
  {
    file: 'src/features/interviews/InterviewCommandCenter.tsx',
    forbidden: [
      'Search company, role, stage',
      'No scheduled events.',
      'No vacancy context',
      'No interviews yet.',
      'No interview selected',
      'Create or select a process',
      'No active process selected.',
    ],
  },
  {
    file: 'src/components/onboarding/PermissionsToaster.tsx',
    forbidden: [
      "Let's get you set up",
      'OpenOffer needs a few permissions to capture meetings and transcribe speech.',
      'Required to capture meeting content',
      'Required for speech transcription',
    ],
  },
  {
    file: 'src/components/TopSearchPill.tsx',
    forbidden: [
      'Search or ask anything...',
    ],
  },
  {
    file: 'src/components/GlobalChatOverlay.tsx',
    forbidden: [
      'Copy message',
      "Couldn't get a response. Please try again.",
      "Couldn't get a response. Please check your settings.",
      'Something went wrong. Please try again.',
      'Search all meetings',
      'Ask me anything...',
    ],
  },
  {
    file: 'src/components/MeetingChatOverlay.tsx',
    forbidden: [
      "Couldn't get a response. Please try again.",
      "Couldn't get a response. Please check your settings.",
      'Something went wrong. Please try again.',
      'Search this meeting',
      '>Copied<',
      '>Copy<',
    ],
  },
  {
    file: 'src/components/FollowUpEmailModal.tsx',
    forbidden: [
      'Draft Follow-up',
      'Recipient email',
      'Subject line',
      'Drafting perfect follow-up...',
      'Write your email...',
      'Regenerate',
    ],
  },
  {
    file: 'src/components/LocalWhisperModelPanel.tsx',
    forbidden: [
      'No models available',
      'Local Engine Configuration',
      'Split Audio Channels',
      'Model Manager',
      'Downloading...',
      'Failed to download model',
      'Delete model',
    ],
  },
  {
    file: 'src/components/MeetingDetails.tsx',
    forbidden: [
      'Type an action item...',
      'Type a key point...',
      'Next Steps',
      'Follow-up Draft',
      'No transcript available.',
      'No usage history.',
      'Ask about this meeting...',
    ],
  },
  {
    file: 'src/features/interviews/InterviewCommandCenter.tsx',
    forbidden: [
      'Vacancy dossier',
      'Save dossier',
      'Retro is due',
      'Manual intake',
      'Unparsed source',
      'Draft changed',
      'Draft saved locally',
      'Draft not saved locally',
    ],
  },
  {
    file: 'src/components/SettingsPopup.tsx',
    forbidden: [
      'Requires Groq key',
      '>Fast Response<',
      '>Interview Mode<',
      '>Profile Mode<',
      '>Show/Hide<',
      '>Screenshot<',
    ],
  },
  {
    file: 'src/components/ModelSelectorWindow.tsx',
    forbidden: [
      'Loading models...',
      'No models connected.',
      'Check Settings.',
    ],
  },
  {
    file: 'src/components/onboarding/PermissionsOnboardingFull.tsx',
    forbidden: [
      'Skip for now',
      "Let's get you set up",
      'Allow OpenOffer to assist',
      'Allow OpenOffer to hear you',
      'Allow OpenOffer to see your screen',
      'Request microphone access',
      'All set — continue',
    ],
  },
  {
    file: 'src/components/UpdateModal.tsx',
    forbidden: [
      'Update Failed',
      'Manual Update Required',
      'Downloading Update...',
      'Update Available',
      'Restart & Install',
      'Update Now',
      'Copy to clipboard',
    ],
  },
  {
    file: 'src/components/settings/PhoneMirrorSettings.tsx',
    forbidden: [
      'Enable Phone Mirror',
      'Off — no listener, no exposure.',
      'Allow LAN access',
      'Scan with your phone',
      'Rotate token',
      'Turn on Phone Mirror to generate',
    ],
  },
  {
    file: 'src/components/settings/HelpSettings.tsx',
    forbidden: [
      'Quick Start',
      'Help Guide',
      'Speech Provider',
      'Recommended',
      'Screen Recording',
      'Global System Shortcuts',
      'Mouse Pass-through',
      'Connect Google Calendar',
    ],
  },
  {
    file: 'src/components/ProfileIntelligenceSettings.tsx',
    forbidden: [
      'Profile Intelligence',
      'Professional Identity',
      'Persona Engine',
      'Upload Job Description',
      'Custom Context',
      'No script yet',
      'Negotiation Script',
      'Target Compensation',
      'Common Complaints',
      'Company research is AI-generated',
    ],
  },
  {
    file: 'src/components/settings/AIProvidersSettings.tsx',
    forbidden: [
      'Default Model for Chat',
      'Fast Response Mode',
      'Cloud Providers',
      'Request data logging',
      'Local Models (Ollama)',
      'Custom Providers',
      'Screen understanding',
      'Cloud provider data scopes',
    ],
  },
  {
    file: 'src/components/settings/ProviderCard.tsx',
    forbidden: [
      'Get Key',
      'Test Connection',
      'Fetch Models',
      'Model fetch error',
      'Remove API Key',
    ],
  },
  {
    file: 'src/components/settings/IntelligenceSettings.tsx',
    forbidden: [
      'Long-term memory server',
      'Intelligence features',
      'Try it',
      'Search the current meeting',
      'Test connection',
    ],
  },
  {
    file: 'openoffer-browser/src/popup.html',
    forbidden: [
      'Connect browser extension',
      'Capture once',
      'Connection string',
      'Manual connect',
    ],
  },
  {
    file: 'electron/services/phoneMirrorClient.ts',
    forbidden: [
      'Waiting for answers',
      'Open on your phone',
      'Follow-up</button>',
      'Screenshot',
    ],
  },
  {
    file: 'src/components/ui/TopPill.tsx',
    forbidden: [
      '>Hide<',
      '>Show<',
    ],
  },
];

for (const guard of migratedStringGuards) {
  const filePath = path.join(root, guard.file);
  if (!fs.existsSync(filePath)) {
    if (!guard.optional) fail(`Missing migrated file ${guard.file}`);
    continue;
  }
  const source = fs.readFileSync(filePath, 'utf8');
  for (const text of guard.forbidden) {
    if (source.includes(text)) {
      fail(`${guard.file} still contains migrated hardcoded string: ${text}`);
    }
  }
}

if (failures.length > 0) {
  console.error('i18n check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`i18n check passed: ${Object.keys(en).length} English keys, ${Object.keys(ru).length} Russian keys`);
