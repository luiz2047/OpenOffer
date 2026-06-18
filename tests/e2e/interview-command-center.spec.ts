import { test, expect, Page } from '@playwright/test';

const CI = process.env.CI === 'true';
const APP_PORT = parseInt(process.env.ELECTRON_APP_PORT ?? '5173', 10);

async function gotoApp(page: Page) {
  await page.goto(`http://localhost:${APP_PORT}`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#launcher-container')).toBeVisible({ timeout: 15_000 });
}

test.describe('Interview Command Center', () => {
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
      const interviews: any[] = [];
      const meetings = [
        { id: 'meeting_1', title: 'Backend interview recording', date: '2026-06-18T10:00:00.000Z', duration: '3600000', summary: '' },
      ];

      function result<T>(data: T) {
        return { ok: true, data };
      }

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
      ];

      function detail(id: string) {
        const item = interviews.find(row => row.id === id);
        if (!item) return null;
        return {
          ...item,
          dossier: item.dossier ?? null,
          prep: item.prep ?? null,
          retros: item.retros ?? [],
          questions: item.questions ?? [],
          contacts: [],
          linkedMeetings: item.linkedMeetings ?? [],
        };
      }

      const apiDefaults: Record<string, any> = {
        platform: 'darwin',
        ping: async () => 'pong',
        getThemeMode: async () => ({ mode: 'dark', resolved: 'dark' }),
        getKeybinds: async () => [],
        getRecentMeetings: async () => meetings,
        getUpcomingEvents: async () => [],
        getMeetingActive: async () => false,
        getUndetectable: async () => false,
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
        calendarConnect: async () => ({ success: true }),
        onboardingGetFlags: async () => ({ seenStartup: true, seenProfileOnboarding: true, seenModesOnboarding: true, permsShown: true }),
        onboardingSetFlag: async () => ({ success: true }),
        checkPermissions: async () => ({ platform: 'darwin', microphone: 'granted', screen: 'granted' }),
        localWhisperGetModels: async () => [],
        localWhisperGetChannelConfig: async () => ({ micModelId: null, systemModelId: null }),
        localWhisperGetHardware: async () => ({ hasGpu: false, platform: 'darwin' }),
        modesGetAll: async () => modes,
        modesGetActive: async () => modes[0],
        modesCreate: async () => ({ success: true, mode: modes[0] }),
        modesUpdate: async () => ({ success: true }),
        modesDelete: async () => ({ success: true }),
        modesSetActive: async () => ({ success: true }),
        modesGetReferenceFiles: async () => [],
        modesUploadReferenceFile: async () => ({ success: false, cancelled: true }),
        modesDeleteReferenceFile: async () => ({ success: true }),
        modesGetNoteSections: async () => [],
        modesAddNoteSection: async () => ({ success: true }),
        modesUpdateNoteSection: async () => ({ success: true }),
        modesDeleteNoteSection: async () => ({ success: true }),
        modesRemoveAllNoteSections: async () => ({ success: true }),
        interviewsList: async () => result(interviews.map(({ dossier, prep, retros, questions, linkedMeetings, rawSourceText, ...row }) => ({
          ...row,
          linkedMeetingCount: linkedMeetings?.length ?? 0,
          questionCount: questions?.length ?? 0,
        }))),
        interviewsGet: async ({ id }: { id: string }) => {
          const row = detail(id);
          return row
            ? result(row)
            : { ok: false, code: 'not_found', message: 'Interview not found.', retryable: false, action: 'none' };
        },
        interviewsCreate: async (_operationId: string, payload: any) => {
          const row = {
            id: `interview_${interviews.length + 1}`,
            title: payload.title,
            company: payload.company ?? null,
            roleTitle: payload.roleTitle ?? null,
            stage: payload.stage ?? null,
            status: payload.status ?? 'active',
            priority: payload.priority ?? 'normal',
            source: payload.source ?? 'manual',
            vacancyUrl: payload.vacancyUrl ?? null,
            meetingUrl: payload.meetingUrl ?? null,
            calendarSyncStatus: 'local_only',
            startsAt: payload.startsAt ?? null,
            endsAt: payload.endsAt ?? null,
            timezone: payload.timezone ?? 'UTC',
            rawSourceText: payload.rawSourceText ?? null,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
            questions: [],
            retros: [],
            linkedMeetings: [],
          };
          interviews.unshift(row);
          return result(detail(row.id));
        },
        interviewsUpdate: async (id: string, patch: any) => {
          Object.assign(interviews.find(row => row.id === id), patch);
          return result(detail(id));
        },
        interviewsArchive: async (id: string) => {
          interviews.splice(interviews.findIndex(row => row.id === id), 1);
          return result({ archived: true });
        },
        interviewsAttachMeeting: async (interviewId: string, meetingId: string) => {
          const row = interviews.find(item => item.id === interviewId);
          const meeting = meetings.find(item => item.id === meetingId);
          if (row && meeting) row.linkedMeetings = [{ id: meeting.id, title: meeting.title, date: meeting.date, duration: meeting.duration }];
          return result({ attached: true });
        },
        interviewsParseSourceText: async (input: any) => {
          const text = typeof input === 'string' ? input : input?.text ?? '';
          return result({
            fields: {
              title: 'Acme Backend interview',
              company: 'Acme',
              roleTitle: 'Backend Developer',
              rawSourceText: text,
            },
            dossier: { requirements: ['Node.js'], risks: ['Legacy stack'], questionsToAsk: ['How do releases work?'] },
            prep: { expectedTopics: ['Node.js'], cheatsheet: 'Review transactions', riskHandling: ['Name tradeoffs'] },
            warnings: [],
            fieldCount: 5,
            detectedSource: 'HH',
            normalizedText: text,
          });
        },
        vacancyDossierSave: async (id: string, _operationId: string, payload: any) => {
          const row = interviews.find(item => item.id === id);
          row.dossier = { id: `dossier_${id}`, interviewEventId: id, ...payload, createdAt: '2026-06-18T00:00:00.000Z', updatedAt: '2026-06-18T00:00:00.000Z' };
          return result(row.dossier);
        },
        prepBriefSave: async (id: string, _operationId: string, payload: any) => {
          const row = interviews.find(item => item.id === id);
          row.prep = { id: `prep_${id}`, interviewEventId: id, ...payload, updatedAt: '2026-06-18T00:00:00.000Z' };
          return result(row.prep);
        },
        interviewRetroSave: async (id: string, _operationId: string, payload: any) => {
          const row = interviews.find(item => item.id === id);
          row.retros = [{ id: `retro_${id}`, interviewEventId: id, ...payload, createdAt: '2026-06-18T00:00:00.000Z' }];
          return result(row.retros[0]);
        },
        interviewQuestionsSave: async (id: string, _operationId: string, questions: any[]) => {
          const row = interviews.find(item => item.id === id);
          row.questions = questions.map((question, index) => ({ id: question.id ?? `question_${index}`, interviewEventId: id, ...question, createdAt: '2026-06-18T00:00:00.000Z' }));
          return result(row.questions);
        },
        interviewsGetReadiness: async (id: string) => result({
          score: detail(id)?.prep ? 85 : 35,
          level: detail(id)?.prep ? 'ready' : 'needs_work',
          blockers: detail(id)?.prep ? [] : ['prep_missing'],
          warnings: [],
          completed: [],
          nextAction: detail(id)?.prep ? null : 'prep_missing',
        }),
        interviewsGetRetroPrompt: async (id: string) => result({ interviewEventId: id, due: false, reason: 'not_ended', state: null }),
        interviewsUpdateRetroPrompt: async (id: string) => result({ interviewEventId: id, due: false, reason: 'dismissed', state: null }),
        startMeeting: async () => ({ success: true }),
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

  test('manual process flow covers create, prep, questions, retro, and recording link', async ({ page }) => {
    await gotoApp(page);

    await expect(page.getByText('Interview OS')).toBeVisible();
    await page.getByRole('button', { name: /^Interview$/ }).click();
    await page.getByLabel('Source text').fill('HH vacancy for Backend Developer at Acme. Требования: Node.js. Зарплата: 400-500k.');
    await page.getByRole('button', { name: 'Parse' }).click();
    await expect(page.getByText(/5 fields detected/)).toBeVisible();
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Acme Backend interview').first()).toBeVisible();
    await page.getByRole('button', { name: 'Prep', exact: true }).click();
    await page.getByLabel('Cheat sheet').fill('Review transactions and rollout tradeoffs.');
    await page.getByRole('button', { name: 'Save prep' }).click();
    await expect(page.getByText('Readiness')).toBeVisible();

    await page.getByRole('button', { name: 'Questions', exact: true }).click();
    await page.getByPlaceholder('Question').fill('How do you debug a slow SQL query?');
    await page.getByPlaceholder('Category').fill('backend');
    await page.getByRole('button', { name: 'Add' }).click();
    await page.getByRole('button', { name: 'Save questions' }).click();
    await expect(page.getByText('How do you debug a slow SQL query?')).toBeVisible();

    await page.getByRole('button', { name: 'Retro', exact: true }).click();
    await page.getByLabel('Main signal').fill('Strong backend signal, weak infra follow-up.');
    await page.getByRole('button', { name: 'Save retro' }).click();

    await page.getByRole('button', { name: 'Vacancy', exact: true }).click();
    await page.locator('select').last().selectOption('meeting_1');
    await page.getByRole('button', { name: 'Link' }).click();
    await expect(page.getByText('Backend interview recording').last()).toBeVisible();
  });
});
