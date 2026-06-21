# Community Launch Pack

This document turns the approved community-launch direction into concrete public surfaces.

## Positioning

OpenOffer is a local-first, open-source workspace for job-search processes, interviews, recruiter chats, meetings, and notes.

The first tribe is developers who are actively interviewing and want an inspectable assistant they can run, audit, and adapt. The first demo is recruiter chat to local process.

## Launch Checklist

- [x] README leads with recruiter chat to process.
- [x] Project status says the current public version.
- [x] Release guide is OpenOffer-specific.
- [x] Stale funding link removed.
- [x] Package metadata has repository, homepage, bugs, and keywords.
- [x] PR quality workflow added.
- [x] Issue and PR templates ask for workflow, privacy, provider, and i18n context.
- [x] AGPL FAQ published.
- [x] Maintainer expectations published.
- [x] Enable GitHub Discussions.
- [x] Add repository topics.
- [x] Create starter issues.
- [ ] Publish source or signed release notes for the current public version.
- [ ] Add GitHub social preview image.

## Repository Topics

Recommended topics:

- `local-first`
- `open-source`
- `ai-assistant`
- `job-search`
- `interview-preparation`
- `electron`
- `speech-to-text`
- `ollama`
- `byok`
- `russian`

## Starter Issues

1. [`Docs: record a redacted recruiter-chat-to-process demo`](https://github.com/luiz2047/OpenOffer/issues/8)
   Labels: `good first issue`, `area: docs`, `area: onboarding`

2. [`Docs: add HH/Getmatch/Telegram redacted intake examples`](https://github.com/luiz2047/OpenOffer/issues/9)
   Labels: `good first issue`, `area: docs`, `ru`

3. [`Testing: add duplicate vacancy vs new stage fixture`](https://github.com/luiz2047/OpenOffer/issues/10)
   Labels: `help wanted`, `area: interview-workspace`

4. [`Provider setup: improve Ollama first-run diagnostics`](https://github.com/luiz2047/OpenOffer/issues/11)
   Labels: `help wanted`, `area: providers`

5. [`Local STT: document GigaSTT troubleshooting path`](https://github.com/luiz2047/OpenOffer/issues/12)
   Labels: `good first issue`, `area: local-stt`, `ru`

6. [`Release: add checksum generation to release notes workflow`](https://github.com/luiz2047/OpenOffer/issues/13)
   Labels: `area: release`, `help wanted`

7. [`Privacy: expand log redaction tests for provider errors`](https://github.com/luiz2047/OpenOffer/issues/14)
   Labels: `area: privacy`, `help wanted`

8. [`i18n: review Russian copy in Interview Command Center`](https://github.com/luiz2047/OpenOffer/issues/15)
   Labels: `good first issue`, `area: i18n`, `ru`

9. [`Docs: add screenshot capture checklist for launch assets`](https://github.com/luiz2047/OpenOffer/issues/17)
   Labels: `good first issue`, `area: docs`, `area: onboarding`

10. [`Testing: extend recruiter-chat CI smoke with screenshot evidence`](https://github.com/luiz2047/OpenOffer/issues/18)
    Labels: `help wanted`, `area: interview-workspace`

## Launch Drafts

### GitHub Discussion

Title: `OpenOffer 1.4.0: local-first interview and job-search workspace`

Body:

```markdown
OpenOffer is now public as a local-first, AGPL-licensed desktop workspace for recruiter chats, job-search processes, interviews, and meeting notes.

The first demo is intentionally narrow: paste recruiter/vacancy text, then keep the vacancy dossier, stage timeline, prep brief, questions, retro, and recordings together locally.

Useful links:
- Demo: docs/demo/recruiter-chat-to-process.md
- Contributing: CONTRIBUTING.md
- AGPL FAQ: docs/AGPL_FAQ.md

I am especially looking for help with redacted Russian job-search examples, local STT setup, provider diagnostics, release QA, and focused tests.
```

### Short Social Post

```text
I open-sourced OpenOffer: a local-first desktop workspace for job-search/interview workflows.

First demo: paste recruiter/vacancy text -> local vacancy dossier, stage timeline, prep brief, questions, retro, recordings.

Looking for contributors around Russian job-search examples, local STT, provider setup, Electron reliability, and release QA.

https://github.com/luiz2047/OpenOffer
```

### Russian Launch Post

```text
Открыл OpenOffer: локальный open-source workspace для поиска работы, собеседований, recruiter chats и заметок.

Первый сценарий простой: вставляешь текст от рекрутера или описание вакансии, а OpenOffer собирает локальный процесс: вакансия, этапы, подготовка, вопросы, ретро и записи.

Нужна помощь с русскими HH/Getmatch/Telegram примерами, local STT, настройкой провайдеров, Electron reliability и release QA.

https://github.com/luiz2047/OpenOffer
```

## Deep Review Prompts

Use these prompts in a stronger model and paste the answers back into the repo workstream.

### README Conversion Review

```text
You are reviewing the README of an open-source desktop app called OpenOffer.

Context:
- Local-first, AGPL, Electron desktop app.
- First tribe: developers actively interviewing, especially Russian-speaking developers.
- First demo: paste recruiter/vacancy text and turn it into a local vacancy dossier, stage timeline, prep brief, questions, retro, and recording links.
- Goal: increase stars, first installs from source, and first external contributors.

Task:
1. Identify the top 10 reasons a visitor would bounce.
2. Rewrite the first viewport and first demo section.
3. Propose 5 concrete screenshots/GIFs that would increase trust.
4. Propose 10 starter issues that are actually small enough for first-time contributors.
5. Flag any claims that sound unproven or overhyped.
```

### Open-Source Trust Review

```text
Review this repository as a skeptical open-source contributor.

Focus on:
- README trust
- Release/install trust
- AGPL clarity
- Issue templates
- PR review expectations
- CI signal quality
- Security/privacy posture
- Whether a first-time contributor can find a useful task in 15 minutes

Output:
- P0 blockers before public launch
- P1 improvements for conversion
- P2 polish
- Exact text changes where possible
```

### Russian Developer Launch Review

```text
You are a Russian-speaking senior developer currently looking for ML/AI roles.

Review OpenOffer's public positioning:
- Would you run it from source?
- Would you star it?
- Would you contribute a redacted HH/Getmatch/Telegram example?
- What wording feels fake, unclear, or too broad?
- What demo would convince you in under 60 seconds?

Respond in Russian with brutally specific changes.
```
