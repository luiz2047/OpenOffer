# Interview Command Center

OpenOffer now opens into a local-first interview search workspace instead of a product landing surface.

## Data Model

Migration v17 in `electron/db/DatabaseManager.ts` installs the interview domain schema from `electron/services/interviews/schema.ts`.

Core tables:

- `interview_events`: one process or scheduled interview.
- `vacancy_dossiers`: vacancy context, requirements, risks, questions to ask.
- `prep_briefs`: pitch, cheat sheet, expected topics, final checklist.
- `interview_retros`: post-call signal and follow-up actions.
- `interview_questions`: reusable question bank.
- `contacts` and `interview_contacts`: interviewer/HR relationships.
- `retro_prompt_state`: one-shot post-interview prompt state with snooze, dismiss, and completion timestamps.
- `interview_client_operations`: idempotency records keyed by `(operation_id, action)`.

`meetings.interview_event_id` links existing recordings to an interview without changing the old meeting lifecycle.
Starting a meeting from a selected interview passes `interviewEventId` through the renderer, main process, session snapshot, and `MeetingPersistence`. Explicit interview metadata wins; otherwise `DatabaseManager.saveMeeting` preserves a placeholder link or auto-links by `calendar_event_id` only when exactly one active interview matches.

## Main Process

The domain boundary is:

- `InterviewRepository`: SQLite persistence and idempotency.
- `InterviewService`: validation, domain errors, source parsing, readiness scoring, retro prompt decisions.
- `parser.ts`: deterministic paste parser for HH/Getmatch/Telegram/calendar text. It strips HTML/script content, bounds input size, extracts source/company/role/URLs/requirements/compensation/questions, and always stores sanitized raw text as fallback.
- `ipcHandlers.ts`: thin IPC bridge returning `InterviewIpcResult<T>`.
- `preload.ts` and `src/types/electron.d.ts`: typed renderer contract.

Calendar support uses the existing Google Calendar manager plus `MacCalendarManager`, which reads local macOS Calendar.app events via a bounded `/usr/bin/osascript` JXA bridge. If macOS calendar access is denied or unavailable, the reader returns `[]`.

## Renderer

`src/features/interviews/InterviewCommandCenter.tsx` is the launcher workspace:

- left calendar rail with Google/Mac source switch and event-to-interview creation;
- middle process list with search, creation, and recent recordings;
- detail pane for editable vacancy dossier, prep brief, retro, question bank, readiness, and meeting attachment;
- manual intake parser that can prefill an interview and save the parsed dossier/prep immediately after creation;
- local draft recovery for vacancy, prep, and retro editors under `openoffer:interviews:draft:*`, cleared after successful save.

`src/components/Launcher.tsx` keeps the existing app chrome, search, settings, modes, profile, and meeting-detail navigation, but renders the command center as the default launcher body.

## Verification

Targeted coverage:

- `InterviewRepository.test.mjs`: schema, idempotency, calendar uniqueness, prep/retro/questions, meeting link cleanup.
- `InterviewRepository.test.mjs`: source parser, dossier save, bounded list size, retro prompt lifecycle.
- `InterviewIpcWiring.test.mjs`: handler/preload/types bridge.
- `InterviewMeetingLinkContract.test.mjs`: start-from-interview metadata, persistence snapshot, DB auto-link contract.
- `InterviewCommandCenterHardening.test.mjs`: local draft recovery and paste/privacy invariants.
- `InterviewTaxonomy.test.mjs`: Obsidian workflow mapping.
- `MacCalendarManagerContract.test.mjs`: local macOS calendar bridge contract.
- `OpenOfferCommercialRemoval.test.mjs`: removed creator/donation/commercial surfaces stay absent.
