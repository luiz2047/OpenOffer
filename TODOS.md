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

- [ ] Production Google OAuth/proxy and calendar update/delete ADR after Release 1.
  - What: write a Calendar ADR for the production Google Calendar setup, then implement production OAuth/proxy hardening plus event update/delete semantics after the Release 1 create/sync path stabilizes.
  - Why: Release 1 should make basic provider status, sync, and event creation trustworthy; broader external calendar mutation remains a trust boundary that needs explicit policy before shipping as a durable platform behavior.
  - Pros: keeps Release 1 focused while preserving the path to reliable Google Calendar update/delete workflows.
  - Cons: OAuth scope expansion, hosted proxy ownership, conflict resolution, delete/update semantics, external mutation bugs, and permission copy.
  - Context: Release 1 owns the local provider matrix, explicit create action, bounded refresh, and local dedup/snapshot rules. This follow-up should define production OAuth, proxy deployment, source of truth, retries, update/delete policy, and rollback.
  - Effort: L
  - Priority: P2
  - Depends on / blocked by: Release 1 calendar trust dogfood and validation gate.

- [ ] Native EventKit replacement spike after Release 1 calendar dogfood.
  - What: evaluate whether the Release 1 JXA/Calendar.app bridge should be replaced with a native EventKit layer for macOS calendar read/write behavior.
  - Why: Release 1 should first prove the provider matrix, explicit sync, and event creation UX; native EventKit may still be needed for stronger permission handling, recurrence behavior, and long-term packaging reliability.
  - Pros: keeps the Mac calendar path local-first while giving a clear upgrade route if JXA proves brittle.
  - Cons: native permission prompts, signing/package implications, recurrence/conflict behavior, platform-specific code, and extra test matrix.
  - Context: Release 1 owns Mac Calendar through the existing `MacCalendarManager` plus `CalendarProviderCoordinator`. This follow-up should compare JXA vs EventKit and produce an ADR covering capabilities, permission UX, failure modes, tests, and packaging notes.
  - Effort: M-L
  - Priority: P3
  - Depends on / blocked by: Release 1 calendar trust dogfood.

- [ ] Internal namespace cleanup after OpenOffer v0.1 hard-delete lands.
  - What: rename remaining internal Natively-era filenames, comments, localStorage keys, logs, DB names, and non-user-visible symbols to OpenOffer equivalents where it is safe.
  - Why: the v0.1 fork should first remove public hosted/commercial behavior; after that is stable, mixed internal naming will mislead future contributors and make it easier to reintroduce old product assumptions.
  - Pros: cleaner contributor mental model, fewer stale brand references, easier future documentation and onboarding.
  - Cons: high merge-conflict risk if bundled with the hard-delete branch; some internal naming debt remains temporarily.
  - Context: approved in `/plan-eng-review` as a follow-up, not part of the first hard-delete implementation. Start with `rg "Natively|natively|Premium|trial|license"` and separate user-visible leftovers from purely internal compatibility keys.
  - Depends on / blocked by: OpenOffer v0.1 public rebrand and commercial hard-delete passing build, tests, and local app smoke.
