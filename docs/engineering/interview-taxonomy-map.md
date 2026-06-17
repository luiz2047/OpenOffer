# Interview Taxonomy Map

OpenOffer P1 does not import or sync Obsidian vaults. It preserves the user's
job-search workflow by mapping the important note sections into first-class local
interview fields so a future Markdown/Obsidian export can be lossless enough.

The executable source of truth is `electron/services/interviews/taxonomy.ts`.

Key mappings:

- Pre-interview goal -> `prep_briefs.one_line_goal`
- Pitches -> `prep_briefs.pitch_30s`, `prep_briefs.pitch_2m`
- Role fit -> `vacancy_dossiers.fit_hypothesis`
- Questions to ask -> `vacancy_dossiers.questions_to_ask_json`
- Risk handling -> `prep_briefs.risk_handling_json`, `vacancy_dossiers.risks_json`
- Last checklist -> `prep_briefs.last_checklist_json`
- Questions asked -> `interview_questions.question_text`
- Strong/weak moments -> `interview_retros.strong_moments_json`, `interview_retros.weak_moments_json`
- New facts and follow-ups -> `interview_retros.new_facts_json`, `interview_retros.follow_up_actions_json`
- Vacancy intake and requirements -> `interview_events.raw_source_text`, `vacancy_dossiers.description`, `vacancy_dossiers.requirements_json`

Explicit P1 deferrals:

- ATS scoring
- Resume edits / resume variants
- Obsidian import/export automation
