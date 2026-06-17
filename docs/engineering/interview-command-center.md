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
- `interview_client_operations`: idempotency records keyed by `(operation_id, action)`.

`meetings.interview_event_id` links existing recordings to an interview without changing the old meeting lifecycle.

## Main Process

The domain boundary is:

- `InterviewRepository`: SQLite persistence and idempotency.
- `InterviewService`: validation, domain errors, readiness scoring.
- `ipcHandlers.ts`: thin IPC bridge returning `InterviewIpcResult<T>`.
- `preload.ts` and `src/types/electron.d.ts`: typed renderer contract.

Calendar support uses the existing Google Calendar manager plus `MacCalendarManager`, which reads local macOS Calendar.app events via a bounded `/usr/bin/osascript` JXA bridge. If macOS calendar access is denied or unavailable, the reader returns `[]`.

## Renderer

`src/features/interviews/InterviewCommandCenter.tsx` is the launcher workspace:

- left calendar rail with Google/Mac source switch and event-to-interview creation;
- middle process list with search, creation, and recent recordings;
- detail pane for vacancy context, prep brief, retro, question bank, readiness, and meeting attachment.

`src/components/Launcher.tsx` keeps the existing app chrome, search, settings, modes, profile, and meeting-detail navigation, but renders the command center as the default launcher body.

## Verification

Targeted coverage:

- `InterviewRepository.test.mjs`: schema, idempotency, calendar uniqueness, prep/retro/questions, meeting link cleanup.
- `InterviewIpcWiring.test.mjs`: handler/preload/types bridge.
- `InterviewTaxonomy.test.mjs`: Obsidian workflow mapping.
- `MacCalendarManagerContract.test.mjs`: local macOS calendar bridge contract.
- `OpenOfferCommercialRemoval.test.mjs`: removed creator/donation/commercial surfaces stay absent.
