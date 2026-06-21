# Interview Command Center

OpenOffer opens into a local-first job-search workspace. The current shape is vacancy-centered: the top search pill is the AI assistant/search surface, the left rail is the calendar/day agenda, the center column is active vacancies, and the right pane shows the selected vacancy with its stages, prep, retro, and questions.

## Data Model

Migrations v17-v19 in `electron/db/DatabaseManager.ts` install and backfill the interview domain through `electron/services/interviews/schema.ts`.

Primary entities:

- `applications`: one vacancy or job-search process. This is the center-column unit.
- `interview_stages`: scheduled or draft interview steps under an application.
- `legacy_interview_event_map`: compatibility map from old `interview_events` rows to application/stage ids.
- `interview_events`: legacy event rows still used by existing meeting, prep, retro, question, and calendar contracts.
- `vacancy_dossiers`: vacancy context, requirements, risks, compensation, and questions to ask.
- `prep_briefs`: pitch, cheat sheet, expected topics, risk handling, and last-call checklist.
- `interview_retros`: manual post-call notes.
- `interview_retro_evaluations`: AI-generated retro evaluation tied to a meeting, stage, event, or application.
- `interview_questions`: reusable question bank.
- `contacts` and `interview_contacts`: interviewer and recruiter relationships.
- `retro_prompt_state`: post-interview prompt state with snooze, dismiss, and completion timestamps.
- `interview_client_operations`: idempotency records keyed by `(operation_id, action)`.

`meetings` can link by `interview_event_id`, `interview_stage_id`, and `application_id`. Starting a recording from a selected stage passes all three ids where available. Stage-level links are preferred; application-level links are only treated as stage recordings for single-stage applications.

## Main Process

The domain boundary is:

- `InterviewRepository`: SQLite persistence, idempotency, application/stage creation, legacy mapping, meeting linkage, and status/archive synchronization.
- `InterviewService`: validation, domain errors, deterministic parsing, AI-assisted intake, task model policy, readiness scoring for legacy support, retro prompt decisions, and AI retro generation.
- `parser.ts`: deterministic paste parser for HH/Getmatch/Telegram/calendar text. It strips HTML/script content, bounds input size, extracts source/company/role/URLs/requirements/compensation/questions/stage data, and stores sanitized raw text as fallback.
- `TaskModelPolicy`: resolves the model for agent, scraping, and vacancy-intake tasks from task-specific settings or existing provider defaults.
- `ipcHandlers.ts`: thin IPC bridge returning `InterviewIpcResult<T>`.
- `preload.ts` and `src/types/electron.d.ts`: typed renderer contract.

Calendar support uses the existing Google Calendar manager plus `MacCalendarManager`. Google reads events and creates interview events through the Calendar API while token exchange/refresh stay behind the explicit proxy. macOS reads and creates Calendar.app events through bounded `/usr/bin/osascript` JXA bridges. If calendar access is denied or unavailable, the reader returns `[]`.

## Renderer

`src/features/interviews/InterviewCommandCenter.tsx` is the launcher workspace:

- left calendar rail with week navigation and selected-day links to calendar events or scheduled interview stages;
- compact synchronization control that opens calendar settings when no source is configured;
- middle active-vacancy list built from `applications`, with legacy `interview_events` only as fallback;
- top search assistant bridge that searches vacancies, stages, and meetings, parses pasted recruiter/vacancy/calendar text, reviews editable proposals, and applies only from the explicit proposal button;
- right detail pane with `Vacancy`, `Stages`, `Prep`, `Retro`, and `Questions` tabs;
- stage cards that show schedule, status, meeting URL, and recordings scoped to that exact stage;
- local draft recovery for vacancy, prep, and retro editors under `openoffer:interviews:draft:*`, cleared after successful save.

The assistant flow only auto-attaches a stage proposal when the backend match is strong or the local vacancy match is unambiguous. Weak, stale, missing, or ambiguous matches require an explicit vacancy selection before applying.

## Verification

Targeted coverage:

- `InterviewRepository.test.mjs`: schema, idempotency, application/stage creation, legacy mapping, status/archive synchronization, stage/application meeting link metadata, prep/retro/questions, parser behavior, and retro evaluation storage.
- `TaskModelPolicy.test.mjs`: task-specific model defaults and honest fallback/unavailable behavior.
- `InterviewIpcWiring.test.mjs`: handler/preload/types bridge.
- `InterviewMeetingLinkContract.test.mjs`: start-from-interview metadata, persistence snapshot, DB auto-link contract.
- `InterviewCommandCenterHardening.test.mjs`: local draft recovery and paste/privacy invariants.
- `InterviewCalendarWriteContract.test.mjs`: Google/macOS outbound event creation and renderer/IPC contract.
- `InterviewTaxonomy.test.mjs`: Obsidian workflow mapping.
- `MacCalendarManagerContract.test.mjs`: local macOS calendar bridge contract.
- `tests/e2e/interview-command-center.spec.ts`: top assistant proposal review, no accidental Enter apply, active application center list, add-stage-to-existing-vacancy behavior, old agent/search surface removal, per-stage recording counts, calendar week navigation, compact raw-source rendering, prep/questions/retro flow.
