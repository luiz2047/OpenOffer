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
      const applications: any[] = [];
      const meetings = [
        { id: 'meeting_1', title: 'Backend interview recording', date: '2026-06-18T10:00:00.000Z', duration: '3600000', summary: '' },
      ];
      const fixedNow = '2026-06-18T00:00:00.000Z';
      let lastCreateFromIntakePayload: any = null;

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

      function linkedMeetingsForRow(row: any) {
        return meetings.filter((meeting: any) => (
          meeting.interviewEventId === row.id
          || (row.selectedStageId && meeting.interviewStageId === row.selectedStageId)
          || (row.applicationId && meeting.applicationId === row.applicationId)
        ));
      }

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
          linkedMeetings: linkedMeetingsForRow(item),
        };
      }

      function stagesForApplication(applicationId: string) {
        return interviews
          .filter(row => row.applicationId === applicationId && row.selectedStageId)
          .map(row => ({
            id: row.selectedStageId,
            applicationId,
            stageType: row.stageType ?? 'custom',
            title: row.stage ?? 'Interview',
            status: row.stageStatus ?? 'scheduled',
            startsAt: row.startsAt ?? null,
            endsAt: row.endsAt ?? null,
            timezone: row.timezone ?? 'UTC',
            format: 'online',
            meetingUrl: row.meetingUrl ?? null,
            calendarSyncStatus: row.calendarSyncStatus ?? 'local_only',
            rawSourceText: row.rawSourceText ?? null,
            legacyInterviewEventId: row.id,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            archivedAt: null,
          }))
          .sort((left, right) => (left.startsAt ?? Number.MAX_SAFE_INTEGER) - (right.startsAt ?? Number.MAX_SAFE_INTEGER));
      }

      function applicationDetail(id: string) {
        const application = applications.find(row => row.id === id);
        if (!application) return null;
        const stages = stagesForApplication(id);
        return {
          ...application,
          selectedStageId: stages[0]?.id ?? null,
          stages,
          dossier: application.dossier ?? null,
          linkedMeetings: meetings.filter((meeting: any) => (
            meeting.applicationId === id
            || stages.some(stage => meeting.interviewStageId === stage.id || meeting.interviewEventId === stage.legacyInterviewEventId)
          )),
        };
      }

      function createFromIntakePayload(payload: any) {
        const intake = payload.intake;
        const existing = payload.selectedApplicationId
          ? applications.find(row => row.id === payload.selectedApplicationId)
          : null;
        const applicationId = existing?.id ?? `app_${applications.length + 1}`;
        const legacyId = `interview_${interviews.length + 1}`;
        const stageId = intake.stage ? `stage_${interviews.length + 1}` : null;
        const title = existing?.title ?? intake.application.title ?? [intake.application.company, intake.application.roleTitle].filter(Boolean).join(' · ') ?? 'Untitled vacancy';
        const application = existing ?? {
          id: applicationId,
          title,
          company: intake.application.company ?? null,
          roleTitle: intake.application.roleTitle ?? null,
          status: intake.stage ? 'interviewing' : 'lead_found',
          priority: 'normal',
          source: intake.application.source ?? 'manual',
          vacancyUrl: intake.application.vacancyUrl ?? null,
          rawSourceText: intake.application.rawSourceText ?? null,
          legacyInterviewEventId: legacyId,
          createdAt: fixedNow,
          updatedAt: fixedNow,
          dossier: {
            id: `dossier_${legacyId}`,
            interviewEventId: legacyId,
            description: intake.application.description,
            requirements: intake.application.requirements ?? [],
            risks: intake.application.risks ?? [],
            questionsToAsk: intake.application.questionsToAsk ?? [],
          },
        };
        if (!existing) applications.unshift(application);
        if (existing && intake.stage) {
          existing.status = existing.status === 'lead_found' ? 'interviewing' : existing.status;
          existing.updatedAt = fixedNow;
        }
        const row = {
          id: legacyId,
          title,
          company: application.company ?? intake.application.company ?? null,
          roleTitle: application.roleTitle ?? intake.application.roleTitle ?? null,
          stage: intake.stage?.title ?? 'Recruiter screen',
          stageType: intake.stage?.stageType ?? 'custom',
          stageStatus: intake.stage?.status ?? (intake.stage ? 'scheduled' : 'draft'),
          status: intake.stage ? 'interviewing' : 'active',
          priority: 'normal',
          source: intake.application.source ?? application.source ?? 'manual',
          vacancyUrl: application.vacancyUrl ?? intake.application.vacancyUrl ?? null,
          meetingUrl: intake.stage?.meetingUrl ?? null,
          calendarSyncStatus: 'local_only',
          startsAt: intake.stage?.startsAt ?? null,
          endsAt: intake.stage?.endsAt ?? null,
          timezone: intake.stage?.timezone ?? 'UTC',
          rawSourceText: intake.application.rawSourceText ?? null,
          applicationId,
          selectedStageId: stageId,
          createdAt: fixedNow,
          updatedAt: fixedNow,
          dossier: application.dossier,
          questions: [],
          retros: [],
        };
        interviews.unshift(row);
        return {
          application: applicationDetail(applicationId),
          legacyInterview: detail(row.id),
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
          const row = interviews.find(item => item.id === id);
          Object.assign(row, patch);
          if (row?.applicationId && ['rejected', 'withdrawn', 'archived'].includes(patch.status)) {
            const application = applications.find(item => item.id === row.applicationId);
            if (application) application.status = patch.status;
          }
          return result(detail(id));
        },
        interviewsArchive: async (id: string) => {
          const row = interviews.find(item => item.id === id);
          if (row?.applicationId) {
            const application = applications.find(item => item.id === row.applicationId);
            if (application) application.status = 'archived';
          }
          interviews.splice(interviews.findIndex(item => item.id === id), 1);
          return result({ archived: true });
        },
        interviewsAttachMeeting: async (interviewId: string, meetingId: string) => {
          const row = interviews.find(item => item.id === interviewId);
          const meeting = meetings.find(item => item.id === meetingId);
          if (row && meeting) {
            Object.assign(meeting, {
              interviewEventId: row.id,
              interviewStageId: row.selectedStageId ?? null,
              applicationId: row.applicationId ?? null,
            });
          }
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
        applicationIntakeParse: async (input: any) => {
          const text = typeof input === 'string' ? input : input?.text ?? '';
          const candidateId = Array.isArray(input?.candidateApplicationIds) ? input.candidateApplicationIds[0] : null;
          if (/Synthetic (second )?stage update/i.test(text) && candidateId) {
            const second = /second/i.test(text);
            return result({
              classification: 'stage_update_for_existing_vacancy',
              confidence: 0.93,
              application: {
                title: second ? 'Different final-stage title' : 'Different recruiter text title',
                company: 'Different Parsed Company',
                roleTitle: 'Different Parsed Role',
                description: 'The parser intentionally returned different visible fields, but the AI matched the saved vacancy id.',
                source: 'Telegram',
                rawSourceText: text,
                requirements: [],
                risks: [],
                questionsToAsk: [],
              },
              stage: {
                title: second ? 'Final interview' : 'Tech screening',
                stageType: second ? 'final' : 'technical_screen',
                startsAt: second ? 1_803_456_000_000 : 1_802_588_400_000,
                endsAt: second ? 1_803_459_600_000 : 1_802_590_200_000,
                timezone: 'Europe/Moscow',
                meetingUrl: second ? 'https://meet.example/final' : 'https://meet.example/tech',
                status: 'scheduled',
              },
              existingApplicationMatch: {
                applicationId: candidateId,
                confidence: 0.93,
                reason: 'Matched from prior active vacancy context.',
              },
              warnings: [],
              missingFields: [],
            });
          }
          return result({
            classification: 'vacancy_only',
            confidence: 0.88,
            application: {
              title: 'Acme Backend interview',
              company: 'Acme',
              roleTitle: 'Backend Developer',
              description: 'Acme is hiring a Backend Developer for a production service team. The current process is a saved vacancy created from the pasted source.',
              source: 'HH',
              rawSourceText: text,
              requirements: ['Stack: Node.js', 'Stack: PostgreSQL', 'Responsibilities: Production debugging'],
              risks: ['Legacy stack'],
              questionsToAsk: ['How do releases work?'],
            },
            warnings: [],
            missingFields: [],
          });
        },
        applicationsList: async () => result(applications.map(application => applicationDetail(application.id))),
        applicationsGet: async (id: string) => {
          const application = applicationDetail(id);
          return application
            ? result(application)
            : { ok: false, code: 'not_found', message: 'Application not found.', retryable: false, action: 'none' };
        },
        applicationsCreateFromIntake: async (_operationId: string, payload: any) => {
          lastCreateFromIntakePayload = payload;
          return result(createFromIntakePayload(payload));
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
        interviewsGetRetroEvaluation: async (id: string) => result(detail(id)?.retroEvaluation ?? null),
        interviewsGenerateRetroEvaluation: async (id: string) => {
          const row = interviews.find(item => item.id === id);
          row.retroEvaluation = {
            id: `retro_eval_${id}`,
            interviewEventId: id,
            meetingId: row.linkedMeetings?.[0]?.id ?? 'meeting_1',
            status: 'ready',
            modelId: 'test-model',
            summary: 'AI summary says the interview had a clear backend signal.',
            signals: ['Explained transaction tradeoffs clearly'],
            risks: ['Need sharper Kubernetes example'],
            followups: ['Send a concise follow-up note'],
            confidence: 0.78,
            isActive: true,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
          };
          return result(row.retroEvaluation);
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

      (window as any).__openOfferTestState = {
        interviews,
        applications,
        meetings,
        get lastCreateFromIntakePayload() {
          return lastCreateFromIntakePayload;
        },
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

    const commandCenter = page.getByTestId('interview-command-center');
    await expect(page.getByText('Vacancy OS')).toBeVisible();
    await expect(commandCenter.getByRole('button', { name: 'Connect' })).toHaveCount(0);
    await expect(commandCenter.getByRole('button', { name: 'Sync not configured' })).toBeVisible();
    await expect(commandCenter.getByText('No events for this day.')).toBeVisible();
    await commandCenter.getByRole('button', { name: 'Previous week' }).click();
    await expect(commandCenter.getByText('No events for this day.')).toBeVisible();
    await page.getByRole('button', { name: /^Agent$/ }).click();
    const agentInput = page.locator('textarea[maxlength="50000"]');
    await expect(agentInput).toBeVisible();
    await expect(page.getByText('0/50000')).toBeVisible();
    await agentInput.fill('Synthetic recruiter note for Acme Backend Developer.');
    await page.getByRole('button', { name: 'Parse' }).click();
    await expect(page.getByText('Reading pasted text')).toBeVisible();
    await expect(page.getByText('Checking current vacancies')).toBeVisible();
    await expect(page.getByText('Extracting company, role, and summary')).toBeVisible();
    await expect(page.getByText('Comparing with active vacancies')).toBeVisible();
    await expect(page.getByText('Proposal ready')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: /^New Vacancy$/ }).click();
    await page.getByLabel('Source text').fill(`HH vacancy for Backend Developer at Acme.

Требования: Node.js, PostgreSQL, production debugging, distributed systems, clear communication, release ownership.
Зарплата: 400-500k.
  This long source text intentionally contains enough vacancy and recruiter context to verify that the detail pane does not render the entire raw paste by default. It should stay available for review, but the primary UI should stay compact for normal daily use.`);
    await page.getByRole('button', { name: 'Extract fields' }).click();
    await expect(page.getByText(/vacancy_only/)).toBeVisible();
    await page.getByRole('button', { name: 'Create vacancy' }).click();

    await expect(page.getByText('Acme Backend interview').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stages', exact: true })).toBeVisible();
    await expect(page.getByText('Acme is hiring a Backend Developer for a production service team.').first()).toBeVisible();
    await expect(page.getByText('Stack').first()).toBeVisible();
    await expect(page.getByText('Production debugging').first()).toBeVisible();
    await expect(page.getByText(/characters hidden/)).toBeVisible();
    await page.getByRole('button', { name: 'Show' }).click();

    await page.getByRole('button', { name: /^Agent$/ }).click();
    const stageAgentInput = page.locator('textarea[maxlength="50000"]');
    await stageAgentInput.fill('Synthetic stage update for existing saved vacancy.');
    await page.getByRole('button', { name: 'Parse' }).click();
    await expect(page.getByText(/Will add the stage to .Acme Backend interview./)).toBeVisible();
    await page.getByRole('button', { name: 'Add stage' }).click();
    await expect(page.getByText('Tech screening')).toBeVisible();
    await expect(page.getByText('1 active process')).toBeVisible();
    const firstAgentPayload = await page.evaluate(() => (window as any).__openOfferTestState.lastCreateFromIntakePayload);
    expect(firstAgentPayload.selectedApplicationId).toBe('app_1');

    await expect(page.getByText('Interview').first()).toBeVisible();
    await page.getByRole('button', { name: 'Prep', exact: true }).click();
    await page.getByLabel('Cheat sheet').fill('Review transactions and rollout tradeoffs.');
    await page.getByRole('button', { name: 'Save prep' }).click();

    await page.getByRole('button', { name: 'Questions', exact: true }).click();
    await page.getByPlaceholder('Question').fill('How do you debug a slow SQL query?');
    await page.getByPlaceholder('Category').fill('backend');
    await page.getByRole('button', { name: 'Add' }).click();
    await page.getByRole('button', { name: 'Save questions' }).click();
    await expect(page.getByText('How do you debug a slow SQL query?')).toBeVisible();

    await page.getByRole('button', { name: 'Stages', exact: true }).click();
    await page.locator('select').last().selectOption('meeting_1');
    await page.getByRole('button', { name: 'Link' }).click();
    await expect(page.getByText('Backend interview recording').last()).toBeVisible();

    await page.getByRole('button', { name: 'Retro', exact: true }).click();
    await page.getByRole('button', { name: 'Generate AI evaluation' }).click();
    await expect(page.getByText('AI summary says the interview had a clear backend signal.')).toBeVisible();
    await page.getByLabel('Main signal').fill('Strong backend signal, weak infra follow-up.');
    await page.getByRole('button', { name: 'Save retro' }).click();

    await page.getByRole('button', { name: /^Agent$/ }).click();
    const secondStageAgentInput = page.locator('textarea[maxlength="50000"]');
    await secondStageAgentInput.fill('Synthetic second stage update for existing saved vacancy.');
    await page.getByRole('button', { name: 'Parse' }).click();
    await expect(page.getByText(/Will add the stage to .Acme Backend interview./)).toBeVisible();
    await page.getByRole('button', { name: 'Add stage' }).click();
    await expect(page.getByText('2 stages')).toBeVisible();
    const secondAgentPayload = await page.evaluate(() => (window as any).__openOfferTestState.lastCreateFromIntakePayload);
    expect(secondAgentPayload.selectedApplicationId).toBe('app_1');

    await page.getByRole('button', { name: 'Stages', exact: true }).click();
    const stageCards = page.getByTestId('interview-stage-card');
    await expect(stageCards).toHaveCount(2);
    await expect(stageCards.filter({ hasText: 'Tech screening' }).getByTestId('stage-recording-count')).toHaveText('1');
    await expect(stageCards.filter({ hasText: 'Final interview' }).getByTestId('stage-recording-count')).toHaveText('0');
  });
});
