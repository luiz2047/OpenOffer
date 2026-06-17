# TODOs

## OpenOffer Follow-ups

- [ ] SQLCipher / encrypted local DB after interview P1.
  - What: design and implement SQLCipher or equivalent encrypted-at-rest storage for the local OpenOffer SQLite DB.
  - Why: interview dossiers, prep, retros, contacts, and calendar snapshots are sensitive; local-first trust improves when the DB is encrypted beyond OS disk encryption.
  - Pros: reduces risk from DB file access in backups/filesystem snooping; strengthens the privacy story for job-search data.
  - Cons: native dependency, migration, recovery, packaging/signing, CI, and rollback complexity.
  - Context: P1 intentionally uses plaintext local SQLite with honest product copy. Start after the interview schema and command center loop have stabilized.
  - Effort: L
  - Priority: P2
  - Depends on / blocked by: P1 interview schema stabilized and launch smoke passing.

- [ ] Markdown / Obsidian-compatible interview export.
  - What: export one interview event, then selected ranges/processes, as Markdown compatible with Obsidian-style vault workflows.
  - Why: users should be able to take dossiers, prep, questions, retros, and linked context out of OpenOffer without SQLite lock-in.
  - Pros: improves trust, local-first credibility, backups, and compatibility with existing Obsidian habits.
  - Cons: requires stable Markdown schema, export UI, tests, escaping, and long-text handling.
  - Context: P1 schema should preserve exportable sections but does not implement export. Build after P1 dogfood.
  - Effort: M
  - Priority: P2
  - Depends on / blocked by: P1 schema/content model shipped.

- [ ] Calendar ADR and Google Calendar write-back after P1.
  - What: write a Calendar ADR, then implement Google Calendar event creation/update for interview events.
  - Why: users want interviews added from OpenOffer to their calendars, but external calendar mutation is a trust boundary.
  - Pros: closes the create/schedule loop and unlocks stronger calendar-native workflows.
  - Cons: OAuth scope expansion, conflict resolution, delete/update semantics, external mutation bugs, and permission copy.
  - Context: P1 is read-only calendar integration using `CalendarManager.getUpcomingEvents()` and local snapshots. ADR should define scopes, source of truth, retries, delete policy, and rollback.
  - Effort: L
  - Priority: P2
  - Depends on / blocked by: P1 dogfood and validation gate.

- [ ] Mac Calendar / EventKit spike.
  - What: spike native macOS Calendar/EventKit read/write integration for interview events.
  - Why: many macOS users rely on native Calendar, and local-first calendar integration fits OpenOffer better than Google-only support.
  - Pros: stronger macOS-native UX, less Google dependency, and better local-first story.
  - Cons: native permission prompts, signing/package implications, recurrence/conflict behavior, and platform-specific code.
  - Context: P1 does not include EventKit. This spike should produce an ADR covering capabilities, permission UX, failure modes, test plan, and packaging notes.
  - Effort: M-L
  - Priority: P3
  - Depends on / blocked by: P1 interview loop; ideally after Calendar ADR.

- [ ] Internal namespace cleanup after OpenOffer v0.1 hard-delete lands.
  - What: rename remaining internal Natively-era filenames, comments, localStorage keys, logs, DB names, and non-user-visible symbols to OpenOffer equivalents where it is safe.
  - Why: the v0.1 fork should first remove public hosted/commercial behavior; after that is stable, mixed internal naming will mislead future contributors and make it easier to reintroduce old product assumptions.
  - Pros: cleaner contributor mental model, fewer stale brand references, easier future documentation and onboarding.
  - Cons: high merge-conflict risk if bundled with the hard-delete branch; some internal naming debt remains temporarily.
  - Context: approved in `/plan-eng-review` as a follow-up, not part of the first hard-delete implementation. Start with `rg "Natively|natively|Premium|trial|license"` and separate user-visible leftovers from purely internal compatibility keys.
  - Depends on / blocked by: OpenOffer v0.1 public rebrand and commercial hard-delete passing build, tests, and local app smoke.
