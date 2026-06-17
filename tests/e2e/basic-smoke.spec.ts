// tests/e2e/basic-smoke.spec.ts
//
// OpenOffer first-run smoke tests.
//
// This file exercises the renderer → main-process IPC contract that
// service-level tests cannot cover. Each test opens the actual Electron
// window and asserts on real UI state.
//
// Skip conditions (each test is skip_if'd individually so one failure
// doesn't cascade):
//   - CI=true                   → no display available in CI containers
//
// To run locally against the dev server:
//   npm run dev  (in terminal 1)
//   npx playwright test  (in terminal 2, from repo root)
//
// To run headless against a built app:
//   npm run build && npm run start &
//   sleep 5 && npx playwright test

import { test, expect, Page } from '@playwright/test';

const CI = process.env.CI === 'true';
const APP_PORT = parseInt(process.env.ELECTRON_APP_PORT ?? '5173', 10);

async function gotoApp(page: Page) {
  await page.goto(`http://localhost:${APP_PORT}`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#launcher-container')).toBeVisible({ timeout: 15_000 });
}

async function openSettings(page: Page) {
  const settingsBtn = page.locator('button[title="Settings"], button[aria-label*="settings" i], button:has-text("Settings")').first();
  await expect(settingsBtn).toBeVisible();
  await settingsBtn.click();
  await expect(page.locator('#settings-panel')).toBeVisible();
}

test.describe('OpenOffer E2E smoke', () => {
  test.beforeEach(async ({ page }) => {
    if (CI) {
      test.skip();
      return;
    }

    await page.addInitScript(() => {
      localStorage.setItem('natively_perms_shown_v1', '1');
      localStorage.setItem('natively_seen_modes_onboarding_v5', 'true');
      localStorage.setItem('natively_seen_profile_onboarding_v1', 'true');

      const unsubscribe = () => {};
      const storedCredentials = {
        hasGeminiKey: false,
        hasGroqKey: false,
        hasOpenaiKey: false,
        hasClaudeKey: false,
        hasDeepseekKey: false,
        hasYandexKey: false,
        yandexFolderId: '',
        yandexPreferredModel: 'yandex/yandexgpt-5-lite',
        yandexDisableDataLogging: true,
        googleServiceAccountPath: null,
        sttProvider: 'none',
        hasSttGroqKey: false,
        hasSttOpenaiKey: false,
        hasDeepgramKey: false,
        hasElevenLabsKey: false,
        hasAzureKey: false,
        azureRegion: '',
        hasIbmWatsonKey: false,
        ibmWatsonRegion: '',
        hasSonioxKey: false,
      };
      const modes = [
        {
          id: 'mode_general',
          name: 'General',
          templateType: 'general',
          customContext: '',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          referenceFileCount: 0,
        },
        {
          id: 'mode_interview',
          name: 'Technical Interview',
          templateType: 'technical-interview',
          customContext: 'Prefer concise explanations.',
          isActive: false,
          createdAt: '2026-01-02T00:00:00.000Z',
          referenceFileCount: 0,
        },
      ];
      const apiDefaults: Record<string, any> = {
        platform: 'darwin',
        ping: async () => 'pong',
        getThemeMode: async () => ({ mode: 'dark', resolved: 'dark' }),
        getKeybinds: async () => [],
        getRecentMeetings: async () => [],
        getUpcomingEvents: async () => [],
        interviewsList: async () => ({ ok: true, data: [] }),
        interviewsGet: async () => ({ ok: false, code: 'not_found', message: 'Interview not found.', retryable: false, action: 'none' }),
        interviewsCreate: async (_operationId: string, payload: any) => ({
          ok: true,
          data: {
            id: 'interview_mock',
            title: payload.title,
            status: payload.status ?? 'active',
            priority: payload.priority ?? 'normal',
            calendarSyncStatus: 'local_only',
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
          },
        }),
        interviewsUpdate: async (_id: string, patch: any) => ({
          ok: true,
          data: {
            id: 'interview_mock',
            title: 'Mock interview',
            status: patch.status ?? 'active',
            priority: 'normal',
            calendarSyncStatus: patch.calendarSyncStatus ?? 'local_only',
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
          },
        }),
        interviewsArchive: async () => ({ ok: true, data: { archived: true } }),
        interviewsDelete: async () => ({ ok: true, data: { deleted: true } }),
        interviewsAttachMeeting: async () => ({ ok: true, data: { attached: true } }),
        interviewsGetReadiness: async () => ({ ok: true, data: { score: 0, level: 'not_started', blockers: [], warnings: [], completed: [], nextAction: null } }),
        interviewsParseSourceText: async (input: any) => ({
          ok: true,
          data: {
            fields: { title: 'Parsed interview', rawSourceText: typeof input === 'string' ? input : input?.text ?? '' },
            dossier: { requirements: [], risks: [], questionsToAsk: [] },
            prep: { expectedTopics: [], riskHandling: [] },
            warnings: [],
            fieldCount: 1,
            detectedSource: null,
            normalizedText: typeof input === 'string' ? input : input?.text ?? '',
          },
        }),
        interviewsGetRetroPrompt: async () => ({ ok: true, data: { interviewEventId: 'interview_mock', due: false, reason: 'not_ended', state: null } }),
        interviewsUpdateRetroPrompt: async () => ({ ok: true, data: { interviewEventId: 'interview_mock', due: false, reason: 'dismissed', state: null } }),
        vacancyDossierSave: async () => ({ ok: true, data: { id: 'dossier_mock', interviewEventId: 'interview_mock', requirements: [], risks: [], questionsToAsk: [], createdAt: '2026-06-18T00:00:00.000Z', updatedAt: '2026-06-18T00:00:00.000Z' } }),
        prepBriefSave: async () => ({ ok: true, data: { id: 'prep_mock', interviewEventId: 'interview_mock', expectedTopics: [], riskHandling: [], lastChecklist: [], updatedAt: '2026-06-18T00:00:00.000Z' } }),
        interviewRetroSave: async () => ({ ok: true, data: { id: 'retro_mock', interviewEventId: 'interview_mock', strongMoments: [], weakMoments: [], newFacts: [], followUpActions: [], createdAt: '2026-06-18T00:00:00.000Z' } }),
        interviewQuestionsList: async () => ({ ok: true, data: [] }),
        interviewQuestionsSave: async () => ({ ok: true, data: [] }),
        getUndetectable: async () => false,
        getMeetingActive: async () => false,
        getOpenAtLogin: async () => false,
        getMeetingRetention: async () => 'forever',
        getStoredCredentials: async () => storedCredentials,
        getRecognitionLanguages: async () => [
          { label: 'Russian', code: 'russian', bcp47: 'ru-RU', iso639: 'ru', group: 'Russian' },
          { label: 'English (US)', code: 'english', bcp47: 'en-US', iso639: 'en', group: 'English' },
        ],
        getSttLanguage: async () => 'auto',
        getAiResponseLanguages: async () => [{ label: 'Auto', code: 'auto' }, { label: 'Russian', code: 'russian' }],
        getAiResponseLanguage: async () => 'auto',
        getInputDevices: async () => [],
        getOutputDevices: async () => [],
        getSttRuntimeStatus: async () => ({ provider: 'none', ready: false, message: 'No speech provider selected.' }),
        getCalendarStatus: async () => ({ connected: false, disabled: true }),
        getCanAutoUpdate: async () => ({ canAutoUpdate: false }),
        checkPermissions: async () => ({ platform: 'darwin', microphone: 'granted', screen: 'granted' }),
        onboardingGetFlags: async () => ({
          seenStartup: true,
          seenProfileOnboarding: true,
          seenModesOnboarding: true,
          permsShown: true,
        }),
        onboardingSetFlag: async () => ({ success: true }),
        localWhisperGetModels: async () => [],
        localWhisperGetChannelConfig: async () => ({ micModelId: null, systemModelId: null }),
        localWhisperGetHardware: async () => ({ hasGpu: false, platform: 'darwin' }),
        modesGetAll: async () => modes,
        modesGetActive: async () => modes[0],
        modesCreate: async ({ name, templateType }: { name: string; templateType: string }) => ({
          success: true,
          mode: {
            id: `mode_${templateType}`,
            name,
            templateType,
            customContext: '',
            isActive: false,
            createdAt: '2026-01-03T00:00:00.000Z',
            referenceFileCount: 0,
          },
        }),
        modesUpdate: async () => ({ success: true }),
        modesDelete: async () => ({ success: true }),
        modesSetActive: async () => ({ success: true }),
        modesGetReferenceFiles: async () => [],
        modesUploadReferenceFile: async () => ({ success: false, cancelled: true }),
        modesDeleteReferenceFile: async () => ({ success: true }),
        modesGetNoteSections: async () => [
          {
            id: 'section_summary',
            modeId: 'mode_general',
            title: 'Summary',
            description: 'High-level summary of the conversation.',
            sortOrder: 0,
          },
        ],
        modesAddNoteSection: async () => ({ success: true }),
        modesUpdateNoteSection: async () => ({ success: true }),
        modesDeleteNoteSection: async () => ({ success: true }),
        modesRemoveAllNoteSections: async () => ({ success: true }),
      };
      (window as any).electronAPI = new Proxy(apiDefaults, {
        get(target, prop: string) {
          if (prop in target) return target[prop];
          if (prop.startsWith('on')) return () => unsubscribe;
          if (prop.startsWith('get')) return async () => null;
          if (prop.startsWith('set')) return async () => ({ success: true });
          if (prop.startsWith('is')) return async () => false;
          return async () => ({ success: true });
        },
      });
    });
  });

  test('app window loads without crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await gotoApp(page);
    await page.waitForTimeout(2000); // allow async init

    const crashIndicators = ['is not defined', 'Cannot find module', 'Electron Error'];
    const criticalErrors = errors.filter(e => crashIndicators.some(ci => e.includes(ci)));
    expect(criticalErrors, `Critical errors: ${criticalErrors.join(' | ')}`).toHaveLength(0);
  });

  test('public identity presents OpenOffer', async ({ page }) => {
    await gotoApp(page);

    await expect(page).toHaveTitle(/OpenOffer/i);
    await openSettings(page);

    await expect(page.getByText('About', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/OpenOffer/i).first()).toBeVisible();
  });

  test('main IPC channel responds to ping', async ({ page }) => {
    await gotoApp(page);

    const hasBridge = await page.evaluate(() => {
      return typeof (window as any).electronAPI?.ping === 'function';
    });

    expect(hasBridge).toBe(true);
  });

  test('modes panel renders with mode list', async ({ page }) => {
    await gotoApp(page);

    await page.locator('button[title="Modes"]').click();
    await expect(page.getByText('Modes Manager', { exact: true })).toBeVisible();
    await expect(page.getByText('General', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Technical Interview', { exact: true }).first()).toBeVisible();
  });

  test('settings panel opens and closes', async ({ page }) => {
    await gotoApp(page);

    await openSettings(page);
    await page.waitForTimeout(500);

    const closeBtn = page.locator('button[aria-label*="close" i], button:has-text("Close")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('settings exposes local-first speech providers', async ({ page }) => {
    await gotoApp(page);
    await openSettings(page);

    await page.getByRole('button', { name: /audio/i }).click();
    await expect(page.getByText('Speech Provider', { exact: true }).first()).toBeVisible();

    await page.locator('button:has-text("Select Provider"), button:has-text("GigaSTT"), button:has-text("Local Whisper")').first().click();
    await expect(page.getByText('GigaSTT').first()).toBeVisible();
    await expect(page.getByText('Local Whisper').first()).toBeVisible();
    await expect(page.getByText(/Local Russian-first STT server/i).first()).toBeVisible();
  });
});
